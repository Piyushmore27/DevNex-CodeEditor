/**
 * SANDBOX ROUTE — Docker Container Manager
 *
 * Har user ka code ek alag Docker container mein run hota hai.
 * Containers EC2 pe spin up/down hote hain dynamically.
 *
 * Flow:
 *   POST /sandbox/deploy  → GitHub se code pull → Docker build → container start
 *   GET  /sandbox/status  → container ka status check
 *   POST /sandbox/stop    → container band karo
 *   POST /sandbox/restart → container restart karo
 *   GET  /sandbox/logs    → container ke live logs
 *   GET  /sandbox/list    → user ke saare containers
 */

const express    = require('express')
const { exec, spawn } = require('child_process')
const { promisify }   = require('util')
const path       = require('path')
const fs         = require('fs').promises
const auth       = require('../middleware/auth')
const router     = express.Router()

const execAsync = promisify(exec)

// Port range for user containers
const PORT_START = 4000
const PORT_END   = 5999

// Where to store container data on EC2
const CONTAINERS_DIR = process.env.CONTAINERS_DIR || '/opt/devflow/containers'
const MAX_CONTAINERS_PER_USER = parseInt(process.env.MAX_CONTAINERS_PER_USER) || 3

// In-memory store of active containers
// In production use MongoDB/Redis for this
const activeContainers = new Map()

// ── Helper: find free port ────────────────────────────────────────────────────
async function findFreePort() {
  const usedPorts = new Set()
  for (const [, c] of activeContainers) usedPorts.add(c.port)

  for (let p = PORT_START; p <= PORT_END; p++) {
    if (!usedPorts.has(p)) {
      // Double-check port is actually free on system
      try {
        await execAsync(`ss -tlnp | grep :${p}`)
        // Port is in use, try next
      } catch {
        return p  // Port is free
      }
    }
  }
  throw new Error('No free ports available. Server is at capacity.')
}

// ── Helper: get container name ────────────────────────────────────────────────
function getContainerName(githubLogin, repoName) {
  // Clean name — Docker allows only lowercase alphanumeric + hyphens
  const clean = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 30)
  return `devflow-${clean(githubLogin)}-${clean(repoName)}`
}

// ── Helper: detect project type ───────────────────────────────────────────────
async function detectProjectType(dir) {
  try {
    const files = await fs.readdir(dir)

    if (files.includes('package.json')) {
      const pkg = JSON.parse(await fs.readFile(path.join(dir, 'package.json'), 'utf8'))
      // Check if it's a static React build or a server
      if (pkg.scripts?.start?.includes('serve') || pkg.scripts?.start?.includes('http-server')) {
        return 'static-node'
      }
      return 'nodejs'
    }
    if (files.includes('requirements.txt') || files.includes('Pipfile')) return 'python'
    if (files.includes('Dockerfile'))                                       return 'docker'
    if (files.includes('index.html'))                                       return 'static'
    if (files.includes('go.mod'))                                           return 'go'

    return 'nodejs'  // default
  } catch {
    return 'nodejs'
  }
}

// ── Helper: generate Dockerfile ───────────────────────────────────────────────
function generateDockerfile(projectType, port = 3000) {
  const dockerfiles = {
    nodejs: `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production 2>/dev/null || npm install --only=production
COPY . .
EXPOSE ${port}
ENV PORT=${port}
ENV NODE_ENV=production
CMD ["npm", "start"]
`,

    python: `FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt* ./
RUN pip install --no-cache-dir -r requirements.txt 2>/dev/null || true
COPY . .
EXPOSE ${port}
ENV PORT=${port}
CMD ["python", "main.py"]
`,

    static: `FROM nginx:alpine
COPY . /usr/share/nginx/html
COPY nginx.conf* /etc/nginx/conf.d/default.conf 2>/dev/null || true
EXPOSE ${port}
CMD ["nginx", "-g", "daemon off;"]
`,

    'static-node': `FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve
COPY . .
EXPOSE ${port}
CMD ["serve", "-s", "build", "-l", "${port}"]
`,

    go: `FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN go build -o main .

FROM alpine:latest
WORKDIR /app
COPY --from=builder /app/main .
EXPOSE ${port}
ENV PORT=${port}
CMD ["./main"]
`,

    docker: null,  // use existing Dockerfile
  }
  return dockerfiles[projectType]
}

// ── POST /sandbox/deploy ──────────────────────────────────────────────────────
router.post('/deploy', auth, async (req, res) => {
  const { owner, repo, branch = 'main', repoUrl, envVars = {} } = req.body
  const user = req.user

  if (!owner || !repo) {
    return res.status(400).json({ error: 'owner and repo are required' })
  }

  // Check container limit
  const userContainers = [...activeContainers.values()].filter(c => c.githubId === user.githubId)
  if (userContainers.length >= MAX_CONTAINERS_PER_USER) {
    return res.status(429).json({
      error: `Container limit reached (${MAX_CONTAINERS_PER_USER} max). Stop an existing container first.`,
      containers: userContainers.map(c => ({ name:c.name, repo:c.repo, port:c.port })),
    })
  }

  const containerName = getContainerName(user.login, repo)
  const repoDir       = path.join(CONTAINERS_DIR, user.login, repo)
  const port          = await findFreePort().catch(e => { res.status(503).json({ error: e.message }); return null })
  if (!port) return

  // Send immediate response — deployment is async
  res.json({
    message:       'Deployment started...',
    containerName,
    port,
    deployUrl:     `http://${process.env.EC2_PUBLIC_IP || 'localhost'}:${port}`,
    status:        'building',
  })

  // ── Run deployment in background ──────────────────────────────────────────
  ;(async () => {
    try {
      console.log(`[Deploy] Starting: ${containerName} on port ${port}`)

      // 1. Create directory
      await fs.mkdir(repoDir, { recursive: true })

      // 2. Clone or pull repo
      const gitToken = user.githubToken
      const authUrl  = gitToken
        ? `https://x-access-token:${gitToken}@github.com/${owner}/${repo}.git`
        : `https://github.com/${owner}/${repo}.git`

      try {
        // Try pull first (if already cloned)
        await execAsync(`cd "${repoDir}" && git pull origin ${branch}`)
        console.log(`[Deploy] Pulled latest code`)
      } catch {
        // Fresh clone
        await execAsync(`git clone --depth 1 --branch ${branch} "${authUrl}" "${repoDir}"`)
        console.log(`[Deploy] Cloned repo`)
      }

      // 3. Detect project type
      const projectType = await detectProjectType(repoDir)
      console.log(`[Deploy] Project type: ${projectType}`)

      // 4. Write Dockerfile if not exists
      const dockerfilePath = path.join(repoDir, 'Dockerfile')
      const dockerfileExists = await fs.access(dockerfilePath).then(() => true).catch(() => false)

      if (!dockerfileExists || projectType !== 'docker') {
        const dockerfile = generateDockerfile(projectType, port)
        if (dockerfile) {
          await fs.writeFile(dockerfilePath, dockerfile)
          console.log(`[Deploy] Generated Dockerfile for ${projectType}`)
        }
      }

      // 5. Stop existing container if running
      try {
        await execAsync(`docker stop ${containerName} && docker rm ${containerName}`)
        console.log(`[Deploy] Stopped old container`)
      } catch { /* no existing container */ }

      // 6. Build Docker image
      console.log(`[Deploy] Building Docker image...`)
      await execAsync(`docker build -t ${containerName}:latest "${repoDir}"`, { timeout: 300000 })
      console.log(`[Deploy] Docker build complete`)

      // 7. Prepare env vars
      const envString = Object.entries(envVars)
        .map(([k, v]) => `-e ${k}="${v}"`)
        .join(' ')

      // 8. Run container
      const runCmd = `docker run -d \
        --name ${containerName} \
        --restart unless-stopped \
        -p ${port}:${port} \
        --memory 512m \
        --cpus 0.5 \
        --network devflow-net \
        ${envString} \
        -e PORT=${port} \
        -e NODE_ENV=production \
        ${containerName}:latest`

      const { stdout } = await execAsync(runCmd)
      const containerId = stdout.trim().slice(0, 12)
      console.log(`[Deploy] Container started: ${containerId}`)

      // 9. Wait for container to be healthy
      await new Promise(r => setTimeout(r, 2000))
      const { stdout: inspectOut } = await execAsync(`docker inspect --format='{{.State.Status}}' ${containerName}`)
      const containerStatus = inspectOut.trim()

      // 10. Save to active containers map
      activeContainers.set(containerName, {
        name:        containerName,
        containerId,
        owner,
        repo,
        branch,
        port,
        projectType,
        githubId:    user.githubId,
        login:       user.login,
        status:      containerStatus === 'running' ? 'running' : 'error',
        deployUrl:   `http://${process.env.EC2_PUBLIC_IP || 'localhost'}:${port}`,
        startedAt:   new Date().toISOString(),
      })

      console.log(`[Deploy] ✅ ${containerName} running on port ${port}`)

      // Save to MongoDB if available
      if (req.user.mongoId) {
        try {
          const Deployment = require('../models/Deployment')
          await Deployment.findOneAndUpdate(
            { containerName },
            {
              userId:        req.user.mongoId,
              githubId:      req.user.githubId,
              login:         req.user.login,
              owner, repo, branch, port,
              projectType,
              status:        'running',
              deployUrl:     `http://${process.env.EC2_PUBLIC_IP || 'localhost'}:${port}`,
              startedAt:     new Date(),
            },
            { upsert: true, new: true }
          )
        } catch (dbErr) {
          console.log('[Deploy] DB save skipped:', dbErr.message)
        }
      }

    } catch (err) {
      console.error(`[Deploy] ❌ Failed for ${containerName}:`, err.message)
      activeContainers.set(containerName, {
        name:        containerName,
        owner, repo,
        githubId:    user.githubId,
        login:       user.login,
        status:      'error',
        error:       err.message,
        port,
      })
    }
  })()
})

// ── GET /sandbox/status/:name ─────────────────────────────────────────────────
router.get('/status/:name', auth, async (req, res) => {
  const { name } = req.params

  try {
    // Get live status from Docker
    const { stdout } = await execAsync(
      `docker inspect --format='{{.State.Status}} {{.State.StartedAt}}' ${name} 2>/dev/null`
    )
    const [status, startedAt] = stdout.trim().split(' ')

    // Get container from our map
    const container = activeContainers.get(name) || {}

    res.json({
      name,
      status:    status || 'stopped',
      port:      container.port,
      deployUrl: container.deployUrl,
      repo:      container.repo,
      branch:    container.branch,
      startedAt: startedAt || container.startedAt,
    })
  } catch {
    const container = activeContainers.get(name)
    res.json({
      name,
      status:    container?.status || 'not_found',
      port:      container?.port,
      deployUrl: container?.deployUrl,
      error:     container?.error,
    })
  }
})

// ── GET /sandbox/logs/:name ───────────────────────────────────────────────────
router.get('/logs/:name', auth, async (req, res) => {
  const { name }  = req.params
  const { lines = 100 } = req.query

  try {
    const { stdout } = await execAsync(`docker logs --tail ${lines} ${name} 2>&1`)
    res.json({ logs: stdout, name })
  } catch (e) {
    res.status(400).json({ error: `Container "${name}" not found or not running` })
  }
})

// ── GET /sandbox/logs-stream/:name — Server-Sent Events for live logs ─────────
router.get('/logs-stream/:name', auth, (req, res) => {
  const { name } = req.params

  res.setHeader('Content-Type',  'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection',    'keep-alive')
  res.flushHeaders()

  const child = spawn('docker', ['logs', '-f', '--tail', '50', name])

  child.stdout.on('data', data => { res.write(`data: ${data.toString().replace(/\n/g, '\ndata: ')}\n\n`) })
  child.stderr.on('data', data => { res.write(`data: ${data.toString().replace(/\n/g, '\ndata: ')}\n\n`) })

  req.on('close', () => { child.kill(); res.end() })
})

// ── POST /sandbox/stop ────────────────────────────────────────────────────────
router.post('/stop', auth, async (req, res) => {
  const { name } = req.body

  // Verify ownership
  const container = activeContainers.get(name)
  if (container && container.githubId !== req.user.githubId) {
    return res.status(403).json({ error: 'Not your container' })
  }

  try {
    await execAsync(`docker stop ${name} && docker rm ${name}`)
    activeContainers.delete(name)
    res.json({ success: true, message: `Container "${name}" stopped` })
  } catch (e) {
    activeContainers.delete(name)
    res.json({ success: true, message: `Container stopped (was already stopped)` })
  }
})

// ── POST /sandbox/restart ─────────────────────────────────────────────────────
router.post('/restart', auth, async (req, res) => {
  const { name } = req.body
  const container = activeContainers.get(name)

  if (container && container.githubId !== req.user.githubId) {
    return res.status(403).json({ error: 'Not your container' })
  }

  try {
    await execAsync(`docker restart ${name}`)
    res.json({ success: true, message: `Container "${name}" restarted` })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

// ── GET /sandbox/list ─────────────────────────────────────────────────────────
router.get('/list', auth, async (req, res) => {
  const userContainers = []

  for (const [name, container] of activeContainers) {
    if (container.githubId !== req.user.githubId) continue

    // Get live Docker status
    let liveStatus = container.status
    try {
      const { stdout } = await execAsync(`docker inspect --format='{{.State.Status}}' ${name} 2>/dev/null`)
      liveStatus = stdout.trim()
    } catch { liveStatus = 'stopped' }

    userContainers.push({ ...container, status: liveStatus })
  }

  res.json({ containers: userContainers })
})

// ── GET /sandbox/server-stats — EC2 server resource usage ────────────────────
router.get('/server-stats', auth, async (req, res) => {
  try {
    const [cpuOut, memOut, diskOut, dockerOut] = await Promise.all([
      execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}'").catch(() => ({ stdout:'0' })),
      execAsync("free -m | awk 'NR==2{printf \"%s %s %s\", $2,$3,$4}'").catch(() => ({ stdout:'0 0 0' })),
      execAsync("df -h / | awk 'NR==2{print $2, $3, $4, $5}'").catch(() => ({ stdout:'0 0 0 0%' })),
      execAsync("docker ps --format '{{.Names}}' | wc -l").catch(() => ({ stdout:'0' })),
    ])

    const [totalMem, usedMem, freeMem] = memOut.stdout.trim().split(' ').map(Number)
    const [diskTotal, diskUsed, diskFree, diskPct] = diskOut.stdout.trim().split(' ')

    res.json({
      cpu:     parseFloat(cpuOut.stdout.trim()),
      memory:  { total: totalMem, used: usedMem, free: freeMem, pct: Math.round((usedMem/totalMem)*100) },
      disk:    { total: diskTotal, used: diskUsed, free: diskFree, pct: diskPct },
      containers: {
        running: parseInt(dockerOut.stdout.trim()),
        total:   activeContainers.size,
      },
      uptime:  process.uptime(),
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── GET /sandbox/terminal-url/:name — get WebSocket terminal URL for container ─
router.get('/terminal-url/:name', auth, async (req, res) => {
  const { name } = req.params
  const container = activeContainers.get(name)

  if (!container) return res.status(404).json({ error: 'Container not found' })
  if (container.githubId !== req.user.githubId) return res.status(403).json({ error: 'Not your container' })

  // Return the exec endpoint — frontend will use this with WebSocket
  res.json({
    containerName: name,
    execEndpoint:  `/sandbox/exec/${name}`,
    message:       'Connect via WebSocket to execute commands inside container',
  })
})

module.exports = { router, activeContainers }

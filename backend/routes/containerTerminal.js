/**
 * CONTAINER TERMINAL
 * 
 * Ye feature user ko UNKE container ke andar bash terminal deta hai.
 * 
 * Local server terminal (serverTerminal.js) se alag:
 * - serverTerminal = EC2 machine ka terminal
 * - containerTerminal = user ke deployed container ka terminal
 * 
 * User apne running container mein jaake:
 * - Logs dekh sakta hai
 * - Debug kar sakta hai
 * - Files check kar sakta hai
 * - npm install jaise commands run kar sakta hai
 */

const WebSocket = require('ws')
const { spawn } = require('child_process')
const jwt       = require('jsonwebtoken')
const { activeContainers } = require('./sandbox')

const JWT_SECRET = process.env.JWT_SECRET || 'devflow_jwt_secret_change_this'

function setupContainerTerminal(server) {
  const wss = new WebSocket.Server({ server, path: '/container-terminal' })

  wss.on('connection', (ws, req) => {
    const url           = new URL(req.url, `http://${req.headers.host}`)
    const token         = url.searchParams.get('token')
    const containerName = url.searchParams.get('container')

    // Auth check
    if (!token) { ws.close(4001, 'No token'); return }

    let user
    try { user = jwt.verify(token, JWT_SECRET) }
    catch { ws.close(4001, 'Invalid token'); return }

    // Container ownership check
    const container = activeContainers.get(containerName)
    if (!container) {
      ws.send(`\r\n\x1b[31m❌ Container "${containerName}" not found.\x1b[0m\r\n`)
      ws.close(); return
    }
    if (container.githubId !== user.githubId) {
      ws.send(`\r\n\x1b[31m❌ Access denied. Not your container.\x1b[0m\r\n`)
      ws.close(); return
    }

    // Spawn docker exec -it <container> /bin/sh
    ws.send(`\r\n\x1b[32m╔══════════════════════════════════════════╗\x1b[0m\r\n`)
    ws.send(`\x1b[32m║  Container Terminal: ${containerName.slice(0,22).padEnd(22)} ║\x1b[0m\r\n`)
    ws.send(`\x1b[32m╚══════════════════════════════════════════╝\x1b[0m\r\n`)
    ws.send(`\x1b[90mYou are inside your deployed container.\x1b[0m\r\n`)
    ws.send(`\x1b[90mType 'exit' to disconnect.\x1b[0m\r\n\r\n`)

    let shell
    try {
      // Try bash first, fallback to sh
      shell = spawn('docker', ['exec', '-it', containerName, '/bin/bash'], {
        env: { ...process.env, TERM: 'xterm-256color' }
      })

      shell.on('error', () => {
        // bash not available — try sh
        shell = spawn('docker', ['exec', '-it', containerName, '/bin/sh'], {
          env: { ...process.env, TERM: 'xterm-256color' }
        })
        setupShell()
      })
    } catch (e) {
      ws.send(`\r\n\x1b[31m❌ Cannot connect to container: ${e.message}\x1b[0m\r\n`)
      ws.close(); return
    }

    function setupShell() {
      shell.stdout.on('data', data => {
        if (ws.readyState === WebSocket.OPEN) ws.send(data.toString())
      })
      shell.stderr.on('data', data => {
        if (ws.readyState === WebSocket.OPEN) ws.send(data.toString())
      })
      shell.on('exit', code => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(`\r\n\x1b[33mShell exited (${code})\x1b[0m\r\n`)
          ws.close()
        }
      })

      ws.on('message', msg => {
        try {
          const data = JSON.parse(msg.toString())
          if (data.type === 'input') shell.stdin.write(data.data)
        } catch {
          shell.stdin.write(msg.toString())
        }
      })

      ws.on('close', () => { try { shell.kill() } catch {} })
    }

    setupShell()
  })

  console.log('[ContainerTerminal] WebSocket ready at /container-terminal')
  return wss
}

module.exports = { setupContainerTerminal }

const express = require('express')
const axios   = require('axios')
const AdmZip  = require('adm-zip')
const auth    = require('../middleware/auth')
const router  = express.Router()

function ghHeaders(token) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    }
  }
}

const DEFAULT_WORKFLOW = `name: DevNex Deploy
on:
  push:
    branches: [ main ]
  workflow_dispatch:
    inputs:
      message:
        description: 'Deploy message'
        default: 'Deploy via DevNex AI'
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install
        run: npm install
      - name: Test
        run: npm test --if-present
      - name: Build
        run: npm run build --if-present
      - name: Done
        run: echo "✅ Deploy complete at $(date)"
`

// Ensure workflow file exists in repo
async function ensureWorkflow(owner, repo, branch, token) {
  try {
    await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/contents/.github/workflows/deploy.yml`,
      ghHeaders(token)
    )
  } catch {
    // Create it
    await axios.put(
      `https://api.github.com/repos/${owner}/${repo}/contents/.github/workflows/deploy.yml`,
      {
        message: 'Add DevFlow CI/CD workflow',
        content: Buffer.from(DEFAULT_WORKFLOW).toString('base64'),
        branch,
      },
      ghHeaders(token)
    )
    await new Promise(r => setTimeout(r, 2500))
  }
}

// ── POST /deploy/trigger ──────────────────────────────────────────────────────
router.post('/trigger', auth, async (req, res) => {
  const { owner, repo, branch = 'main' } = req.body
  const token = req.user?.githubToken

  try {
    await ensureWorkflow(owner, repo, branch, token)

    await axios.post(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/deploy.yml/dispatches`,
      { ref: branch, inputs: { message: 'Deploy triggered by DevNex AI' } },
      ghHeaders(token)
    )

    await new Promise(r => setTimeout(r, 2500))

    const { data } = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=1&branch=${branch}`,
      ghHeaders(token)
    )

    const run = data.workflow_runs?.[0]
    res.json({ message: '✓ Pipeline triggered!', runId: run?.id, runUrl: run?.html_url, status: run?.status })

  } catch (e) {
    console.error('Deploy trigger error:', e.response?.data?.message || e.message)
    res.status(400).json({ error: e.response?.data?.message || e.message })
  }
})

// ── GET /deploy/status ────────────────────────────────────────────────────────
router.get('/status', auth, async (req, res) => {
  const { owner, repo } = req.query
  const token = req.user?.githubToken

  try {
    const { data } = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=8`,
      ghHeaders(token)
    )
    res.json({
      runs: data.workflow_runs.map(r => ({
        id:        r.id,
        name:      r.name,
        status:    r.status,
        conclusion:r.conclusion,
        branch:    r.head_branch,
        createdAt: r.created_at,
        url:       r.html_url,
        actor:     r.actor?.login,
        event:     r.event,
      }))
    })
  } catch (e) {
    res.status(400).json({ error: e.response?.data?.message || e.message })
  }
})

// ── GET /deploy/logs/:runId ───────────────────────────────────────────────────
router.get('/logs/:runId', auth, async (req, res) => {
  const { owner, repo } = req.query
  const { runId } = req.params
  const token = req.user?.githubToken

  try {
    const runRes = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}`,
      ghHeaders(token)
    )
    const conclusion = runRes.data.conclusion
    const status     = runRes.data.status

    let logText = ''
    try {
      const logsRes = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/logs`,
        { ...ghHeaders(token), responseType: 'arraybuffer' }
      )
      const zip = new AdmZip(Buffer.from(logsRes.data))
      zip.getEntries().forEach(e => {
        if (!e.isDirectory && e.entryName.endsWith('.txt'))
          logText += `\n=== ${e.entryName} ===\n` + e.getData().toString('utf8').slice(0, 2000)
      })
      logText = logText.slice(0, 5000)
    } catch {
      logText = status === 'in_progress' ? '⏳ Still running...' : '📋 Logs not ready yet.'
    }

    let aiExplanation = null
    if (conclusion === 'failure' && process.env.GROQ_API_KEY) {
      try {
        const Groq = require('groq-sdk')
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
        const r = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [{
            role: 'user',
            content: `GitHub Actions pipeline failed. Return ONLY valid JSON:\n{"errorType":"<short>","explanation":"<2-3 sentences>","fixSteps":["step1","step2"],"fixCode":"<terminal command>"}\nLogs:\n${logText}`
          }],
          max_tokens: 500,
        })
        aiExplanation = JSON.parse(r.choices[0].message.content.replace(/```json\n?|```\n?/g, '').trim())
      } catch (aiErr) {
        console.error('AI diagnosis failed:', aiErr.message)
      }
    }

    res.json({ logs: logText, aiExplanation, status: conclusion || status })
  } catch (e) {
    res.status(400).json({ error: e.response?.data?.message || e.message })
  }
})

module.exports = router

const express = require('express')
const axios   = require('axios')
const auth    = require('../middleware/auth')
const router  = express.Router()

// GitHub API headers
function ghHeaders(token) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept:        'application/vnd.github+json',
      'User-Agent':  'DevFlow-AI/1.0',
    }
  }
}

// ── POST /repo/connect ────────────────────────────────────────────────────────
router.post('/connect', auth, async (req, res) => {
  const { repoUrl } = req.body
  const token       = req.user?.githubToken

  // Debug log — check this in your terminal when connect is clicked
  console.log('\n[REPO CONNECT]')
  console.log('  URL received:', repoUrl)
  console.log('  Token present:', !!token)
  console.log('  Token preview:', token ? token.slice(0, 12) + '...' : 'MISSING ❌')

  if (!token) {
    return res.status(401).json({
      error: 'GitHub token missing. Log out and log in again via GitHub.'
    })
  }

  if (!repoUrl) {
    return res.status(400).json({ error: 'repoUrl is required' })
  }

  // Parse GitHub URL — handles all formats:
  // https://github.com/owner/repo
  // https://github.com/owner/repo.git
  // https://github.com/owner/repo/
  const match = repoUrl.trim().match(/github\.com[:/]([^/\s]+)\/([^/\s.]+?)(?:\.git)?\/?$/)

  if (!match) {
    return res.status(400).json({
      error: 'Invalid GitHub URL. Example: https://github.com/username/my-repo'
    })
  }

  const [, owner, repo] = match
  console.log(`  Parsed: owner="${owner}" repo="${repo}"`)

  try {
    const { data } = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}`,
      ghHeaders(token)
    )

    console.log('  GitHub API success ✓:', data.full_name)

    return res.json({
      owner,
      repo:          data.name,
      fullName:      data.full_name,
      defaultBranch: data.default_branch,
      private:       data.private,
      description:   data.description || '',
      stars:         data.stargazers_count,
    })

  } catch (e) {
    const status = e.response?.status
    const msg    = e.response?.data?.message || e.message

    console.error('  GitHub API error ❌:', status, msg)

    if (status === 401) return res.status(401).json({ error: 'GitHub token expired. Log out and log in again.' })
    if (status === 404) return res.status(404).json({ error: `Repo not found: "${owner}/${repo}". Check the URL or make sure you have access.` })
    if (status === 403) return res.status(403).json({ error: 'Access denied. Make sure your GitHub OAuth has "repo" scope.' })

    return res.status(status || 500).json({ error: msg })
  }
})

// ── GET /repo/tree ────────────────────────────────────────────────────────────
router.get('/tree', auth, async (req, res) => {
  const { owner, repo, branch } = req.query
  const token = req.user?.githubToken

  try {
    // Get default branch if not passed
    let targetBranch = branch
    if (!targetBranch) {
      const { data: repoData } = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}`,
        ghHeaders(token)
      )
      targetBranch = repoData.default_branch
    }

    const { data } = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${targetBranch}?recursive=1`,
      ghHeaders(token)
    )

    const files = data.tree
      .filter(f => f.type === 'blob')
      .map(f => ({ path: f.path, sha: f.sha }))

    res.json({ files, branch: targetBranch, truncated: data.truncated })

  } catch (e) {
    const status = e.response?.status
    if (status === 409) {
      return res.status(409).json({ error: 'Repository is empty. Push a commit first.' })
    }
    res.status(status || 400).json({ error: e.response?.data?.message || e.message })
  }
})

// ── GET /repo/file ────────────────────────────────────────────────────────────
router.get('/file', auth, async (req, res) => {
  const { owner, repo, path, branch = 'main' } = req.query
  const token = req.user?.githubToken

  try {
    const { data } = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
      ghHeaders(token)
    )

    res.json({
      content: Buffer.from(data.content, 'base64').toString('utf8'),
      sha:     data.sha,
      path:    data.path,
    })
  } catch (e) {
    res.status(e.response?.status || 400).json({ error: e.response?.data?.message || e.message })
  }
})

// ── PUT /repo/file ────────────────────────────────────────────────────────────
router.put('/file', auth, async (req, res) => {
  const { owner, repo, path, content, sha, message = 'Update via DevFlow AI', branch = 'main' } = req.body
  const token = req.user?.githubToken

  try {
    const body = {
      message,
      content: Buffer.from(content).toString('base64'),
      branch,
    }
    if (sha) body.sha = sha

    const { data } = await axios.put(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      body,
      ghHeaders(token)
    )

    res.json({ sha: data.content.sha, commitSha: data.commit.sha })
  } catch (e) {
    res.status(e.response?.status || 400).json({ error: e.response?.data?.message || e.message })
  }
})

module.exports = router

const express = require('express')
const axios   = require('axios')
const auth    = require('../middleware/auth')
const router  = express.Router()

const gh = t => ({
  headers: {
    Authorization: `Bearer ${t}`,
    Accept: 'application/vnd.github+json',
  }
})

// List open PRs
router.get('/list', auth, async (req, res) => {
  const { owner, repo } = req.query
  try {
    const { data } = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=20`,
      gh(req.user.githubToken)
    )
    res.json({
      prs: data.map(p => ({
        number:    p.number,
        title:     p.title,
        author:    p.user.login,
        branch:    p.head.ref,
        url:       p.html_url,
        additions: p.additions,
        deletions: p.deletions,
        createdAt: p.created_at,
      }))
    })
  } catch (e) { res.status(400).json({ error: e.response?.data?.message || e.message }) }
})

// Get PR diff
router.get('/diff/:prNumber', auth, async (req, res) => {
  const { owner, repo } = req.query
  const { prNumber } = req.params
  try {
    const [prRes, filesRes] = await Promise.all([
      axios.get(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, gh(req.user.githubToken)),
      axios.get(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`, gh(req.user.githubToken)),
    ])
    res.json({
      prInfo: {
        title:  prRes.data.title,
        author: prRes.data.user.login,
        branch: prRes.data.head.ref,
        url:    prRes.data.html_url,
      },
      files: filesRes.data.map(f => ({
        filename:  f.filename,
        status:    f.status,
        additions: f.additions,
        deletions: f.deletions,
        patch:     f.patch?.slice(0, 3000),
      }))
    })
  } catch (e) { res.status(400).json({ error: e.response?.data?.message || e.message }) }
})

// AI review
router.post('/review/:prNumber', auth, async (req, res) => {
  const { owner, repo } = req.query
  const { prNumber } = req.params
  const { postToGitHub = false } = req.body
  if (!process.env.GROQ_API_KEY) return res.status(400).json({ error: 'GROQ_API_KEY not set' })
  try {
    const filesRes = await axios.get(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`, gh(req.user.githubToken))
    const diff = filesRes.data.map(f => `File: ${f.filename}\n${f.patch || '(binary)'}`).join('\n\n').slice(0, 4000)

    const Groq = require('groq-sdk')
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
    const r = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: `Review this PR. Return ONLY valid JSON:\n{"score":85,"verdict":"approve","summary":"...","bugs":[{"severity":"critical","file":"...","issue":"..."}],"praise":["..."],"suggestions":["..."]}\nDiff:\n${diff}` }],
      max_tokens: 800,
    })
    const review = JSON.parse(r.choices[0].message.content.replace(/```json\n?|```\n?/g, '').trim())

    if (postToGitHub) {
      await axios.post(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, { body: `**DevFlow AI Review** (Score: ${review.score}/100)\n\n${review.summary}\n\n${review.suggestions?.join('\n')}`, event: review.verdict === 'approve' ? 'APPROVE' : 'COMMENT' }, gh(req.user.githubToken))
      review.postedToGitHub = true
    }

    res.json(review)
  } catch (e) { res.status(400).json({ error: e.response?.data?.message || e.message }) }
})

// Merge PR
router.post('/merge/:prNumber', auth, async (req, res) => {
  const { owner, repo } = req.query
  const { prNumber } = req.params
  const { mergeMethod = 'merge' } = req.body
  try {
    const { data } = await axios.put(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/merge`,
      { merge_method: mergeMethod, commit_title: `Merge PR #${prNumber} via DevFlow AI` },
      gh(req.user.githubToken)
    )
    res.json({ merged: data.merged, message: data.message, sha: data.sha })
  } catch (e) { res.status(400).json({ error: e.response?.data?.message || e.message }) }
})

module.exports = router

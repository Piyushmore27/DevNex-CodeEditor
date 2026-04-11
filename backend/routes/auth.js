const express = require('express')
const axios   = require('axios')
const jwt     = require('jsonwebtoken')
const auth    = require('../middleware/auth')
const router  = express.Router()

const JWT_SECRET    = process.env.JWT_SECRET    || 'devflow_jwt_secret_change_this'
const CLIENT_URL    = process.env.CLIENT_URL    || 'http://localhost:5173'
const CLIENT_ID     = process.env.GITHUB_CLIENT_ID
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET

// Step 1: Redirect to GitHub login
router.get('/github', (req, res) => {
  if (!CLIENT_ID) {
    return res.status(500).send('GITHUB_CLIENT_ID not set in .env')
  }
  
  const redirectUri = `https://devnex-codeeditor.onrender.com/api/auth/callback`
  
  const url = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&scope=repo,workflow,read:user&redirect_uri=${encodeURIComponent(redirectUri)}`
  
  res.redirect(url)
})

// Step 2: GitHub redirects back here with ?code=
router.get('/callback', async (req, res) => {
  const { code, error } = req.query

  if (error || !code) {
    return res.redirect(`${CLIENT_URL}?error=${error || 'no_code'}`)
  }

  try {
    // Exchange code for GitHub access token
    const tokenRes = await axios.post(
      'https://github.com/login/oauth/access_token',
      { client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code },
      { headers: { Accept: 'application/json' } }
    )

    const githubAccessToken = tokenRes.data.access_token

    if (!githubAccessToken) {
      console.error('No access token in response:', tokenRes.data)
      return res.redirect(`${CLIENT_URL}?error=no_access_token`)
    }

    // Get GitHub user info
    const userRes = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${githubAccessToken}`,
        Accept: 'application/vnd.github+json',
      }
    })

    const ghUser = userRes.data

    // Create our app JWT — store githubAccessToken inside
    const appJWT = jwt.sign(
      {
        githubId:    ghUser.id,
        login:       ghUser.login,
        name:        ghUser.name || ghUser.login,
        avatar:      ghUser.avatar_url,
        githubToken: githubAccessToken,   // ← This is used in repo/deploy/pr routes
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    // Send token to frontend via redirect
    res.redirect(`${CLIENT_URL}?token=${appJWT}`)

  } catch (err) {
    console.error('OAuth callback error:', err.message)
    res.redirect(`${CLIENT_URL}?error=${encodeURIComponent(err.message)}`)
  }
})

// Get current logged-in user (strips sensitive fields)
router.get('/me', auth, (req, res) => {
  const { githubToken, iat, exp, ...safe } = req.user
  res.json(safe)
})

module.exports = router

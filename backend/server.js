require('dotenv').config()

const express  = require('express')
const cors     = require('cors')
const http     = require('http')
const { setupServerTerminal } = require('./routes/serverTerminal')

const app    = express()
const server = http.createServer(app)
const PORT   = process.env.PORT || 5000

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }))
app.use(express.json({ limit: '10mb' }))

app.use('/api/auth',   require('./routes/auth'))
app.use('/api/repo',   require('./routes/repo'))
app.use('/api/ai',     require('./routes/ai'))
app.use('/api/deploy', require('./routes/deploy'))
app.use('/api/pr',     require('./routes/pr'))

app.get('/api/health', (_, res) => res.json({ ok: true }))

app.get('/api/debug', (_, res) => {
  res.json({
    server:               'running ✓',
    PORT,
    GITHUB_CLIENT_ID:     process.env.GITHUB_CLIENT_ID     ? '✓ set' : '❌ MISSING',
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET ? '✓ set' : '❌ MISSING',
    JWT_SECRET:           process.env.JWT_SECRET            ? '✓ set' : '❌ MISSING (using default)',
    GROQ_API_KEY:         process.env.GROQ_API_KEY          ? '✓ set' : '❌ MISSING',
    CLIENT_URL:           process.env.CLIENT_URL || 'http://localhost:5173 (default)',
    platform:             process.platform,
    node:                 process.version,
  })
})

app.use((err, _req, res, _next) => {
  console.error('Server error:', err.message)
  res.status(500).json({ error: err.message })
})

setupServerTerminal(server)

server.listen(PORT, () => {
  console.log(`\n🚀 Backend  → http://localhost:${PORT}`)
  console.log(`📋 Debug    → http://localhost:${PORT}/api/debug`)
  console.log(`💻 Terminal → ws://localhost:${PORT}/terminal\n`)
})

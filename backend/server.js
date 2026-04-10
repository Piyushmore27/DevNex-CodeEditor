require('dotenv').config()

const express  = require('express')
const cors     = require('cors')
const http     = require('http')
const mongoose = require('mongoose')

const app    = express()
const server = http.createServer(app)
const PORT   = process.env.PORT || 5000

// ── MongoDB ───────────────────────────────────────────────────────────────────
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB connected'))
    .catch(e => console.log('⚠️  MongoDB skipped:', e.message))
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.CLIENT_URL || 'https://dev-nex-code-editor.vercel.app/',
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',    require('./routes/auth'))
app.use('/api/repo',    require('./routes/repo'))
app.use('/api/ai',      require('./routes/ai'))
app.use('/api/deploy',  require('./routes/deploy'))
app.use('/api/pr',      require('./routes/pr'))
app.use('/api/sandbox', require('./routes/sandbox').router)

// ── Health + Debug ────────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ ok: true }))

app.get('/api/debug', (_, res) => {
  const dbState = ['disconnected','connected','connecting','disconnecting']
  res.json({
    server:               '✓ running',
    PORT,
    MongoDB:              dbState[mongoose.connection.readyState],
    GITHUB_CLIENT_ID:     process.env.GITHUB_CLIENT_ID     ? '✓ set' : '❌ MISSING',
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET ? '✓ set' : '❌ MISSING',
    JWT_SECRET:           process.env.JWT_SECRET            ? '✓ set' : '❌ using default',
    GROQ_API_KEY:         process.env.GROQ_API_KEY          ? '✓ set' : '❌ MISSING',
    EC2_PUBLIC_IP:        process.env.EC2_PUBLIC_IP         || '❌ not set',
    CONTAINERS_DIR:       process.env.CONTAINERS_DIR        || '/opt/devflow/containers',
    platform:             process.platform,
  })
})

app.use((err, _req, res, _next) => res.status(500).json({ error: err.message }))

// ── WebSocket Terminals ───────────────────────────────────────────────────────
const { setupServerTerminal }    = require('./routes/serverTerminal')
const { setupContainerTerminal } = require('./routes/containerTerminal')

setupServerTerminal(server)
setupContainerTerminal(server)

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🚀 Backend           → http://localhost:${PORT}`)
  console.log(`📋 Debug             → http://localhost:${PORT}/api/debug`)
  console.log(`💻 Server Terminal   → ws://localhost:${PORT}/terminal`)
  console.log(`🐳 Container Terminal→ ws://localhost:${PORT}/container-terminal\n`)
})

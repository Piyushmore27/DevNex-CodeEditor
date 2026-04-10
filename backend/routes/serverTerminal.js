/**
 * SERVER TERMINAL — WebSocket based real terminal
 * 
 * Yeh feature backend SERVER pe actual shell spawn karta hai.
 * Matlab jis machine pe backend deploy hai (Railway/Render/VPS),
 * usi ka terminal browser mein milta hai.
 * 
 * LOCAL pe: tumhare Windows/Mac/Linux ka terminal
 * RAILWAY pe: Railway container ka bash terminal
 * RENDER pe: Render instance ka bash terminal
 */

const WebSocket = require('ws')
const jwt       = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'devflow_jwt_secret_change_this'

function setupServerTerminal(server) {
  const wss = new WebSocket.Server({ server, path: '/terminal' })

  wss.on('connection', (ws, req) => {
    // 1. Auth check
    const url   = new URL(req.url, `http://${req.headers.host}`)
    const token = url.searchParams.get('token')

    if (!token) {
      ws.send('\r\n\x1b[31m❌ No token. Please log in.\x1b[0m\r\n')
      ws.close(4001, 'No token')
      return
    }

    try {
      jwt.verify(token, JWT_SECRET)
    } catch {
      ws.send('\r\n\x1b[31m❌ Invalid token. Please log in again.\x1b[0m\r\n')
      ws.close(4001, 'Invalid token')
      return
    }

    // 2. Try to spawn real shell via node-pty
    let pty = null

    try {
      const nodePty = require('node-pty')

      const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash'
      const cwd   = process.cwd()  // Run in backend project directory

      pty = nodePty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd,
        env: { ...process.env, TERM: 'xterm-256color' },
      })

      console.log(`[Terminal] Shell spawned: ${shell}, PID: ${pty.pid}`)

      // PTY output → browser
      pty.onData(data => {
        if (ws.readyState === WebSocket.OPEN) ws.send(data)
      })

      pty.onExit(({ exitCode }) => {
        console.log(`[Terminal] Shell exited with code ${exitCode}`)
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(`\r\n\x1b[33mShell exited (code ${exitCode}). Close and reopen terminal.\x1b[0m\r\n`)
          ws.close()
        }
      })

      // Browser input → PTY
      ws.on('message', msg => {
        try {
          const data = typeof msg === 'string' ? JSON.parse(msg) : JSON.parse(msg.toString())
          if (data.type === 'input')  pty.write(data.data)
          if (data.type === 'resize') pty.resize(Math.max(data.cols, 10), Math.max(data.rows, 5))
        } catch {
          // Raw string fallback
          try { pty.write(msg.toString()) } catch {}
        }
      })

      ws.on('close', () => {
        try { pty.kill() } catch {}
        console.log('[Terminal] Client disconnected')
      })

    } catch (e) {
      // node-pty not installed — show install instructions
      ws.send('\r\n\x1b[33m╔══════════════════════════════════════════════╗\x1b[0m\r\n')
      ws.send('\x1b[33m║  node-pty not installed on this server        ║\x1b[0m\r\n')
      ws.send('\x1b[33m╚══════════════════════════════════════════════╝\x1b[0m\r\n')
      ws.send('\r\n\x1b[36mTo enable server terminal, run:\x1b[0m\r\n')
      ws.send('\x1b[32m  npm install node-pty\x1b[0m\r\n\r\n')

      if (process.platform === 'win32') {
        ws.send('\x1b[33mWindows: First install build tools:\x1b[0m\r\n')
        ws.send('\x1b[32m  Run PowerShell as Admin:\x1b[0m\r\n')
        ws.send('\x1b[32m  npm install --global windows-build-tools@4.0.0\x1b[0m\r\n')
        ws.send('\x1b[33m  OR download Visual Studio Build Tools from:\x1b[0m\r\n')
        ws.send('\x1b[34m  https://aka.ms/vs/17/release/vs_BuildTools.exe\x1b[0m\r\n')
      }

      ws.send('\r\n\x1b[90mFor now, use the Commands panel (copy-paste terminal)\x1b[0m\r\n')
      // Don't close — let user see the message
    }
  })

  console.log('[Terminal] WebSocket server ready at /terminal')
  return wss
}

module.exports = { setupServerTerminal }

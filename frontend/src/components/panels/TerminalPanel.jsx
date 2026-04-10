import { useEffect, useRef, useState } from 'react'
import { Terminal, RefreshCw, AlertTriangle, Copy, Check } from 'lucide-react'

// WebSocket URL — same host as backend
const WS_URL = typeof window !== 'undefined'
  ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:5000`
  : 'ws://localhost:5000'

const QUICK_CMDS = [
  { label:'npm install',                cmd:'npm install\n' },
  { label:'npm run dev',                cmd:'npm run dev\n' },
  { label:'npm run build',              cmd:'npm run build\n' },
  { label:'git status',                 cmd:'git status\n' },
  { label:'git pull origin main',       cmd:'git pull origin main\n' },
  { label:'git add . && commit',        cmd:'git add . && git commit -m "update"\n' },
  { label:'ls / dir',                   cmd: window?.navigator?.platform?.includes('Win') ? 'dir\n' : 'ls -la\n' },
  { label:'Clear',                      cmd:'clear\n' },
]

export default function TerminalPanel({ token }) {
  const containerRef = useRef(null)
  const termRef      = useRef(null)
  const wsRef        = useRef(null)
  const fitRef       = useRef(null)
  const [status,      setStatus]      = useState('loading')
  const [xtermReady,  setXtermReady]  = useState(false)
  const [errorMsg,    setErrorMsg]    = useState('')
  const [copied,      setCopied]      = useState('')

  // Load xterm.js from CDN
  useEffect(() => {
    if (window.Terminal && window.FitAddon) { setXtermReady(true); return }

    const css = document.createElement('link')
    css.rel = 'stylesheet'
    css.href = 'https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css'
    document.head.appendChild(css)

    const s1 = document.createElement('script')
    s1.src = 'https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.js'
    s1.onload = () => {
      const s2 = document.createElement('script')
      s2.src = 'https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.js'
      s2.onload = () => setXtermReady(true)
      document.head.appendChild(s2)
    }
    document.head.appendChild(s1)
  }, [])

  const connect = () => {
    if (!xtermReady || !containerRef.current) return

    // Clean up old terminal
    if (termRef.current) { termRef.current.dispose(); termRef.current = null }
    if (wsRef.current)   { wsRef.current.close(); wsRef.current = null }

    // Init xterm
    const term = new window.Terminal({
      theme: {
        background: '#0d1117', foreground: '#e6edf3', cursor: '#3fb950',
        selection: 'rgba(63,185,80,0.2)', green: '#3fb950', red: '#f85149',
        yellow: '#d29922', blue: '#58a6ff', cyan: '#56d364', white: '#e6edf3',
        black: '#21262d', brightBlack: '#30363d',
      },
      fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      fontSize: 13, lineHeight: 1.4, cursorBlink: true, cursorStyle: 'bar',
    })

    if (window.FitAddon) {
      const fit = new window.FitAddon.FitAddon()
      term.loadAddon(fit)
      fitRef.current = fit
    }

    term.open(containerRef.current)
    setTimeout(() => fitRef.current?.fit(), 100)
    termRef.current = term

    // Connect WebSocket with auth token
    setStatus('connecting'); setErrorMsg('')
    const ws = new WebSocket(`${WS_URL}/terminal?token=${token}`)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('connected')
      term.writeln('\x1b[32m╔══════════════════════════════════════╗\x1b[0m')
      term.writeln('\x1b[32m║   DevFlow AI — Server Terminal       ║\x1b[0m')
      term.writeln('\x1b[32m╚══════════════════════════════════════╝\x1b[0m')
      term.writeln('\x1b[90mThis is the terminal of the machine running the backend.\x1b[0m')
      term.writeln('\x1b[90mLocally = your machine | Railway/Render = that server\x1b[0m')
      term.writeln('')
    }

    ws.onmessage = e => { term.write(typeof e.data === 'string' ? e.data : '') }

    ws.onclose = ev => {
      setStatus('disconnected')
      if (ev.code === 4001) {
        setErrorMsg('Auth failed — log out and log in again')
        term.writeln('\r\n\x1b[31m✗ Auth failed. Please log out and log in again.\x1b[0m')
      } else {
        term.writeln('\r\n\x1b[33m⚠ Disconnected. Click Reconnect.\x1b[0m')
      }
    }

    ws.onerror = () => {
      setStatus('error')
      setErrorMsg('Cannot connect. Make sure backend is running on port 5000.')
      term.writeln('\r\n\x1b[31m✗ Cannot connect to backend.\x1b[0m')
      term.writeln('\x1b[33mMake sure: cd backend && npm run dev\x1b[0m')
    }

    term.onData(data => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }))
      }
    })

    const obs = new ResizeObserver(() => {
      if (!fitRef.current) return
      fitRef.current.fit()
      if (ws.readyState === WebSocket.OPEN && termRef.current) {
        ws.send(JSON.stringify({ type:'resize', cols:termRef.current.cols, rows:termRef.current.rows }))
      }
    })
    if (containerRef.current) obs.observe(containerRef.current)
    return () => obs.disconnect()
  }

  useEffect(() => {
    if (xtermReady) connect()
    return () => { wsRef.current?.close(); termRef.current?.dispose() }
  }, [xtermReady])

  const sendCmd = (cmd) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type:'input', data:cmd }))
    } else {
      navigator.clipboard.writeText(cmd.trim())
      setCopied(cmd)
      setTimeout(() => setCopied(''), 1500)
    }
  }

  const statusDot = {
    connected:    'bg-green',
    connecting:   'bg-yellow-400 animate-pulse',
    disconnected: 'bg-fg-subtle',
    error:        'bg-red-400',
    loading:      'bg-fg-subtle animate-pulse',
  }[status]

  return (
    <div className="flex flex-col h-full bg-canvas">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-default border-b border-border shrink-0">
        <Terminal size={13} className="text-green"/>
        <span className="text-xs font-semibold font-mono text-fg-default">Server Terminal</span>
        <div className="flex items-center gap-1.5 ml-1">
          <div className={`w-2 h-2 rounded-full ${statusDot}`}/>
          <span className={`text-[10px] ${status==='connected'?'text-green':status==='error'?'text-red-400':'text-fg-subtle'}`}>
            {status}
          </span>
        </div>
        <button onClick={connect} className="ml-auto btn-ghost p-1" title="Reconnect">
          <RefreshCw size={11}/>
        </button>
      </div>

      {/* Error banner */}
      {errorMsg && (
        <div className="px-3 py-2 bg-red-400/8 border-b border-red-400/20 flex items-start gap-2">
          <AlertTriangle size={12} className="text-red-400 shrink-0 mt-0.5"/>
          <p className="text-[10px] text-red-400">{errorMsg}</p>
        </div>
      )}

      {/* xterm container */}
      <div ref={containerRef} className="flex-1 p-1 overflow-hidden" style={{minHeight:0}}/>

      {/* Quick commands */}
      <div className="border-t border-border p-2">
        <p className="text-[9px] text-fg-subtle uppercase tracking-wider mb-1.5 px-1">
          Quick Commands {status !== 'connected' && '(click to copy)'}
        </p>
        <div className="grid grid-cols-2 gap-1">
          {QUICK_CMDS.map((q,i) => (
            <button key={i} onClick={() => sendCmd(q.cmd)}
              className="flex items-center justify-between gap-1.5 px-2 py-1.5 rounded text-left bg-subtle border border-border hover:border-green/40 transition-all group">
              <span className="text-[10px] text-green font-mono truncate">{q.label}</span>
              {copied === q.cmd
                ? <Check size={9} className="text-green shrink-0"/>
                : <Copy size={9} className="text-fg-subtle shrink-0 opacity-0 group-hover:opacity-100"/>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

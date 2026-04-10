import { useState, useEffect, useRef } from 'react'
import {
  Container, Play, Square, RefreshCw, ExternalLink,
  Terminal, Loader2, CheckCircle, XCircle, AlertTriangle,
  Clock, Copy, Check, Cpu, Server
} from 'lucide-react'
import api from '../../utils/api'

const STATUS_STYLE = {
  running:    { color:'text-green',      bg:'bg-green/10 border-green/25',          icon:<CheckCircle size={12} className="text-green"/> },
  building:   { color:'text-yellow-400', bg:'bg-yellow-400/10 border-yellow-400/25', icon:<Loader2 size={12} className="text-yellow-400 animate-spin"/> },
  stopped:    { color:'text-fg-subtle',  bg:'bg-subtle border-border',               icon:<Square size={12} className="text-fg-subtle"/> },
  error:      { color:'text-red-400',    bg:'bg-red-400/10 border-red-400/25',       icon:<XCircle size={12} className="text-red-400"/> },
  restarting: { color:'text-blue-400',   bg:'bg-blue-400/10 border-blue-400/25',     icon:<RefreshCw size={12} className="text-blue-400 animate-spin"/> },
}

export default function SandboxPanel({ owner, repo, branch, token }) {
  const [containers,   setContainers]   = useState([])
  const [deploying,    setDeploying]    = useState(false)
  const [deployMsg,    setDeployMsg]    = useState('')
  const [serverStats,  setServerStats]  = useState(null)
  const [loading,      setLoading]      = useState(false)
  const [activeTab,    setActiveTab]    = useState('deploy')   // deploy | containers | stats
  const [envInput,     setEnvInput]     = useState('')
  const [containerLogs,setContainerLogs]= useState({})
  const [copied,       setCopied]       = useState('')
  const pollRef = useRef(null)

  // Poll containers status every 5 seconds
  useEffect(() => {
    fetchContainers()
    fetchStats()
    pollRef.current = setInterval(() => { fetchContainers(); fetchStats() }, 5000)
    return () => clearInterval(pollRef.current)
  }, [])

  const fetchContainers = async () => {
    try {
      const { containers: c } = await api.get('/sandbox/list').then(r => r.data)
      setContainers(c || [])
    } catch {}
  }

  const fetchStats = async () => {
    try {
      const stats = await api.get('/sandbox/server-stats').then(r => r.data)
      setServerStats(stats)
    } catch {}
  }

  const fetchLogs = async (containerName) => {
    try {
      const { logs } = await api.get(`/sandbox/logs/${containerName}?lines=50`).then(r => r.data)
      setContainerLogs(prev => ({ ...prev, [containerName]: logs }))
    } catch (e) {
      setContainerLogs(prev => ({ ...prev, [containerName]: `Error: ${e.message}` }))
    }
  }

  // Parse env vars from textarea
  const parseEnvVars = (text) => {
    const vars = {}
    text.split('\n').forEach(line => {
      const [key, ...val] = line.trim().split('=')
      if (key && val.length) vars[key.trim()] = val.join('=').trim()
    })
    return vars
  }

  const deploy = async () => {
    if (!owner || !repo) return
    setDeploying(true); setDeployMsg('')
    try {
      const envVars = parseEnvVars(envInput)
      const result  = await api.post('/sandbox/deploy', {
        owner, repo, branch, envVars
      }).then(r => r.data)

      setDeployMsg(`✓ Building... will be live at port ${result.port}`)
      setActiveTab('containers')
      // Poll more frequently during build
      setTimeout(fetchContainers, 5000)
      setTimeout(fetchContainers, 15000)
      setTimeout(fetchContainers, 30000)
    } catch (e) {
      setDeployMsg('Error: ' + (e.response?.data?.error || e.message))
    }
    setDeploying(false)
  }

  const stopContainer = async (name) => {
    if (!window.confirm(`Stop container "${name}"?`)) return
    try {
      await api.post('/sandbox/stop', { name })
      fetchContainers()
    } catch (e) {
      alert(e.response?.data?.error || e.message)
    }
  }

  const restartContainer = async (name) => {
    try {
      await api.post('/sandbox/restart', { name })
      fetchContainers()
    } catch (e) {
      alert(e.response?.data?.error || e.message)
    }
  }

  const copy = (text) => {
    navigator.clipboard.writeText(text)
    setCopied(text)
    setTimeout(() => setCopied(''), 1500)
  }

  if (!owner || !repo) return (
    <div className="flex flex-col h-full bg-default">
      <div className="panel-header">
        <Server size={14} className="text-blue-400"/>
        <span className="panel-title">Deploy on Server</span>
      </div>
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <div>
          <Server size={28} className="text-fg-subtle mx-auto mb-3"/>
          <p className="text-xs text-fg-muted">Connect a GitHub repo to deploy on the server.</p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full bg-default">
      {/* Header */}
      <div className="panel-header">
        <Server size={14} className="text-blue-400"/>
        <span className="panel-title">Deploy on Server</span>
        <button onClick={() => { fetchContainers(); fetchStats() }} className="ml-auto btn-ghost p-1">
          <RefreshCw size={11}/>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border shrink-0">
        {[
          { id:'deploy',     label:'Deploy'     },
          { id:'containers', label:`Containers ${containers.length > 0 ? `(${containers.length})` : ''}` },
          { id:'stats',      label:'Server'     },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-2 text-xs font-medium transition-all border-b-2
              ${activeTab===t.id ? 'border-green text-green' : 'border-transparent text-fg-muted hover:text-fg-default'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">

        {/* ── DEPLOY TAB ── */}
        {activeTab === 'deploy' && (
          <div className="space-y-3">
            {/* Repo info */}
            <div className="p-3 rounded-xl bg-subtle border border-border">
              <div className="text-xs font-semibold text-fg-default mb-1">{owner}/{repo}</div>
              <div className="text-[10px] text-fg-subtle">branch: {branch || 'main'}</div>
            </div>

            {/* How it works */}
            <div className="p-3 rounded-xl bg-blue-400/8 border border-blue-400/20">
              <p className="text-[10px] font-semibold text-blue-400 mb-2">How it works</p>
              <div className="space-y-1">
                {[
                  '1. Code is pulled from GitHub',
                  '2. Docker image is built automatically',
                  '3. Container starts on a free port',
                  '4. Your app is live at server IP + port',
                ].map((s, i) => (
                  <p key={i} className="text-[10px] text-fg-muted">{s}</p>
                ))}
              </div>
            </div>

            {/* Env vars */}
            <div>
              <p className="text-[10px] text-fg-subtle mb-1.5 font-medium uppercase tracking-wider">
                Environment Variables (optional)
              </p>
              <textarea
                className="input-field text-xs resize-none font-mono leading-relaxed"
                rows={4}
                placeholder={'PORT=3000\nNODE_ENV=production\nMY_SECRET=value'}
                value={envInput}
                onChange={e => setEnvInput(e.target.value)}
              />
              <p className="text-[10px] text-fg-subtle mt-1">One per line in KEY=VALUE format</p>
            </div>

            {/* Deploy button */}
            <button onClick={deploy} disabled={deploying}
              className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 transition-all"
              style={{background:'rgba(88,166,255,0.15)',color:'#58a6ff',border:'1px solid rgba(88,166,255,0.35)',boxShadow:'0 0 16px rgba(88,166,255,0.15)'}}>
              {deploying
                ? <><Loader2 size={14} className="animate-spin"/>Building container...</>
                : <><Play size={14} fill="currentColor"/>Deploy {repo} to Server</>}
            </button>

            {deployMsg && (
              <p className={`text-xs px-3 py-2 rounded-lg ${deployMsg.startsWith('✓') ? 'text-green bg-green/8 border border-green/20' : 'text-red-400 bg-red-400/8 border border-red-400/20'}`}>
                {deployMsg}
              </p>
            )}
          </div>
        )}

        {/* ── CONTAINERS TAB ── */}
        {activeTab === 'containers' && (
          <div className="space-y-3">
            {containers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Server size={28} className="text-fg-subtle mb-3"/>
                <p className="text-xs text-fg-muted">No containers running</p>
                <p className="text-[10px] text-fg-subtle mt-1">Deploy a project to create your first container</p>
              </div>
            ) : containers.map(c => {
              const style  = STATUS_STYLE[c.status] || STATUS_STYLE.stopped
              const logsOpen = containerLogs[c.name] !== undefined

              return (
                <div key={c.name} className={`rounded-xl border p-3 space-y-2 ${style.bg}`}>
                  {/* Container header */}
                  <div className="flex items-center gap-2">
                    {style.icon}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-fg-default truncate">{c.repo}</div>
                      <div className="text-[10px] text-fg-subtle">port {c.port} · {c.projectType || 'nodejs'}</div>
                    </div>
                    <span className={`text-[10px] font-medium ${style.color}`}>{c.status}</span>
                  </div>

                  {/* Deploy URL */}
                  {c.deployUrl && c.status === 'running' && (
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-canvas border border-border">
                      <span className="text-[10px] font-mono text-green flex-1 truncate">{c.deployUrl}</span>
                      <button onClick={() => copy(c.deployUrl)}
                        className="p-0.5 hover:text-green text-fg-subtle shrink-0">
                        {copied===c.deployUrl ? <Check size={10} className="text-green"/> : <Copy size={10}/>}
                      </button>
                      <a href={c.deployUrl} target="_blank" rel="noreferrer"
                        className="p-0.5 hover:text-green text-fg-subtle shrink-0">
                        <ExternalLink size={10}/>
                      </a>
                    </div>
                  )}

                  {/* Error message */}
                  {c.error && (
                    <p className="text-[10px] text-red-400 bg-red-400/8 px-2 py-1 rounded">{c.error}</p>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-1.5">
                    {c.status === 'running' && (
                      <>
                        <button onClick={() => restartContainer(c.name)}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[10px] font-medium bg-subtle border border-border hover:border-fg-subtle transition-all">
                          <RefreshCw size={10}/> Restart
                        </button>
                        <button
                          onClick={() => {
                            // Open container terminal in new panel
                            const wsUrl = `${window.location.protocol==='https:'?'wss':'ws'}://${window.location.hostname}:5000/container-terminal?token=${token}&container=${c.name}`
                            window.open(`/container-terminal?ws=${encodeURIComponent(wsUrl)}`, '_blank')
                          }}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[10px] font-medium bg-subtle border border-border hover:border-green/40 hover:text-green transition-all">
                          <Terminal size={10}/> Terminal
                        </button>
                        <button
                          onClick={() => logsOpen
                            ? setContainerLogs(prev => { const n={...prev}; delete n[c.name]; return n })
                            : fetchLogs(c.name)}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[10px] font-medium bg-subtle border border-border hover:border-blue-400/40 hover:text-blue-400 transition-all">
                          {logsOpen ? 'Hide Logs' : 'View Logs'}
                        </button>
                      </>
                    )}
                    <button onClick={() => stopContainer(c.name)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[10px] font-medium transition-all"
                      style={{background:'rgba(248,81,73,0.1)',color:'#f85149',border:'1px solid rgba(248,81,73,0.25)'}}>
                      <Square size={10}/> Stop
                    </button>
                  </div>

                  {/* Live logs */}
                  {logsOpen && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] text-fg-subtle font-semibold uppercase">Container Logs</p>
                        <button onClick={() => fetchLogs(c.name)} className="text-[9px] text-fg-subtle hover:text-green">refresh</button>
                      </div>
                      <pre className="p-2 rounded-lg bg-canvas border border-border text-[10px] font-mono text-fg-muted max-h-40 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                        {containerLogs[c.name] || 'Loading logs...'}
                      </pre>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── SERVER STATS TAB ── */}
        {activeTab === 'stats' && (
          <div className="space-y-3">
            {serverStats ? (
              <>
                {/* CPU */}
                <div className="p-3 rounded-xl bg-subtle border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Cpu size={13} className="text-blue-400"/>
                      <span className="text-xs font-semibold text-fg-default">CPU</span>
                    </div>
                    <span className="text-xs font-bold text-blue-400">{serverStats.cpu?.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-canvas rounded-full overflow-hidden">
                    <div className="h-full bg-blue-400 rounded-full transition-all" style={{width:`${Math.min(serverStats.cpu,100)}%`}}/>
                  </div>
                </div>

                {/* Memory */}
                <div className="p-3 rounded-xl bg-subtle border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-fg-default">Memory</span>
                    <span className="text-xs font-bold text-green">{serverStats.memory?.pct}%</span>
                  </div>
                  <div className="h-2 bg-canvas rounded-full overflow-hidden mb-1">
                    <div className="h-full bg-green rounded-full transition-all" style={{width:`${serverStats.memory?.pct||0}%`}}/>
                  </div>
                  <div className="flex justify-between text-[10px] text-fg-subtle">
                    <span>{serverStats.memory?.used} MB used</span>
                    <span>{serverStats.memory?.total} MB total</span>
                  </div>
                </div>

                {/* Disk */}
                <div className="p-3 rounded-xl bg-subtle border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-fg-default">Disk</span>
                    <span className="text-xs font-bold text-yellow-400">{serverStats.disk?.pct}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-fg-subtle">
                    <span>{serverStats.disk?.used} used</span>
                    <span>{serverStats.disk?.free} free</span>
                  </div>
                </div>

                {/* Containers */}
                <div className="p-3 rounded-xl bg-subtle border border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-fg-default">Running Containers</span>
                    <span className="text-xs font-bold text-purple-400">{serverStats.containers?.running}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center py-8 gap-2 text-xs text-fg-muted">
                <Loader2 size={13} className="animate-spin text-green"/>Loading stats...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

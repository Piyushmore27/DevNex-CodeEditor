import { useState, useRef, useEffect } from 'react'
import { Wand2, Loader2, Check, AlertCircle, Zap } from 'lucide-react'
import { agentEditFile } from '../../utils/api'

const QUICK = [
  { label:'Add error handling',       icon:'🛡' },
  { label:'Refactor this code',       icon:'♻️' },
  { label:'Add TypeScript types',     icon:'📘' },
  { label:'Write unit tests',         icon:'🧪' },
  { label:'Add comments/JSDoc',       icon:'💬' },
  { label:'Optimize for performance', icon:'⚡' },
  { label:'Add input validation',     icon:'✅' },
  { label:'Convert to async/await',   icon:'⏳' },
]

export default function AgentPanel({ fileContent, fileName, filePath, openTabs, onFileUpdate }) {
  const [instruction, setInstruction] = useState('')
  const [loading,     setLoading]     = useState(false)
  const [lastAction,  setLastAction]  = useState('')
  const [history,     setHistory]     = useState([])
  const [error,       setError]       = useState('')
  const textareaRef = useRef(null)

  useEffect(() => { textareaRef.current?.focus() }, [filePath])

  const run = async (instr) => {
    const cmd = (instr || instruction).trim()
    if (!cmd || loading) return
    if (!fileContent) { setError('Open a file in the editor first, then give the agent an instruction.'); return }

    setInstruction(''); setLoading(true); setError(''); setLastAction(cmd)
    try {
      const result = await agentEditFile(cmd, fileContent, fileName, filePath, openTabs?.map(t=>({path:t.path}))||[])
      if (result.code !== undefined) {
        onFileUpdate(result.code)
        setHistory(prev => [{ action:cmd, file:fileName, ok:true }, ...prev.slice(0,9)])
      }
    } catch(e) {
      const msg = e.response?.data?.error || e.message
      setError(msg)
      setHistory(prev => [{ action:cmd, file:fileName, ok:false }, ...prev.slice(0,9)])
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col h-full bg-default">
      <div className="panel-header">
        <div className="w-5 h-5 rounded flex items-center justify-center" style={{background:'rgba(63,185,80,0.2)'}}>
          <Wand2 size={11} className="text-green"/>
        </div>
        <span className="panel-title">AI Agent</span>
        <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-green/15 text-green border border-green/25">writes directly to file</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-3 pt-3 pb-2">
          {filePath
            ? <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-subtle border border-border">
                <Zap size={11} className="text-green shrink-0"/>
                <span className="text-xs text-fg-muted truncate flex-1">Editing: <span className="text-fg-default font-medium">{fileName}</span></span>
              </div>
            : <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-yellow-400/8 border border-yellow-400/20">
                <AlertCircle size={11} className="text-yellow-400 shrink-0"/>
                <span className="text-xs text-yellow-400">Open a file in editor first</span>
              </div>
          }
        </div>

        <div className="px-3 pb-3">
          <p className="text-[10px] text-fg-subtle mb-2 font-medium uppercase tracking-wider">Tell the agent what to do:</p>
          <textarea ref={textareaRef}
            className="input-field text-sm resize-none leading-relaxed" rows={4}
            placeholder={filePath ? `e.g. "Add error handling to all async functions"\n"Refactor to use TypeScript"\n"Add a /users endpoint"` : 'Open a file first...'}
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey && instruction.trim()) { e.preventDefault(); run() } }}
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-fg-subtle">Enter to run · Shift+Enter newline</span>
            <button onClick={() => run()} disabled={loading || !instruction.trim() || !filePath}
              className="btn-green text-xs py-1.5 px-3 disabled:opacity-40">
              {loading ? <><Loader2 size={12} className="animate-spin"/>Working...</> : <><Wand2 size={12}/>Run Agent</>}
            </button>
          </div>
        </div>

        {loading && (
          <div className="mx-3 mb-3 p-3 rounded-xl border border-green/30 bg-green/5 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 size={13} className="animate-spin text-green"/>
              <span className="text-sm font-medium text-green">Writing code...</span>
            </div>
            <p className="text-xs text-fg-muted">"{lastAction}"</p>
            <div className="mt-2 flex gap-1">
              {['Reading','Understanding','Writing','Applying'].map((s,i) => (
                <div key={i} className="flex-1 h-1 rounded-full bg-green/20 overflow-hidden">
                  <div className="h-full bg-green rounded-full animate-pulse" style={{animationDelay:`${i*0.2}s`}}/>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="mx-3 mb-3 p-3 rounded-xl bg-red-400/10 border border-red-400/25">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle size={13} className="text-red-400"/>
              <span className="text-xs font-semibold text-red-400">Error</span>
            </div>
            <p className="text-xs text-red-400/80">{error}</p>
          </div>
        )}

        <div className="px-3 pb-3">
          <p className="text-[10px] text-fg-subtle mb-2 font-medium uppercase tracking-wider">Quick Actions</p>
          <div className="grid grid-cols-2 gap-1.5">
            {QUICK.map(a => (
              <button key={a.label} onClick={() => run(a.label)} disabled={loading || !filePath}
                className="flex items-center gap-1.5 p-2 rounded-lg text-left border border-border bg-subtle hover:border-green/40 hover:bg-overlay transition-all disabled:opacity-40 group">
                <span className="text-sm shrink-0">{a.icon}</span>
                <span className="text-[10px] text-fg-muted group-hover:text-fg-default leading-tight">{a.label}</span>
              </button>
            ))}
          </div>
        </div>

        {history.length > 0 && (
          <div className="px-3 pb-3">
            <p className="text-[10px] text-fg-subtle mb-2 font-medium uppercase tracking-wider">History</p>
            <div className="space-y-1.5">
              {history.map((h,i) => (
                <div key={i} onClick={() => !loading && filePath && run(h.action)}
                  className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-all
                    ${h.ok ? 'bg-green/5 border-green/15 hover:border-green/30' : 'bg-red-400/5 border-red-400/15'}`}>
                  {h.ok ? <Check size={11} className="text-green mt-0.5 shrink-0"/> : <AlertCircle size={11} className="text-red-400 mt-0.5 shrink-0"/>}
                  <div className="min-w-0">
                    <p className="text-[10px] text-fg-muted truncate">{h.action}</p>
                    <p className="text-[9px] text-fg-subtle">{h.file}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

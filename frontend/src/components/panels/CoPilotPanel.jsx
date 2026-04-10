import { useState, useRef, useEffect } from 'react'
import { Bot, Send, Zap, Code2, Loader2, Copy, Check, FilePlus, FolderOpen, Edit3 } from 'lucide-react'
import { aiChat, genBoilerplate } from '../../utils/api'

function Message({ msg, onApplyCode }) {
  const [copied, setCopied] = useState('')
  const isAI = msg.role === 'assistant'

  const renderContent = (text) => {
    const parts = text.split(/(```[\s\S]*?```)/g)
    return parts.map((part, i) => {
      if (part.startsWith('```')) {
        const lines = part.split('\n')
        const lang  = lines[0].replace('```','').trim() || 'code'
        const code  = lines.slice(1,-1).join('\n')
        return (
          <div key={i} className="my-2 rounded-lg overflow-hidden border border-border">
            <div className="flex items-center justify-between px-3 py-1.5 bg-subtle border-b border-border">
              <span className="text-xs text-fg-muted font-mono">{lang}</span>
              <div className="flex items-center gap-1.5">
                {onApplyCode && (
                  <button onClick={() => onApplyCode(code)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium"
                    style={{background:'rgba(63,185,80,0.15)',color:'#3fb950',border:'1px solid rgba(63,185,80,0.3)'}}>
                    <Edit3 size={10}/> Apply to Editor
                  </button>
                )}
                <button onClick={() => { navigator.clipboard.writeText(code); setCopied(code); setTimeout(()=>setCopied(''),2000) }}
                  className="btn-ghost py-0.5 px-1.5 text-xs">
                  {copied===code ? <Check size={11} className="text-green"/> : <Copy size={11}/>}
                </button>
              </div>
            </div>
            <pre className="p-3 text-xs font-mono text-fg-default bg-canvas overflow-x-auto leading-relaxed whitespace-pre-wrap">{code}</pre>
          </div>
        )
      }
      return <span key={i} className="whitespace-pre-wrap leading-relaxed">{part}</span>
    })
  }

  return (
    <div className={`flex gap-2.5 mb-4 animate-fade-in ${isAI ? '' : 'flex-row-reverse'}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isAI ? 'bg-green/20 border border-green/30' : 'bg-subtle border border-border'}`}>
        {isAI ? <Bot size={13} className="text-green"/> : <span className="text-xs text-fg-muted">U</span>}
      </div>
      <div className={`flex-1 min-w-0 text-sm ${isAI ? '' : 'flex justify-end'}`}>
        <div className={`rounded-xl px-3.5 py-2.5 text-sm leading-relaxed max-w-full ${isAI ? 'bg-overlay border border-border text-fg-default' : 'bg-green-dark text-white'}`}
          style={isAI ? {} : {boxShadow:'0 0 12px rgba(63,185,80,0.3)'}}>
          {isAI ? renderContent(msg.content) : msg.content}
        </div>
      </div>
    </div>
  )
}

export default function CoPilotPanel({ fileContent, fileName, onLoadFiles, onCreateFile, onApplyCode }) {
  const [messages, setMessages] = useState([{ role:'assistant', content:'👋 Hi! I am DevNex Ai.\n\nAsk me anything about your code, or switch to **Generate** to create a full project.' }])
  const [input,      setInput]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [tab,        setTab]        = useState('chat')
  const [bpDesc,     setBpDesc]     = useState('')
  const [bpResult,   setBpResult]   = useState(null)
  const [bpLoading,  setBpLoading]  = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages])

  const send = async (text) => {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput('')
    setMessages(prev => [...prev, { role:'user', content:msg }])
    setLoading(true)
    try {
      const { reply } = await aiChat(msg, fileContent, fileName)
      setMessages(prev => [...prev, { role:'assistant', content:reply }])
    } catch(e) {
      setMessages(prev => [...prev, { role:'assistant', content:`Error: ${e.response?.data?.error || e.message}` }])
    }
    setLoading(false)
  }

  const generateBoilerplate = async () => {
    if (!bpDesc.trim() || bpLoading) return
    setBpLoading(true); setBpResult(null)
    try { setBpResult(await genBoilerplate(bpDesc)) }
    catch(e) { setBpResult({ error: e.response?.data?.error || e.message }) }
    setBpLoading(false)
  }

  return (
    <div className="flex flex-col h-full bg-default">
      <div className="panel-header">
        <Bot size={14} className="text-green"/>
        <span className="panel-title">AI Co-pilot</span>
        <div className="ml-auto flex gap-1">
          {['chat','generate'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-2.5 py-0.5 rounded text-xs font-medium transition-all
                ${tab===t ? 'bg-green/20 text-green border border-green/30' : 'text-fg-muted hover:text-fg-default'}`}>
              {t === 'chat' ? 'Chat' : 'Generate'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'chat' ? (
        <>
          {fileName && (
            <div className="px-3 py-1.5 border-b border-border bg-canvas flex items-center gap-1.5">
              <span className="text-[10px] text-fg-subtle">File:</span>
              <span className="text-[10px] font-mono text-green truncate">{fileName}</span>
              {onApplyCode && <span className="text-[10px] text-fg-subtle ml-auto">← Apply on code blocks</span>}
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-3 min-h-0">
            {messages.map((m,i) => <Message key={i} msg={m} onApplyCode={m.role==='assistant' ? onApplyCode : null}/>)}
            {loading && (
              <div className="flex gap-2.5 mb-4">
                <div className="w-7 h-7 rounded-full bg-green/20 border border-green/30 flex items-center justify-center">
                  <Bot size={13} className="text-green"/>
                </div>
                <div className="bg-overlay border border-border rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                  <Loader2 size={13} className="text-green animate-spin"/>
                  <span className="text-xs text-fg-muted">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>
          <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
            {['Explain this code','Fix the bug','Add error handling','Write unit tests'].map(q => (
              <button key={q} onClick={() => send(q)} className="btn-ghost text-xs py-0.5 border border-border hover:border-green/40 hover:text-green">
                {q}
              </button>
            ))}
          </div>
          <div className="px-3 pb-3">
            <div className="flex gap-2 items-end p-2 rounded-xl border border-border bg-canvas focus-within:border-green transition-all">
              <textarea className="flex-1 bg-transparent text-sm text-fg-default outline-none resize-none placeholder:text-fg-subtle leading-relaxed min-h-[36px] max-h-32"
                placeholder="Ask anything about your code..."
                value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send() } }} rows={1}/>
              <button onClick={() => send()} disabled={!input.trim()||loading} className="btn-green py-1.5 px-2.5 text-xs shrink-0 disabled:opacity-40">
                <Send size={12}/>
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 min-h-0 space-y-3">
          <p className="text-xs text-fg-muted">Describe your project — AI generates all files and loads them into the editor.</p>
          <textarea className="input-field text-sm resize-none leading-relaxed" rows={4}
            placeholder="e.g. Node.js REST API with JWT auth and user management..."
            value={bpDesc} onChange={e => setBpDesc(e.target.value)}/>
          <button onClick={generateBoilerplate} disabled={!bpDesc.trim()||bpLoading} className="btn-green w-full justify-center disabled:opacity-40">
            {bpLoading ? <><Loader2 size={13} className="animate-spin"/>Generating...</> : <><Zap size={13}/>Generate Project</>}
          </button>
          {bpResult?.error && <div className="p-3 rounded-lg bg-red-400/10 border border-red-400/25 text-xs text-red-400">{bpResult.error}</div>}
          {bpResult && !bpResult.error && (
            <div className="animate-fade-in space-y-3">
              <div className="p-3 rounded-lg border border-green/30 bg-green/5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-green">{bpResult.projectName}</span>
                  <span className="badge-green">{bpResult.files?.length} files</span>
                </div>
                <p className="text-xs text-fg-muted">{bpResult.description}</p>
              </div>
              <button onClick={() => onLoadFiles?.(bpResult)} className="btn-green w-full justify-center">
                <FolderOpen size={14}/> Load All Files into Editor
              </button>
              <div className="space-y-1.5">
                {bpResult.files?.map((f,i) => (
                  <div key={i} className="rounded-lg border border-border overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-1.5 bg-subtle border-b border-border">
                      <span className="text-xs font-mono text-fg-default truncate flex-1">{f.path}</span>
                      <button onClick={() => onCreateFile?.(f.path, f.content)}
                        className="ml-2 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium"
                        style={{background:'rgba(63,185,80,0.15)',color:'#3fb950',border:'1px solid rgba(63,185,80,0.3)'}}>
                        <FilePlus size={10}/> Open
                      </button>
                    </div>
                    <pre className="p-2 text-[11px] font-mono text-fg-muted bg-canvas overflow-x-auto max-h-20 leading-relaxed">
                      {f.content?.slice(0,200)}{f.content?.length>200?'\n...':''}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

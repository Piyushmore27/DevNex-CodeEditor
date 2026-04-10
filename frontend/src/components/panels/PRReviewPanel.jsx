import { useState } from 'react'
import { GitPullRequest, Loader2, ChevronRight, ChevronDown, Star, CheckCircle2, MessageSquare, ExternalLink, GitMerge, CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react'
import { listPRs, getPRDiff, reviewPR, mergePR } from '../../utils/api'

function DiffView({ files }) {
  const [open, setOpen] = useState({})
  return (
    <div className="space-y-2">
      {files.map((f,i)=>(
        <div key={i} className="rounded-lg border border-border overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-subtle border-b border-border cursor-pointer" onClick={()=>setOpen(p=>({...p,[i]:!p[i]}))}>
            {open[i]?<ChevronDown size={11}/>:<ChevronRight size={11}/>}
            <span className="text-xs font-mono text-fg-default flex-1 truncate">{f.filename}</span>
            <span className="text-xs text-green">+{f.additions}</span>
            <span className="text-xs text-red-400 ml-1">-{f.deletions}</span>
          </div>
          {open[i]&&f.patch&&(
            <pre className="p-2.5 text-xs font-mono overflow-x-auto max-h-48 bg-canvas">
              {f.patch.split('\n').map((l,j)=>(
                <div key={j} className={l.startsWith('+')?'text-green bg-green/5':l.startsWith('-')?'text-red-400 bg-red-400/5':l.startsWith('@@')?'text-blue-400':'text-fg-subtle'}>{l}</div>
              ))}
            </pre>
          )}
        </div>
      ))}
    </div>
  )
}

export default function PRReviewPanel({ owner, repo }) {
  const [prs,         setPRs]         = useState([])
  const [prsLoading,  setPRsLoading]  = useState(false)
  const [selected,    setSelected]    = useState(null)
  const [diff,        setDiff]        = useState(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const [review,      setReview]      = useState(null)
  const [reviewing,   setReviewing]   = useState(false)
  const [merging,     setMerging]     = useState(false)
  const [mergeResult, setMergeResult] = useState(null)
  const [mergeMethod, setMergeMethod] = useState('merge')
  const [manualPR,    setManualPR]    = useState('')

  const fetchPRs = async () => {
    if (!owner||!repo) return
    setPRsLoading(true)
    try { const {prs:p}=await listPRs(owner,repo); setPRs(p||[]) }
    catch(e) { alert(e.response?.data?.error||e.message) }
    setPRsLoading(false)
  }

  const selectPR = async (pr) => {
    setSelected(pr); setDiff(null); setReview(null); setMergeResult(null); setDiffLoading(true)
    try { setDiff(await getPRDiff(owner,repo,pr.number)) }
    catch(e) { setDiff({error:e.response?.data?.error||e.message}) }
    setDiffLoading(false)
  }

  const doReview = async (post=false) => {
    if (!selected) return
    setReviewing(true); setReview(null)
    try { setReview(await reviewPR(owner,repo,selected.number,post)) }
    catch(e) { setReview({error:e.response?.data?.error||e.message}) }
    setReviewing(false)
  }

  const doMerge = async () => {
    if (!selected||!window.confirm(`Merge PR #${selected.number}? Cannot be undone.`)) return
    setMerging(true)
    try { const r=await mergePR(owner,repo,selected.number,mergeMethod); setMergeResult(r); setPRs(prev=>prev.filter(p=>p.number!==selected.number)) }
    catch(e) { setMergeResult({error:e.response?.data?.error||e.message}) }
    setMerging(false)
  }

  if (!owner||!repo) return (
    <div className="flex flex-col h-full bg-default">
      <div className="panel-header"><GitPullRequest size={14} className="text-purple-400"/><span className="panel-title">PR Review</span></div>
      <div className="flex-1 flex items-center justify-center p-6"><p className="text-xs text-fg-subtle">Connect a GitHub repo to review pull requests.</p></div>
    </div>
  )

  return (
    <div className="flex flex-col h-full bg-default">
      <div className="panel-header">
        <GitPullRequest size={14} className="text-purple-400"/>
        <span className="panel-title">PR Review</span>
        {selected && <button onClick={()=>{setSelected(null);setDiff(null);setReview(null);setMergeResult(null)}} className="ml-auto btn-ghost text-xs py-0.5">← Back</button>}
      </div>

      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <div className="p-3 space-y-3">
            <button onClick={fetchPRs} disabled={prsLoading}
              className="w-full py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-2 disabled:opacity-40"
              style={{background:'rgba(188,140,255,0.12)',color:'#bc8cff',border:'1px solid rgba(188,140,255,0.3)'}}>
              {prsLoading?<Loader2 size={12} className="animate-spin"/>:<RefreshCw size={12}/>}
              {prsLoading?'Loading...':prs.length?'Refresh PRs':'Load Pull Requests'}
            </button>
            <div className="flex gap-2">
              <input className="input-field text-xs py-1.5 flex-1" placeholder="PR number e.g. 42" value={manualPR} onChange={e=>setManualPR(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&manualPR&&selectPR({number:parseInt(manualPR),title:`PR #${manualPR}`,author:'',branch:''})}/>
              <button onClick={()=>manualPR&&selectPR({number:parseInt(manualPR),title:`PR #${manualPR}`,author:'',branch:''})} className="btn-secondary text-xs py-1.5 shrink-0">Open</button>
            </div>
            {prs.map(pr=>(
              <div key={pr.number} onClick={()=>selectPR(pr)} className="p-3 rounded-lg bg-subtle border border-border hover:border-purple-400/40 cursor-pointer transition-all">
                <div className="flex items-start gap-2">
                  <GitPullRequest size={13} className="text-green mt-0.5 shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-fg-default truncate">{pr.title}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-fg-subtle">#{pr.number} by {pr.author}</span>
                      <span className="font-mono text-[10px] text-blue-400">{pr.branch}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-3 space-y-3">
            <div className="p-3 rounded-lg bg-subtle border border-border">
              <div className="flex items-center gap-2 mb-1">
                <GitPullRequest size={13} className="text-green shrink-0"/>
                <span className="text-sm font-semibold text-fg-default truncate flex-1">{diff?.prInfo?.title||selected.title}</span>
                {(diff?.prInfo?.url||selected.url)&&<a href={diff?.prInfo?.url||selected.url} target="_blank" rel="noreferrer"><ExternalLink size={11} className="text-fg-muted hover:text-green"/></a>}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-fg-subtle">
                <span>#{selected.number}</span>
                {selected.author&&<span>by {selected.author}</span>}
              </div>
            </div>

            {/* Review buttons */}
            <div className="flex gap-2">
              <button onClick={()=>doReview(false)} disabled={reviewing||!diff||!!diff?.error}
                className="flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 disabled:opacity-40"
                style={{background:'rgba(188,140,255,0.12)',color:'#bc8cff',border:'1px solid rgba(188,140,255,0.3)'}}>
                {reviewing?<Loader2 size={11} className="animate-spin"/>:<Star size={11}/>} AI Review
              </button>
              <button onClick={()=>doReview(true)} disabled={reviewing||!diff||!!diff?.error}
                className="flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 disabled:opacity-40"
                style={{background:'rgba(63,185,80,0.12)',color:'#3fb950',border:'1px solid rgba(63,185,80,0.3)'}}>
                <MessageSquare size={11}/> Post to GitHub
              </button>
            </div>

            {/* Merge section */}
            {!mergeResult && (
              <div className="p-3 rounded-lg border border-border bg-subtle space-y-2">
                <p className="text-[10px] font-semibold text-fg-subtle uppercase tracking-wider">Merge PR</p>
                <div className="flex gap-1">
                  {['merge','squash','rebase'].map(m=>(
                    <button key={m} onClick={()=>setMergeMethod(m)}
                      className={`flex-1 py-1.5 rounded text-[10px] font-medium capitalize transition-all ${mergeMethod===m?'bg-green/20 text-green border border-green/30':'bg-canvas text-fg-muted border border-border'}`}>
                      {m}
                    </button>
                  ))}
                </div>
                <button onClick={doMerge} disabled={merging}
                  className="w-full py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{background:'rgba(63,185,80,0.18)',color:'#3fb950',border:'1px solid rgba(63,185,80,0.4)'}}>
                  {merging?<><Loader2 size={13} className="animate-spin"/>Merging...</>:<><GitMerge size={13}/>Merge PR #{selected.number}</>}
                </button>
              </div>
            )}

            {mergeResult&&!mergeResult.error&&(
              <div className="p-3 rounded-lg bg-green/10 border border-green/30 animate-fade-in">
                <div className="flex items-center gap-2"><CheckCircle size={14} className="text-green"/><span className="text-sm font-semibold text-green">Merged!</span></div>
                {mergeResult.sha&&<p className="text-[10px] font-mono text-fg-subtle mt-1">SHA: {mergeResult.sha?.slice(0,12)}</p>}
              </div>
            )}
            {mergeResult?.error&&<div className="p-3 rounded-lg bg-red-400/10 border border-red-400/25 text-xs text-red-400">{mergeResult.error}</div>}

            {/* Review result */}
            {review&&(
              <div className="p-3 rounded-lg border animate-fade-in"
                style={{background:review.verdict==='approve'?'rgba(63,185,80,0.08)':'rgba(248,81,73,0.08)',borderColor:review.verdict==='approve'?'rgba(63,185,80,0.25)':'rgba(248,81,73,0.25)'}}>
                {review.error?<p className="text-xs text-red-400">{review.error}</p>:(
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold" style={{color:review.verdict==='approve'?'#3fb950':'#f85149'}}>Score: {review.score}/100</span>
                      <span className={review.verdict==='approve'?'badge-green':'badge-red'}>{review.verdict?.replace('_',' ')}</span>
                    </div>
                    <p className="text-xs text-fg-muted mb-2 leading-relaxed">{review.summary}</p>
                    {review.postedToGitHub&&<div className="badge-green text-[10px] mb-2">✓ Posted to GitHub</div>}
                    {review.suggestions?.length>0&&(
                      <div className="p-2 rounded bg-blue-400/5 border border-blue-400/15 mt-2">
                        <p className="text-[10px] font-semibold text-blue-400 mb-1 flex items-center gap-1"><CheckCircle2 size={10}/>Suggestions</p>
                        {review.suggestions.map((s,i)=><p key={i} className="text-[10px] text-fg-muted">• {s}</p>)}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {diffLoading&&<div className="flex items-center gap-2 py-4 text-xs text-fg-muted"><Loader2 size={13} className="animate-spin text-green"/>Loading diff...</div>}
            {diff?.error&&<div className="p-3 rounded-lg bg-red-400/10 border border-red-400/25 text-xs text-red-400">{diff.error}</div>}
            {diff&&!diff.error&&diff.files&&(
              <div>
                <p className="text-[10px] font-semibold text-fg-subtle uppercase tracking-wider mb-2">{diff.files.length} Changed Files</p>
                <DiffView files={diff.files}/>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

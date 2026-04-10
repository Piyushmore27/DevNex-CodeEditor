import { useState, useEffect, useRef, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import {
  Github, LogOut, Zap, Shield, Rocket, GitPullRequest,
  Save, X, Bot, RefreshCw, FilePlus, FolderPlus, Upload,
  Loader2, ChevronRight, ChevronDown, Folder, FolderOpen,
  Terminal, Eye, EyeOff, FolderGit2, Plus, Wand2, Play
} from 'lucide-react'
import AgentPanel      from '../components/panels/AgentPanel'
import CoPilotPanel    from '../components/panels/CoPilotPanel'
import BugScannerPanel from '../components/panels/BugScannerPanel'
import DeployPanel     from '../components/panels/DeployPanel'
import PRReviewPanel   from '../components/panels/PRReviewPanel'
import TerminalPanel   from '../components/panels/TerminalPanel'
import { connectRepo, getFileTree, getFile, saveFile, getMe } from '../utils/api'
import { getLang, getFileColor, buildTree, TEMPLATES } from '../utils/constants'

// ── Panel config ──────────────────────────────────────────────────────────────
const PANELS = [
  { id:'agent',    icon:<Wand2 size={14}/>,          label:'AI Agent',    color:'text-green' },
  { id:'copilot',  icon:<Bot size={14}/>,             label:'AI Chat',     color:'text-green' },
  { id:'bugs',     icon:<Shield size={14}/>,           label:'Bug Scanner', color:'text-yellow-400' },
  { id:'deploy',   icon:<Rocket size={14}/>,           label:'Deployment',  color:'text-blue-400' },
  { id:'pr',       icon:<GitPullRequest size={14}/>,   label:'PR Review',   color:'text-purple-400' },
  { id:'terminal', icon:<Terminal size={14}/>,         label:'Terminal',    color:'text-green' },
]

function FileIcon({ path, size=10 }) {
  return <span style={{ fontSize:size, color:getFileColor(path) }}>●</span>
}

// ── Inline input for new file/folder ─────────────────────────────────────────
function InlineInput({ type, depth, onConfirm, onCancel }) {
  const [val, setVal] = useState('')
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus() }, [])
  return (
    <div className="flex items-center gap-1.5 py-0.5 rounded border border-green/40 bg-overlay mx-1"
      style={{ paddingLeft: depth * 12 + 8 }}>
      {type==='folder'
        ? <Folder size={10} style={{color:'#dcb67a'}} className="shrink-0"/>
        : <span className="text-[9px] text-fg-subtle shrink-0">●</span>}
      <input ref={ref} value={val} onChange={e => setVal(e.target.value)}
        placeholder={type==='folder' ? 'folder-name' : 'filename.js'}
        className="bg-transparent text-xs text-fg-default outline-none flex-1 py-0.5"
        onKeyDown={e => {
          if (e.key==='Enter' && val.trim()) onConfirm(val.trim())
          if (e.key==='Escape') onCancel()
        }}/>
    </div>
  )
}

// ── Tree node ─────────────────────────────────────────────────────────────────
function TreeNode({ name, node, depth=0, onFileClick, activeFile, onAddFile, onAddFolder, addingIn, onAddConfirm, onAddCancel }) {
  const [open, setOpen]     = useState(depth < 2)
  const [hovered, setHovered] = useState(false)
  const isFile = !!node.__file

  if (isFile) {
    const active = activeFile === node.__file.path
    return (
      <div onClick={() => onFileClick(node.__file)}
        className={`flex items-center gap-1.5 py-[3px] rounded cursor-pointer transition-all
          ${active ? 'bg-green/15 text-green' : 'text-fg-muted hover:bg-subtle hover:text-fg-default'}`}
        style={{ paddingLeft: depth * 12 + 8 }}>
        <FileIcon path={name}/>
        <span className="text-xs truncate flex-1">{name}</span>
      </div>
    )
  }

  const children = Object.entries(node)
    .filter(([k]) => k !== '__file')
    .sort(([,a],[,b]) => (!!b.__file)-(!!a.__file))

  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div onClick={() => setOpen(o=>!o)}
        className="flex items-center gap-1.5 py-[3px] rounded cursor-pointer text-fg-muted hover:bg-subtle hover:text-fg-default transition-all"
        style={{ paddingLeft: depth * 12 + 8 }}>
        {open ? <ChevronDown size={11} className="shrink-0"/> : <ChevronRight size={11} className="shrink-0"/>}
        {open ? <FolderOpen size={11} className="shrink-0" style={{color:'#dcb67a'}}/> : <Folder size={11} className="shrink-0" style={{color:'#dcb67a'}}/>}
        <span className="text-xs truncate flex-1">{name}</span>
        {hovered && (
          <div className="flex gap-0.5 ml-auto" onClick={e => e.stopPropagation()}>
            <button onClick={() => onAddFile(name)} className="p-0.5 rounded hover:bg-overlay text-fg-subtle hover:text-green" title="New file"><FilePlus size={10}/></button>
            <button onClick={() => onAddFolder(name)} className="p-0.5 rounded hover:bg-overlay text-fg-subtle hover:text-blue-400" title="New folder"><FolderPlus size={10}/></button>
          </div>
        )}
      </div>
      {open && (
        <div>
          {addingIn?.folder === name && (
            <InlineInput type={addingIn.type} depth={depth+1}
              onConfirm={n => onAddConfirm(n, name)} onCancel={onAddCancel}/>
          )}
          {children.map(([k,v]) => (
            <TreeNode key={k} name={k} node={v} depth={depth+1}
              onFileClick={onFileClick} activeFile={activeFile}
              onAddFile={onAddFile} onAddFolder={onAddFolder}
              addingIn={addingIn} onAddConfirm={onAddConfirm} onAddCancel={onAddCancel}/>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Live Preview ──────────────────────────────────────────────────────────────
function LivePreview({ tabs }) {
  const [src, setSrc] = useState('')
  const build = useCallback(() => {
    const htmlTab = tabs.find(t => /\.(html|htm)$/.test(t.path))
    if (!htmlTab) return setSrc('')
    let html = htmlTab.content || ''
    tabs.filter(t => t.path.endsWith('.css')).forEach(css => {
      html = html.replace(new RegExp(`<link[^>]*href=["']${css.path.split('/').pop()}["'][^>]*>`, 'g'), `<style>${css.content}</style>`)
    })
    tabs.filter(t => t.path.endsWith('.js') && !t.path.endsWith('.jsx')).forEach(js => {
      html = html.replace(new RegExp(`<script[^>]*src=["']${js.path.split('/').pop()}["'][^>]*><\\/script>`, 'g'), `<script>${js.content}</script>`)
    })
    tabs.filter(t => t.path.endsWith('.jsx')).forEach(jsx => {
      html = html.replace(new RegExp(`<script[^>]*src=["']${jsx.path.split('/').pop()}["'][^>]*><\\/script>`, 'g'), `<script type="text/babel">${jsx.content}</script>`)
    })
    const url = URL.createObjectURL(new Blob([html], { type:'text/html' }))
    setSrc(prev => { if (prev) URL.revokeObjectURL(prev); return url })
  }, [tabs])
  useEffect(() => { build() }, [build])

  if (!tabs.some(t => /\.(html|htm)$/.test(t.path))) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-6 bg-canvas">
      <Eye size={28} className="text-fg-subtle"/>
      <p className="text-sm font-semibold">No HTML file open</p>
      <p className="text-xs text-fg-muted">Open an index.html to see preview</p>
    </div>
  )
  return (
    <div className="flex flex-col h-full bg-canvas">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-default border-b border-border shrink-0">
        <div className="flex gap-1"><div className="w-3 h-3 rounded-full bg-red-400"/><div className="w-3 h-3 rounded-full bg-yellow-400"/><div className="w-3 h-3 rounded-full bg-green"/></div>
        <span className="text-[11px] text-fg-subtle flex-1 text-center">Live Preview</span>
        <button onClick={build} className="p-1 rounded hover:bg-subtle text-fg-subtle hover:text-green"><RefreshCw size={11}/></button>
      </div>
      {src ? <iframe src={src} className="flex-1 w-full border-0 bg-white" sandbox="allow-scripts allow-same-origin allow-modals" title="Live Preview"/>
           : <div className="flex-1 flex items-center justify-center text-xs text-fg-muted"><Loader2 size={14} className="animate-spin mr-2 text-green"/>Building...</div>}
    </div>
  )
}

// ── Main IDE ──────────────────────────────────────────────────────────────────
export default function IDE({ token, onLogout }) {
  const [user,          setUser]          = useState(null)
  const [repoUrl,       setRepoUrl]       = useState('')
  const [repo,          setRepo]          = useState(JSON.parse(localStorage.getItem('devflow_repo')||'null'))
  const [ghFiles,       setGhFiles]       = useState([])
  const [openTabs,      setOpenTabs]      = useState([])
  const [activeTab,     setActiveTab]     = useState(null)
  const [activePanel,   setActivePanel]   = useState('agent')
  const [panelOpen,     setPanelOpen]     = useState(true)
  const [showPreview,   setShowPreview]   = useState(false)
  const [connecting,    setConnecting]    = useState(false)
  const [loadingTree,   setLoadingTree]   = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [pushing,       setPushing]       = useState(false)
  const [status,        setStatus]        = useState('')
  const [addingIn,      setAddingIn]      = useState(null)
  const [showRootAdd,   setShowRootAdd]   = useState(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const editorRef = useRef(null)

  const activeTabData = openTabs.find(t => t.path === activeTab) || null
  const fileContent   = activeTabData?.content || ''
  const fileName      = activeTab?.split('/').pop() || ''
  const hasHtml       = openTabs.some(t => /\.(html|htm)$/.test(t.path))
  const unsavedCount  = openTabs.filter(t => t.unsaved).length
  const allFiles      = [...ghFiles, ...openTabs.filter(t => t.isNew && !ghFiles.find(g => g.path===t.path)).map(t => ({path:t.path}))]
  const tree          = buildTree(allFiles)

  useEffect(() => { getMe().then(setUser).catch(()=>{}) }, [])
  useEffect(() => { if (repo) loadTree() }, [repo])

  const showStatus = (msg, ms=3000) => { setStatus(msg); setTimeout(()=>setStatus(''), ms) }

  const loadTree = async () => {
    if (!repo) return
    setLoadingTree(true)
    try { const {files:f} = await getFileTree(repo.owner, repo.repo, repo.defaultBranch); setGhFiles(f||[]) }
    catch(e) { showStatus('Error: '+e.message) }
    setLoadingTree(false)
  }

  const connectRepoHandler = async () => {
    if (!repoUrl.trim()) return
    setConnecting(true)
    try {
      const r = await connectRepo(repoUrl)
      setRepo(r); localStorage.setItem('devflow_repo', JSON.stringify(r))
      setRepoUrl(''); showStatus(`✓ Connected: ${r.fullName}`)
    } catch(e) { showStatus('Error: '+(e.response?.data?.error||e.message)) }
    setConnecting(false)
  }

  const addTab = (path, content='', sha=null, isNew=true) => {
    setOpenTabs(prev => {
      if (prev.find(t => t.path===path)) { setActiveTab(path); return prev }
      return [...prev, { path, content, sha, unsaved:isNew, isNew }]
    })
    setActiveTab(path)
  }

  const openGhFile = async (file) => {
    if (openTabs.find(t => t.path===file.path)) { setActiveTab(file.path); return }
    try {
      const { content, sha } = await getFile(repo.owner, repo.repo, file.path, repo.defaultBranch)
      addTab(file.path, content, sha, false)
    } catch(e) { showStatus('Error: '+e.message) }
  }

  const handleFileClick = (file) => {
    if (ghFiles.find(g => g.path===file.path)) openGhFile(file)
    else addTab(file.path, openTabs.find(t => t.path===file.path)?.content||'')
  }

  const handleEditorChange = (val) => {
    if (!activeTab) return
    setOpenTabs(prev => prev.map(t => t.path===activeTab ? {...t, content:val||'', unsaved:true} : t))
  }

  const applyToEditor = (code) => {
    if (!activeTab) { showStatus('Open a file first'); return }
    setOpenTabs(prev => prev.map(t => t.path===activeTab ? {...t, content:code, unsaved:true} : t))
    showStatus('✓ Applied to '+fileName)
    editorRef.current?.focus()
  }

  const applyBugFix = (newContent) => {
    if (!activeTab || !newContent) return
    setOpenTabs(prev => prev.map(t => t.path===activeTab ? {...t, content:newContent, unsaved:true} : t))
    showStatus('✓ Bug fix applied to '+fileName)
  }

  const saveCurrentFile = async () => {
    if (!activeTabData || !repo || saving) return
    setSaving(true)
    try {
      const { sha } = await saveFile(repo.owner, repo.repo, activeTabData.path, activeTabData.content, activeTabData.sha, `Update ${activeTabData.path} via DevFlow AI`)
      setOpenTabs(prev => prev.map(t => t.path===activeTab ? {...t, sha, unsaved:false, isNew:false} : t))
      showStatus(`✓ Saved: ${activeTabData.path}`); loadTree()
    } catch(e) { showStatus('Save error: '+(e.response?.data?.error||e.message)) }
    setSaving(false)
  }

  useEffect(() => {
    const h = e => { if ((e.ctrlKey||e.metaKey)&&e.key==='s') { e.preventDefault(); saveCurrentFile() } }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [activeTabData, saving])

  const closeTab = (e, path) => {
    e.stopPropagation()
    const tab = openTabs.find(t => t.path===path)
    if (tab?.unsaved && !window.confirm('Unsaved changes. Close anyway?')) return
    const remaining = openTabs.filter(t => t.path!==path)
    setOpenTabs(remaining)
    if (activeTab===path) setActiveTab(remaining.at(-1)?.path||null)
  }

  const pushAllToGitHub = async () => {
    const toSave = openTabs.filter(t => t.unsaved)
    if (!toSave.length) { showStatus('Nothing to push'); return }
    if (!repo) { showStatus('Connect a repo first'); return }
    setPushing(true); let saved=0, failed=0
    for (const tab of toSave) {
      try {
        const { sha } = await saveFile(repo.owner, repo.repo, tab.path, tab.content, tab.sha, tab.isNew?`Add ${tab.path}`:`Update ${tab.path}`)
        setOpenTabs(prev => prev.map(t => t.path===tab.path ? {...t, sha, unsaved:false, isNew:false} : t))
        saved++
      } catch(e) { failed++; console.error(tab.path, e.message) }
    }
    showStatus(`✓ Pushed ${saved} file${saved!==1?'s':''}${failed?` (${failed} failed)`:''}`)
    loadTree(); setPushing(false)
  }

  const loadBoilerplateFiles = (result) => {
    if (!result?.files?.length) return
    const newTabs = result.files.filter(f => f.path && f.content!==undefined).map(f => ({path:f.path, content:f.content, sha:null, unsaved:true, isNew:true}))
    if (newTabs.length) {
      setOpenTabs(prev => { const ex=prev.filter(t=>!newTabs.find(n=>n.path===t.path)); return [...ex,...newTabs] })
      setActiveTab(newTabs[0].path)
      showStatus(`✓ ${newTabs.length} files loaded`)
    }
  }

  const loadTemplate = (name) => {
    const tpl = TEMPLATES[name]; if (!tpl) return
    const newTabs = tpl.files.map(f => ({path:f.path, content:f.content, sha:null, unsaved:true, isNew:true}))
    setOpenTabs(prev => { const ex=prev.filter(t=>!newTabs.find(n=>n.path===t.path)); return [...ex,...newTabs] })
    setActiveTab(newTabs[0].path); setShowTemplates(false)
    showStatus(`✓ ${name} loaded — ${newTabs.length} files ready`)
  }

  const createEntry = (name, parent, type) => {
    if (!name?.trim()) return
    const path = parent ? `${parent}/${name}` : name
    addTab(type==='folder' ? `${path}/.gitkeep` : path, '', null, true)
    setAddingIn(null); setShowRootAdd(null)
  }

  const disconnectRepo = () => {
    setRepo(null); setGhFiles([]); localStorage.removeItem('devflow_repo'); showStatus('Disconnected')
  }

  return (
    <div className="flex flex-col h-screen bg-canvas font-poppins overflow-hidden">

      {/* ── TOP BAR ── */}
      <header className="flex items-center gap-2 px-3 py-1.5 bg-default border-b border-border shrink-0 z-10">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{background:'linear-gradient(135deg,#238636,#1a7f37)',boxShadow:'0 0 10px rgba(63,185,80,0.35)'}}>
            <Zap size={14} color="#fff" fill="#fff"/>
          </div>
          <span className="font-bold text-sm hidden sm:block">DevNex Code <span className="text-green">-Editor</span></span>
        </div>

        <div className="w-px h-5 bg-border mx-1 hidden sm:block"/>

        <button onClick={() => setShowTemplates(v=>!v)} className="btn-green text-xs py-1.5 shrink-0">
          <Plus size={12}/> New Project
        </button>

        {!repo ? (
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <input className="input-field text-xs py-1.5 flex-1" placeholder="GitHub repo URL"
              value={repoUrl} onChange={e=>setRepoUrl(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&connectRepoHandler()}/>
            <button onClick={connectRepoHandler} disabled={connecting||!repoUrl.trim()}
              className="btn-secondary text-xs py-1.5 shrink-0 disabled:opacity-40">
              {connecting?<Loader2 size={12} className="animate-spin"/>:<FolderGit2 size={12}/>}
              Connect
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-green/10 border border-green/25">
              <Github size={11} className="text-green"/>
              <span className="text-xs font-medium text-green">{repo.fullName}</span>
            </div>
            <button onClick={loadTree} className="btn-ghost py-1 px-1.5"><RefreshCw size={11}/></button>
            <button onClick={disconnectRepo} className="btn-ghost py-1 px-1.5 hover:text-red-400"><X size={11}/></button>
          </div>
        )}

        {status && (
          <span className={`text-xs px-2 py-0.5 rounded-full border animate-fade-in shrink-0 hidden sm:block
            ${status.startsWith('✓') ? 'text-green bg-green/10 border-green/25'
            : status.startsWith('Error') ? 'text-red-400 bg-red-400/10 border-red-400/25'
            : 'text-fg-muted bg-subtle border-border'}`}>
            {status}
          </span>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {hasHtml && (
            <button onClick={() => setShowPreview(v=>!v)}
              className={`btn-secondary text-xs py-1.5 ${showPreview?'text-green border-green/40':''}`}>
              {showPreview ? <EyeOff size={12}/> : <Eye size={12}/>}
              Preview
            </button>
          )}
          {activeTabData && (
            <button onClick={saveCurrentFile} disabled={saving||!activeTabData.unsaved||!repo}
              className="btn-secondary text-xs py-1.5 disabled:opacity-40" title={!repo?'Connect a repo to save':'Ctrl+S'}>
              {saving?<Loader2 size={12} className="animate-spin"/>:<Save size={12}/>}
              {saving?'Saving...':activeTabData.unsaved?'Save*':'Saved'}
            </button>
          )}
          {unsavedCount>0 && repo && (
            <button onClick={pushAllToGitHub} disabled={pushing} className="btn-green text-xs py-1.5 disabled:opacity-40">
              {pushing?<Loader2 size={12} className="animate-spin"/>:<Upload size={12}/>}
              {pushing?'Pushing...':`Push ${unsavedCount}`}
            </button>
          )}
          {user && (
            <div className="flex items-center gap-1.5 pl-2 border-l border-border">
              <img src={user.avatar} alt="" className="w-6 h-6 rounded-full border border-border"/>
              <span className="text-xs text-fg-muted hidden sm:block">{user.login}</span>
            </div>
          )}
          <button onClick={onLogout} className="btn-ghost p-1.5 hover:text-red-400"><LogOut size={13}/></button>
        </div>
      </header>

      {/* Templates dropdown */}
      {showTemplates && (
        <div className="absolute top-12 left-3 z-50 w-72 bg-default border border-border rounded-xl shadow-2xl overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between px-4 py-3 bg-subtle border-b border-border">
            <span className="text-sm font-semibold">New Project</span>
            <button onClick={() => setShowTemplates(false)} className="btn-ghost p-0.5"><X size={13}/></button>
          </div>
          <div className="p-2">
            {Object.entries(TEMPLATES).map(([name, tpl]) => (
              <button key={name} onClick={() => loadTemplate(name)}
                className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-subtle transition-all text-left">
                <span className="text-xl shrink-0">{tpl.icon}</span>
                <div>
                  <div className="text-sm font-medium text-fg-default">{name}</div>
                  <div className="text-xs text-fg-muted">{tpl.desc}</div>
                  <div className="text-[10px] text-fg-subtle mt-0.5">{tpl.files.length} files</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── MAIN BODY ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* FILE TREE */}
        <div className="w-48 shrink-0 border-r border-border bg-default flex flex-col overflow-hidden">
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border">
            <span className="text-[10px] font-semibold text-fg-subtle uppercase tracking-wider flex-1">Files</span>
            {loadingTree && <Loader2 size={10} className="animate-spin text-fg-subtle"/>}
            <button onClick={() => setShowRootAdd('file')}   className="p-0.5 rounded hover:bg-subtle text-fg-subtle hover:text-green"   title="New file"><FilePlus size={12}/></button>
            <button onClick={() => setShowRootAdd('folder')} className="p-0.5 rounded hover:bg-subtle text-fg-subtle hover:text-blue-400" title="New folder"><FolderPlus size={12}/></button>
          </div>
          <div className="flex-1 overflow-y-auto py-0.5">
            {showRootAdd && (
              <InlineInput type={showRootAdd} depth={0}
                onConfirm={n => createEntry(n, '', showRootAdd)}
                onCancel={() => setShowRootAdd(null)}/>
            )}
            {allFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 p-4 text-center">
                <Folder size={20} className="text-fg-subtle"/>
                <p className="text-[10px] text-fg-subtle leading-relaxed">Click "New Project" or connect a GitHub repo</p>
              </div>
            ) : (
              Object.entries(tree)
                .sort(([,a],[,b]) => (!!b.__file)-(!!a.__file))
                .map(([k,v]) => (
                  <TreeNode key={k} name={k} node={v} depth={0}
                    onFileClick={handleFileClick} activeFile={activeTab}
                    onAddFile={n => { setAddingIn({folder:n, type:'file'});   setShowRootAdd(null) }}
                    onAddFolder={n => { setAddingIn({folder:n, type:'folder'}); setShowRootAdd(null) }}
                    addingIn={addingIn}
                    onAddConfirm={(n,f) => createEntry(n, f, addingIn?.type)}
                    onAddCancel={() => setAddingIn(null)}/>
                ))
            )}
          </div>
        </div>

        {/* EDITOR */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center bg-default border-b border-border overflow-x-auto shrink-0" style={{minHeight:34}}>
            {openTabs.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-1.5">
                <span className="text-xs text-fg-subtle">Click "New Project" or open a file</span>
              </div>
            ) : openTabs.map(tab => (
              <div key={tab.path} onClick={() => setActiveTab(tab.path)}
                className={`flex items-center gap-1.5 px-3 py-1.5 cursor-pointer border-r border-border group transition-all shrink-0 max-w-[180px]
                  ${activeTab===tab.path ? 'bg-canvas text-fg-default border-t-2 border-t-green' : 'text-fg-muted hover:text-fg-default hover:bg-subtle'}`}>
                <FileIcon path={tab.path} size={9}/>
                <span className="text-xs truncate">{tab.path.split('/').pop()}</span>
                {tab.unsaved && <span className="w-1.5 h-1.5 rounded-full bg-green shrink-0 animate-pulse"/>}
                {tab.isNew   && <span className="text-[9px] text-yellow-400 font-medium shrink-0">NEW</span>}
                <button onClick={e=>closeTab(e,tab.path)} className="opacity-0 group-hover:opacity-100 hover:text-red-400 ml-0.5 shrink-0"><X size={10}/></button>
              </div>
            ))}
          </div>

          {/* Monaco + Preview */}
          <div className={`flex flex-1 overflow-hidden ${showPreview?'flex-row':''}`}>
            <div className={`flex flex-col overflow-hidden ${showPreview?'flex-1 border-r border-border':'flex-1'}`}>
              {activeTab ? (
                <Editor height="100%" language={getLang(activeTab)} value={fileContent}
                  onChange={handleEditorChange} theme="vs-dark"
                  onMount={e => { editorRef.current = e }}
                  options={{ fontSize:13, fontFamily:"'JetBrains Mono',monospace", minimap:{enabled:false},
                    scrollBeyondLastLine:false, wordWrap:'on', lineNumbers:'on', padding:{top:10},
                    smoothScrolling:true, cursorBlinking:'smooth', tabSize:2,
                    bracketPairColorization:{enabled:true}, quickSuggestions:true }}/>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-6 text-center p-8 bg-canvas">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{background:'linear-gradient(135deg,#238636,#1a7f37)',boxShadow:'0 0 28px rgba(63,185,80,0.3)'}}>
                    <Zap size={24} color="#fff" fill="#fff"/>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold mb-2">DevNex Code-Editor</h2>
                    <p className="text-xs text-fg-muted leading-relaxed">Click <strong>"New Project"</strong> or connect a GitHub repo</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
                    {Object.entries(TEMPLATES).slice(0,4).map(([n,t]) => (
                      <button key={n} onClick={() => loadTemplate(n)}
                        className="p-2.5 rounded-lg bg-subtle border border-border hover:border-green/40 transition-all text-left">
                        <div className="text-base mb-1">{t.icon}</div>
                        <div className="text-[10px] font-medium text-fg-muted">{n}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {showPreview && (
              <div className="w-1/2 shrink-0 overflow-hidden">
                <LivePreview tabs={openTabs}/>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANELS */}
        <div className="flex border-l border-border shrink-0">
          <div className="w-10 flex flex-col items-center py-3 gap-1 bg-default">
            {PANELS.map(p => (
              <button key={p.id}
                onClick={() => { setActivePanel(p.id); setPanelOpen(prev => activePanel===p.id ? !prev : true) }}
                title={p.label}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all
                  ${activePanel===p.id&&panelOpen ? `bg-subtle ${p.color}` : 'text-fg-subtle hover:bg-subtle hover:text-fg-default'}`}>
                {p.icon}
              </button>
            ))}
          </div>
          {panelOpen && (
            <div className="w-80 border-l border-border flex flex-col overflow-hidden bg-default">
              {activePanel==='agent'    && <AgentPanel fileContent={fileContent} fileName={fileName} filePath={activeTab} openTabs={openTabs} onFileUpdate={applyToEditor}/>}
              {activePanel==='copilot'  && <CoPilotPanel fileContent={fileContent} fileName={fileName} onLoadFiles={loadBoilerplateFiles} onCreateFile={n=>addTab(n,'',null,true)} onApplyCode={applyToEditor}/>}
              {activePanel==='bugs'     && <BugScannerPanel fileContent={fileContent} fileName={fileName} onApplyFix={applyBugFix}/>}
              {activePanel==='deploy'   && <DeployPanel owner={repo?.owner} repo={repo?.repo} branch={repo?.defaultBranch}/>}
              {activePanel==='pr'       && <PRReviewPanel owner={repo?.owner} repo={repo?.repo}/>}
              {activePanel==='terminal' && <TerminalPanel token={token}/>}
            </div>
          )}
        </div>
      </div>

      {/* STATUS BAR */}
      <div className="flex items-center px-3 h-5 border-t border-border text-[10px] text-white shrink-0" style={{background:'#238636'}}>
        <span className="font-semibold mr-2">DevNex</span>
        {repo && <span className="opacity-75 mr-2">{repo.fullName}</span>}
        {activeTab && <span className="opacity-75 truncate max-w-48">{activeTab}</span>}
        {activeTabData?.unsaved && <span className="ml-2 text-yellow-300">● unsaved</span>}
        {!repo && unsavedCount>0 && <span className="ml-2 text-yellow-300">● {unsavedCount} local (connect repo to push)</span>}
        {hasHtml && !showPreview && (
          <button onClick={() => setShowPreview(true)} className="ml-3 flex items-center gap-1 opacity-75 hover:opacity-100">
            <Play size={9}/> Preview
          </button>
        )}
        {unsavedCount>0 && repo && (
          <button onClick={pushAllToGitHub} disabled={pushing} className="ml-3 flex items-center gap-1 opacity-75 hover:opacity-100">
            <Upload size={9}/> Push {unsavedCount}
          </button>
        )}
        <span className="ml-auto opacity-70">{getLang(activeTab)}</span>
      </div>
    </div>
  )
}

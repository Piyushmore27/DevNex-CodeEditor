export const EXT_LANG = {
  js:'javascript', jsx:'javascript', ts:'typescript', tsx:'typescript',
  json:'json', md:'markdown', css:'css', html:'html', htm:'html',
  py:'python', sh:'shell', yml:'yaml', yaml:'yaml',
  txt:'plaintext', env:'plaintext', gitignore:'plaintext',
  vue:'html', php:'php', rb:'ruby', go:'go',
  java:'java', c:'c', cpp:'cpp', cs:'csharp', rs:'rust',
}

export const FILE_COLORS = {
  js:'#f7df1e', jsx:'#61dafb', ts:'#3178c6', tsx:'#61dafb',
  json:'#6b9f6b', md:'#8b949e', css:'#264de4', html:'#e34c26',
  py:'#3776ab', sh:'#4eaa25', yml:'#cb171e', yaml:'#cb171e',
  env:'#ecc94b', vue:'#42b883', php:'#777bb4', rb:'#cc342d',
  go:'#00acd7', rs:'#dea584',
}

export function getLang(path) {
  return EXT_LANG[path?.split('.').pop()?.toLowerCase()] || 'plaintext'
}

export function getFileColor(path) {
  return FILE_COLORS[path?.split('.').pop()?.toLowerCase()] || '#6e7681'
}

export function FileIcon(path, size = 10) {
  return `<span style="font-size:${size}px;color:${getFileColor(path)}">●</span>`;
}
export function buildTree(files) {
  const root = {}
  files.forEach(f => {
    const parts = f.path.split('/')
    let node = root
    parts.forEach((p, i) => {
      if (i === parts.length - 1) node[p] = { __file: f }
      else { if (!node[p]) node[p] = {}; node = node[p] }
    })
  })
  return root
}

export const TEMPLATES = {
  'HTML + CSS + JS': {
    icon: '🌐', desc: 'Simple web page — works in Live Preview',
    files: [
      { path:'index.html', content:`<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8"/>\n  <title>My App</title>\n  <link rel="stylesheet" href="style.css"/>\n</head>\n<body>\n  <div class="container">\n    <h1>Hello World 👋</h1>\n    <button id="btn">Click Me</button>\n  </div>\n  <script src="script.js"></script>\n</body>\n</html>` },
      { path:'style.css', content:`*{box-sizing:border-box;margin:0;padding:0}\nbody{font-family:'Segoe UI',sans-serif;background:#0d1117;color:#e6edf3;display:flex;align-items:center;justify-content:center;min-height:100vh}\n.container{text-align:center;padding:2rem}\nh1{font-size:2.5rem;margin-bottom:1.5rem;color:#3fb950}\nbutton{padding:.75rem 2rem;background:#238636;color:white;border:none;border-radius:6px;font-size:1rem;cursor:pointer}\nbutton:hover{background:#2ea043}` },
      { path:'script.js', content:`document.getElementById('btn').addEventListener('click',()=>alert('Button clicked!'))\nconsole.log('App loaded!')` },
    ],
  },
  'React (CDN)': {
    icon: '⚛️', desc: 'React via CDN — works in Live Preview',
    files: [
      { path:'index.html', content:`<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8"/>\n  <title>React App</title>\n  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>\n  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>\n  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>\n  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',sans-serif;background:#0d1117;color:#e6edf3}.app{max-width:500px;margin:4rem auto;padding:2rem;text-align:center}h1{color:#3fb950;margin-bottom:1rem}button{padding:.5rem 1.5rem;background:#238636;color:white;border:none;border-radius:6px;cursor:pointer;margin:.25rem}</style>\n</head>\n<body>\n  <div id="root"></div>\n  <script type="text/babel" src="App.jsx"></script>\n</body>\n</html>` },
      { path:'App.jsx', content:`function App(){\n  const [count,setCount]=React.useState(0)\n  return(\n    <div className="app">\n      <h1>⚛️ React App</h1>\n      <p>Count: <strong>{count}</strong></p>\n      <button onClick={()=>setCount(c=>c+1)}>+1</button>\n      <button onClick={()=>setCount(0)} style={{background:'#da3633'}}>Reset</button>\n    </div>\n  )\n}\nReactDOM.createRoot(document.getElementById('root')).render(<App/>)` },
    ],
  },
  'Node.js API': {
    icon: '🟢', desc: 'Express REST API — push to GitHub',
    files: [
      { path:'server.js', content:`const express=require('express')\nconst app=express()\nconst PORT=process.env.PORT||3000\napp.use(express.json())\nlet todos=[{id:1,text:'Learn Node.js',done:false}]\napp.get('/',(req,res)=>res.json({message:'API running!'}))\napp.get('/todos',(req,res)=>res.json(todos))\napp.post('/todos',(req,res)=>{const t={id:Date.now(),text:req.body.text,done:false};todos.push(t);res.status(201).json(t)})\napp.listen(PORT,()=>console.log('Server on port '+PORT))` },
      { path:'package.json', content:JSON.stringify({name:'my-api',version:'1.0.0',main:'server.js',scripts:{start:'node server.js',dev:'nodemon server.js'},dependencies:{express:'^4.18.2'},devDependencies:{nodemon:'^3.0.2'}},null,2) },
      { path:'.env.example', content:'PORT=3000\nNODE_ENV=development' },
      { path:'README.md', content:'# My API\n\n```bash\nnpm install\nnpm run dev\n```' },
    ],
  },
}

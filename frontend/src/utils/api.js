import axios from 'axios'

// All requests go to /api → Vite proxies to http://localhost:5000
const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL
})

// Attach JWT token to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('devflow_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-logout if token expired
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('devflow_token')
      localStorage.removeItem('devflow_repo')
      window.location.href = '/'
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const loginWithGitHub = () => {window.location.href = `${import.meta.env.VITE_BACKEND_URL}/auth/github` }
export const getMe           = ()  => api.get('/auth/me').then(r => r.data)

// ── Repo ──────────────────────────────────────────────────────────────────────
export const connectRepo  = (repoUrl)                               => api.post('/repo/connect', { repoUrl }).then(r => r.data)
export const getFileTree  = (owner, repo, branch)                   => api.get('/repo/tree',  { params: { owner, repo, branch } }).then(r => r.data)
export const getFile      = (owner, repo, path, branch)             => api.get('/repo/file',  { params: { owner, repo, path, branch } }).then(r => r.data)
export const saveFile     = (owner, repo, path, content, sha, msg)  => api.put('/repo/file',  { owner, repo, path, content, sha, message: msg }).then(r => r.data)

// ── AI ────────────────────────────────────────────────────────────────────────
export const aiChat         = (message, fileContent, fileName)                          => api.post('/ai/chat',        { message, fileContent, fileName }).then(r => r.data)
export const agentEditFile  = (instruction, fileContent, fileName, filePath, allFiles)  => api.post('/ai/agent',       { instruction, fileContent, fileName, filePath, allFiles }).then(r => r.data)
export const scanCode       = (code, fileName)                                           => api.post('/ai/scan',        { code, fileName }).then(r => r.data)
export const genBoilerplate = (description)                                              => api.post('/ai/boilerplate', { description }).then(r => r.data)

// ── Deploy ────────────────────────────────────────────────────────────────────
export const triggerDeploy     = (owner, repo, branch) => api.post('/deploy/trigger', { owner, repo, branch }).then(r => r.data)
export const getPipelineStatus = (owner, repo)         => api.get('/deploy/status',   { params: { owner, repo } }).then(r => r.data)
export const getRunLogs        = (owner, repo, runId)  => api.get(`/deploy/logs/${runId}`, { params: { owner, repo } }).then(r => r.data)

// ── Pull Requests ─────────────────────────────────────────────────────────────
export const listPRs   = (owner, repo)                          => api.get('/pr/list',                { params: { owner, repo } }).then(r => r.data)
export const getPRDiff = (owner, repo, prNumber)                => api.get(`/pr/diff/${prNumber}`,    { params: { owner, repo } }).then(r => r.data)
export const reviewPR  = (owner, repo, prNumber, post)          => api.post(`/pr/review/${prNumber}`, { postToGitHub: post }, { params: { owner, repo } }).then(r => r.data)
export const mergePR   = (owner, repo, prNumber, mergeMethod)   => api.post(`/pr/merge/${prNumber}`,  { mergeMethod },         { params: { owner, repo } }).then(r => r.data)

export default api

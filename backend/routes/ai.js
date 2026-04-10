const express = require('express')
const auth    = require('../middleware/auth')
const router  = express.Router()

function getGroq() {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not set in .env')
  const Groq = require('groq-sdk')
  return new Groq({ apiKey: process.env.GROQ_API_KEY })
}

async function ask(prompt, model = 'llama-3.3-70b-versatile', maxTokens = 2048) {
  const groq = getGroq()
  const r = await groq.chat.completions.create({
    model, max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  })
  return r.choices[0].message.content
}

// AI Agent — rewrites file directly
router.post('/agent', auth, async (req, res) => {
  const { instruction, fileContent, fileName, filePath, allFiles } = req.body
  try {
    const fileCtx = fileContent ? `Current file (${fileName}):\n\`\`\`\n${fileContent.slice(0, 3000)}\n\`\`\`` : ''
    const otherFiles = allFiles?.length ? `\nOther open files: ${allFiles.map(f => f.path).join(', ')}` : ''

    const prompt = `You are an expert AI coding agent. Follow the instruction and return ONLY the complete updated file content — no explanation, no markdown fences, just raw code.
${fileCtx}${otherFiles}
Instruction: ${instruction}
Write the complete file:`

    const result = await ask(prompt, 'llama-3.3-70b-versatile', 3000)
    const code = result.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim()
    res.json({ code, fileName, filePath })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Chat
router.post('/chat', auth, async (req, res) => {
  const { message, fileContent, fileName } = req.body
  try {
    const ctx = fileContent ? `\nCurrent file (${fileName}):\n\`\`\`\n${fileContent.slice(0, 2000)}\n\`\`\`` : ''
    const reply = await ask(`You are DevFlow AI, an expert developer assistant.\n${ctx}\nQuestion: ${message}`, 'llama-3.3-70b-versatile', 1500)
    res.json({ reply })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Bug scanner
router.post('/scan', auth, async (req, res) => {
  const { code, fileName = 'file' } = req.body
  try {
    const raw = await ask(`Analyze this code for bugs. Return ONLY valid JSON (no markdown):\n{"score":<0-100>,"summary":"<one line>","bugs":[{"line":<n>,"severity":"critical|warning|info","type":"<type>","message":"<description>","fix":"<fix code>"}],"security":["<issue>"],"suggestions":["<tip>"]}\nFile: ${fileName}\n${code}`)
    res.json(JSON.parse(raw.replace(/```json\n?|```\n?/g, '').trim()))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Boilerplate generator
router.post('/boilerplate', auth, async (req, res) => {
  const { description } = req.body
  try {
    const raw = await ask(`Generate a complete project for: "${description}". Return ONLY valid JSON:\n{"projectName":"<n>","description":"<what it does>","files":[{"path":"server.js","content":"<full content>"}],"setupInstructions":["npm install","npm start"]}`, 'llama-3.3-70b-versatile', 3000)
    res.json(JSON.parse(raw.replace(/```json\n?|```\n?/g, '').trim()))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router

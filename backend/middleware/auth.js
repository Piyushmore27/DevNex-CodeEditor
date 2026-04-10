const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'devflow_jwt_secret_change_this'

module.exports = function auth(req, res, next) {
  const header = req.headers.authorization

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' })
  }

  const token = header.slice(7).trim()

  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Token invalid or expired — please log in again' })
  }
}

import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'monkeyphone-secret-key-change-in-production'

export function generateToken(user) {
  return jwt.sign(
    { username: user.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录' })
  }

  const token = authHeader.slice(7)
  const decoded = verifyToken(token)

  if (!decoded) {
    return res.status(401).json({ error: 'Token 无效或已过期' })
  }

  req.user = decoded
  next()
}

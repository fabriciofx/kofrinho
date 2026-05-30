import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../utils/jwt.js'

export interface AuthRequest extends Request {
  userId?: number
  email?: string
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Token não fornecido' })
  }

  const token = authHeader.slice(7)
  const payload = verifyAccessToken(token)

  if (!payload) {
    return res.status(401).json({ erro: 'Token inválido ou expirado' })
  }

  req.userId = payload.id
  req.email = payload.email
  next()
}

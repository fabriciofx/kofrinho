import jwt from 'jsonwebtoken'
import { JwtPayload } from '../types/index.js'

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'kofrinho-access-secret-2026'
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'kofrinho-refresh-secret-2026'

export function generateAccessToken(userId: number, email: string): string {
  return jwt.sign(
    { id: userId, email },
    ACCESS_TOKEN_SECRET,
    { expiresIn: '2h' }
  )
}

export function generateRefreshToken(userId: number): string {
  return jwt.sign(
    { id: userId },
    REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' }
  )
}

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, ACCESS_TOKEN_SECRET) as JwtPayload
  } catch {
    return null
  }
}

export function verifyRefreshToken(token: string): { id: number } | null {
  try {
    return jwt.verify(token, REFRESH_TOKEN_SECRET) as { id: number }
  } catch {
    return null
  }
}

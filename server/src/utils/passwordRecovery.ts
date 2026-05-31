import crypto from 'crypto'

export interface ResetTokenPayload {
  token: string
  expiresAt: Date
}

export function generateResetToken(): ResetTokenPayload {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60) // 1 hour expiration

  return { token, expiresAt }
}

export function isResetTokenValid(expiresAt: string | Date | null | undefined): boolean {
  if (!expiresAt) return false

  const expirationDate = typeof expiresAt === 'string' 
    ? new Date(expiresAt) 
    : expiresAt

  return expirationDate > new Date()
}

export function validateResetTokenFormat(token: string): boolean {
  return /^[a-f0-9]{64}$/.test(token)
}

import { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken } from '../../utils/jwt.js'
import jwt from 'jsonwebtoken'

describe('JWT Utilities', () => {
  describe('generateAccessToken', () => {
    test('generates a valid JWT token', () => {
      const token = generateAccessToken(1, 'test@example.com')
      expect(typeof token).toBe('string')
      expect(token.split('.').length).toBe(3)
    })

    test('token contains user id in payload', () => {
      const userId = 42
      const token = generateAccessToken(userId, 'test@example.com')
      const decoded = jwt.decode(token) as any
      expect(decoded.id).toBe(userId)
    })

    test('token contains email in payload', () => {
      const email = 'user@example.com'
      const token = generateAccessToken(1, email)
      const decoded = jwt.decode(token) as any
      expect(decoded.email).toBe(email)
    })

    test('token has expiration claim', () => {
      const token = generateAccessToken(1, 'test@example.com')
      const decoded = jwt.decode(token) as any
      expect(decoded.exp).toBeDefined()
      expect(typeof decoded.exp).toBe('number')
    })

    test('different users get different tokens', () => {
      const token1 = generateAccessToken(1, 'user1@example.com')
      const token2 = generateAccessToken(2, 'user2@example.com')
      expect(token1).not.toBe(token2)
    })

    test('same user generates different tokens at different times', async () => {
      const token1 = generateAccessToken(1, 'test@example.com')
      await new Promise(resolve => setTimeout(resolve, 2000))
      const token2 = generateAccessToken(1, 'test@example.com')
      expect(token1).not.toBe(token2)
    })
  })

  describe('generateRefreshToken', () => {
    test('generates a valid JWT token', () => {
      const token = generateRefreshToken(1)
      expect(typeof token).toBe('string')
      expect(token.split('.').length).toBe(3)
    })

    test('token contains user id in payload', () => {
      const userId = 99
      const token = generateRefreshToken(userId)
      const decoded = jwt.decode(token) as any
      expect(decoded.id).toBe(userId)
    })

    test('token has expiration claim', () => {
      const token = generateRefreshToken(1)
      const decoded = jwt.decode(token) as any
      expect(decoded.exp).toBeDefined()
      expect(typeof decoded.exp).toBe('number')
    })

    test('different users get different tokens', () => {
      const token1 = generateRefreshToken(1)
      const token2 = generateRefreshToken(2)
      expect(token1).not.toBe(token2)
    })
  })

  describe('verifyAccessToken', () => {
    test('verifies valid access token', () => {
      const token = generateAccessToken(1, 'test@example.com')
      const payload = verifyAccessToken(token)
      expect(payload).not.toBeNull()
      expect(payload?.id).toBe(1)
      expect(payload?.email).toBe('test@example.com')
    })

    test('returns null for invalid token', () => {
      const payload = verifyAccessToken('invalid.token.here')
      expect(payload).toBeNull()
    })

    test('returns null for tampered token', () => {
      const token = generateAccessToken(1, 'test@example.com')
      const tampered = token.slice(0, -5) + 'XXXXX'
      const payload = verifyAccessToken(tampered)
      expect(payload).toBeNull()
    })

    test('returns null for empty token', () => {
      const payload = verifyAccessToken('')
      expect(payload).toBeNull()
    })

    test('returns null for refresh token (wrong secret)', () => {
      const refreshToken = generateRefreshToken(1)
      const payload = verifyAccessToken(refreshToken)
      expect(payload).toBeNull()
    })

    test('payload contains all expected fields', () => {
      const token = generateAccessToken(42, 'user@test.com')
      const payload = verifyAccessToken(token)
      expect(payload).toHaveProperty('id')
      expect(payload).toHaveProperty('email')
      expect(payload).toHaveProperty('iat')
      expect(payload).toHaveProperty('exp')
    })
  })

  describe('verifyRefreshToken', () => {
    test('verifies valid refresh token', () => {
      const token = generateRefreshToken(1)
      const payload = verifyRefreshToken(token)
      expect(payload).not.toBeNull()
      expect(payload?.id).toBe(1)
    })

    test('returns null for invalid token', () => {
      const payload = verifyRefreshToken('invalid.token.here')
      expect(payload).toBeNull()
    })

    test('returns null for tampered token', () => {
      const token = generateRefreshToken(1)
      const tampered = token.slice(0, -5) + 'XXXXX'
      const payload = verifyRefreshToken(tampered)
      expect(payload).toBeNull()
    })

    test('returns null for empty token', () => {
      const payload = verifyRefreshToken('')
      expect(payload).toBeNull()
    })

    test('returns null for access token (wrong secret)', () => {
      const accessToken = generateAccessToken(1, 'test@example.com')
      const payload = verifyRefreshToken(accessToken)
      expect(payload).toBeNull()
    })

    test('payload contains user id', () => {
      const token = generateRefreshToken(99)
      const payload = verifyRefreshToken(token)
      expect(payload?.id).toBe(99)
    })
  })

  describe('Token Pair Consistency', () => {
    test('refresh token and access token use different secrets', () => {
      const userId = 5
      const email = 'consistency@test.com'
      const accessToken = generateAccessToken(userId, email)
      const refreshToken = generateRefreshToken(userId)

      const accessPayload = verifyAccessToken(accessToken)
      const refreshPayload = verifyRefreshToken(refreshToken)

      expect(accessPayload?.id).toBe(userId)
      expect(refreshPayload?.id).toBe(userId)

      expect(verifyRefreshToken(accessToken)).toBeNull()
      expect(verifyAccessToken(refreshToken)).toBeNull()
    })
  })
})

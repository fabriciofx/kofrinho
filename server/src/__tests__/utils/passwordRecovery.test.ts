import { generateResetToken, isResetTokenValid, validateResetTokenFormat } from '../../utils/passwordRecovery.js'

describe('Password Recovery Utilities', () => {
  describe('generateResetToken', () => {
    test('generates 64-character hexadecimal token', () => {
      const { token } = generateResetToken()

      expect(token).toMatch(/^[a-f0-9]{64}$/)
    })

    test('generates unique tokens on each call', () => {
      const { token: token1 } = generateResetToken()
      const { token: token2 } = generateResetToken()

      expect(token1).not.toBe(token2)
    })

    test('sets expiration to 1 hour from now', () => {
      const { expiresAt } = generateResetToken()
      const nowTime = Date.now()
      const expirationTime = expiresAt.getTime()
      const diffMinutes = (expirationTime - nowTime) / 1000 / 60

      expect(diffMinutes).toBeGreaterThan(59)
      expect(diffMinutes).toBeLessThanOrEqual(60)
    })

    test('returns expiration as Date object', () => {
      const { expiresAt } = generateResetToken()

      expect(expiresAt).toBeInstanceOf(Date)
    })
  })

  describe('isResetTokenValid', () => {
    test('returns true for valid non-expired token expiration', () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60)

      expect(isResetTokenValid(futureDate)).toBe(true)
    })

    test('returns false for expired token expiration', () => {
      const pastDate = new Date(Date.now() - 1000 * 60 * 60)

      expect(isResetTokenValid(pastDate)).toBe(false)
    })

    test('returns false for null expiration', () => {
      expect(isResetTokenValid(null)).toBe(false)
    })

    test('returns false for undefined expiration', () => {
      expect(isResetTokenValid(undefined)).toBe(false)
    })

    test('handles string date format', () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60).toISOString()

      expect(isResetTokenValid(futureDate)).toBe(true)
    })

    test('handles expired string date format', () => {
      const pastDate = new Date(Date.now() - 1000 * 60 * 60).toISOString()

      expect(isResetTokenValid(pastDate)).toBe(false)
    })
  })

  describe('validateResetTokenFormat', () => {
    test('returns true for valid 64-char hex token', () => {
      const validToken = 'a'.repeat(64)

      expect(validateResetTokenFormat(validToken)).toBe(true)
    })
  })

  describe('validateResetTokenFormat', () => {
    test('returns true for valid 64-char hex token', () => {
      const validToken = 'a'.repeat(64)

      expect(validateResetTokenFormat(validToken)).toBe(true)
    })

    test('returns true for token with mixed hex characters', () => {
      const validToken = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'

      expect(validateResetTokenFormat(validToken)).toBe(true)
    })

    test('returns false for token with uppercase letters', () => {
      const invalidToken = 'A'.repeat(64)

      expect(validateResetTokenFormat(invalidToken)).toBe(false)
    })

    test('returns false for token with non-hex characters', () => {
      const invalidToken = 'z'.repeat(64)

      expect(validateResetTokenFormat(invalidToken)).toBe(false)
    })

    test('returns false for token shorter than 64 characters', () => {
      const invalidToken = 'a'.repeat(63)

      expect(validateResetTokenFormat(invalidToken)).toBe(false)
    })

    test('returns false for token longer than 64 characters', () => {
      const invalidToken = 'a'.repeat(65)

      expect(validateResetTokenFormat(invalidToken)).toBe(false)
    })

    test('returns false for empty string', () => {
      expect(validateResetTokenFormat('')).toBe(false)
    })
  })
})

import { hashPassword, verifyPassword, ARGON2_OPTIONS } from '../../utils/password.js'

describe('Password hashing (Argon2id)', () => {
  const senha = 'TestPassword@123'

  describe('ARGON2_OPTIONS', () => {
    test('uses Argon2id variant', () => {
      // argon2.argon2id === 2
      expect(ARGON2_OPTIONS.type).toBe(2)
    })

    test('uses memory cost of 64 MiB (65536 KiB)', () => {
      expect(ARGON2_OPTIONS.memoryCost).toBe(65536)
    })

    test('uses time cost of 3', () => {
      expect(ARGON2_OPTIONS.timeCost).toBe(3)
    })

    test('uses parallelism of 4', () => {
      expect(ARGON2_OPTIONS.parallelism).toBe(4)
    })
  })

  describe('hashPassword', () => {
    test('produces an Argon2id encoded hash', async () => {
      const hash = await hashPassword(senha)
      expect(hash.startsWith('$argon2id$')).toBe(true)
    })

    test('encodes the configured parameters in the hash string', async () => {
      const hash = await hashPassword(senha)
      // Formato: $argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>
      expect(hash).toContain('m=65536')
      expect(hash).toContain('t=3')
      expect(hash).toContain('p=4')
    })

    test('never returns the plaintext password', async () => {
      const hash = await hashPassword(senha)
      expect(hash).not.toBe(senha)
      expect(hash).not.toContain(senha)
    })

    test('produces a different hash each time (random salt)', async () => {
      const hash1 = await hashPassword(senha)
      const hash2 = await hashPassword(senha)
      expect(hash1).not.toBe(hash2)
    })

    test('is not a bcrypt hash', async () => {
      const hash = await hashPassword(senha)
      expect(hash.startsWith('$2')).toBe(false)
    })
  })

  describe('verifyPassword', () => {
    test('returns true for the correct password', async () => {
      const hash = await hashPassword(senha)
      expect(await verifyPassword(hash, senha)).toBe(true)
    })

    test('returns false for an incorrect password', async () => {
      const hash = await hashPassword(senha)
      expect(await verifyPassword(hash, 'WrongPassword@456')).toBe(false)
    })

    test('returns false for an empty stored hash', async () => {
      expect(await verifyPassword('', senha)).toBe(false)
    })

    test('returns false for a malformed hash instead of throwing', async () => {
      expect(await verifyPassword('not-a-valid-hash', senha)).toBe(false)
    })

    test('is case sensitive', async () => {
      const hash = await hashPassword(senha)
      expect(await verifyPassword(hash, senha.toLowerCase())).toBe(false)
    })

    test('round-trips Unicode passwords', async () => {
      const unicode = 'Sénhâ-ção@2024-🔐'
      const hash = await hashPassword(unicode)
      expect(await verifyPassword(hash, unicode)).toBe(true)
    })
  })
})

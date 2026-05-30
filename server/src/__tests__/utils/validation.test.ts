import { isValidEmail, isValidPassword, getPasswordValidationErrors } from '../../utils/validation.js'
import { validPasswords, invalidEmails, weakPasswords } from '../setup/fixtures.js'

describe('Validation Utilities', () => {
  describe('isValidEmail', () => {
    test('accepts valid email addresses', () => {
      const validEmails = [
        'user@example.com',
        'test.email@domain.co.uk',
        'name+tag@subdomain.example.com',
        'a@b.co',
      ]
      validEmails.forEach(email => {
        expect(isValidEmail(email)).toBe(true)
      })
    })

    test('rejects email without @ symbol', () => {
      expect(isValidEmail('notanemail')).toBe(false)
    })

    test('rejects email without domain', () => {
      expect(isValidEmail('missing@')).toBe(false)
    })

    test('rejects email without local part', () => {
      expect(isValidEmail('@nodomain.com')).toBe(false)
    })

    test('rejects email with spaces', () => {
      expect(isValidEmail('spaces in@email.com')).toBe(false)
    })

    test('rejects email with double @', () => {
      expect(isValidEmail('double@@domain.com')).toBe(false)
    })

    test('rejects empty email', () => {
      expect(isValidEmail('')).toBe(false)
    })

    test('rejects email longer than 255 characters', () => {
      const longEmail = 'a'.repeat(250) + '@example.com'
      expect(isValidEmail(longEmail)).toBe(false)
    })

    test('accepts all predefined invalid emails as invalid', () => {
      invalidEmails.forEach(email => {
        const result = isValidEmail(email)
        expect(result).toBe(false)
      })
    })
  })

  describe('isValidPassword', () => {
    test('accepts passwords meeting all requirements', () => {
      validPasswords.forEach(password => {
        expect(isValidPassword(password)).toBe(true)
      })
    })

    test('rejects password without uppercase letter', () => {
      expect(isValidPassword('testpass@123')).toBe(false)
    })

    test('rejects password without lowercase letter', () => {
      expect(isValidPassword('TESTPASS@123')).toBe(false)
    })

    test('rejects password without number', () => {
      expect(isValidPassword('TestPass@')).toBe(false)
    })

    test('rejects password without special character', () => {
      expect(isValidPassword('TestPass123')).toBe(false)
    })

    test('rejects password shorter than 8 characters', () => {
      expect(isValidPassword('Test@12')).toBe(false)
    })

    test('rejects empty password', () => {
      expect(isValidPassword('')).toBe(false)
    })

    test('accepts password with exactly 8 characters meeting all requirements', () => {
      expect(isValidPassword('Test@123')).toBe(true)
    })

    test('accepts very long password meeting all requirements', () => {
      expect(isValidPassword('Test@123' + 'a'.repeat(100))).toBe(true)
    })
  })

  describe('getPasswordValidationErrors', () => {
    test('returns empty array for valid password', () => {
      expect(getPasswordValidationErrors('TestPassword@123')).toEqual([])
    })

    test('returns error for missing uppercase', () => {
      const errors = getPasswordValidationErrors('testpass@123')
      expect(errors).toContain('Pelo menos uma letra maiúscula')
    })

    test('returns error for missing lowercase', () => {
      const errors = getPasswordValidationErrors('TESTPASS@123')
      expect(errors).toContain('Pelo menos uma letra minúscula')
    })

    test('returns error for missing number', () => {
      const errors = getPasswordValidationErrors('TestPass@')
      expect(errors).toContain('Pelo menos um número')
    })

    test('returns error for missing special character', () => {
      const errors = getPasswordValidationErrors('TestPass123')
      expect(errors).toContain('Pelo menos um caractere especial (!@#$%^&*)')
    })

    test('returns error for insufficient length', () => {
      const errors = getPasswordValidationErrors('Test@12')
      expect(errors).toContain('Mínimo 8 caracteres')
    })

    test('returns multiple errors for very weak password', () => {
      const errors = getPasswordValidationErrors('test')
      expect(errors.length).toBeGreaterThan(2)
    })

    test('all weak password fixtures return appropriate errors', () => {
      weakPasswords.forEach(({ value, missingRequirement }) => {
        const errors = getPasswordValidationErrors(value)
        expect(errors.length).toBeGreaterThan(0)
      })
    })

    test('error messages are non-empty strings', () => {
      const errors = getPasswordValidationErrors('a')
      expect(errors.every(e => typeof e === 'string' && e.length > 0)).toBe(true)
    })
  })
})

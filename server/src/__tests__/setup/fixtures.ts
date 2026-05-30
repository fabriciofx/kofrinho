import { randomBytes } from 'crypto'

function randomString(length: number = 10): string {
  return randomBytes(length).toString('hex').slice(0, length)
}

export function randomEmail(): string {
  const timestamp = Date.now()
  const random = randomString(8)
  return `test-${timestamp}-${random}@example.com`
}

export function createValidUser() {
  return {
    nome_completo: `Usuário ${randomString(6)}`,
    email: randomEmail(),
    senha: 'TestPassword@123',
  }
}

export function createValidLogin(user: { email: string; senha: string }) {
  return {
    email: user.email,
    senha: user.senha,
  }
}

export const validPasswords = [
  'TestPassword@123',
  'SecurePass#999',
  'MyP@ssw0rd',
  'Correct$Horse123',
  'Complex!Pass2024',
  'Strong@Secure99',
  'ValidPwd#567',
  'Pass@word8901',
]

export const invalidEmails = [
  'notanemail',
  'missing@domain',
  '@nodomain.com',
  'spaces in@email.com',
  'double@@domain.com',
  'a@b',
  '',
]

export const weakPasswords = [
  { value: 'test1234', missingRequirement: 'uppercase' },
  { value: 'TEST1234', missingRequirement: 'lowercase' },
  { value: 'TestTest', missingRequirement: 'number' },
  { value: 'Test123', missingRequirement: 'special character' },
  { value: 'Abc@12', missingRequirement: 'minimum length (8)' },
  { value: 'test', missingRequirement: 'all' },
  { value: '', missingRequirement: 'all' },
]

export const registrationPayloads = {
  valid: {
    nome_completo: 'João Silva',
    email: randomEmail(),
    senha: 'TestPassword@123',
  },
  missingNome: {
    email: randomEmail(),
    senha: 'TestPassword@123',
  },
  missingEmail: {
    nome_completo: 'João Silva',
    senha: 'TestPassword@123',
  },
  missingSenha: {
    nome_completo: 'João Silva',
    email: randomEmail(),
  },
  invalidEmail: {
    nome_completo: 'João Silva',
    email: 'invalid-email',
    senha: 'TestPassword@123',
  },
  weakPassword: {
    nome_completo: 'João Silva',
    email: randomEmail(),
    senha: 'weakpass',
  },
}

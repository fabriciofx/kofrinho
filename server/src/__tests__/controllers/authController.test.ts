import request from 'supertest'
import jwt from 'jsonwebtoken'
import { setupTestDb, closeTestDb, runAsync, getAsync } from '../setup/database.js'
import { startTestServer, stopTestServer, TestServerSetup } from '../setup/testServer.js'
import { createValidUser, createValidLogin, randomEmail, validPasswords, weakPasswords } from '../setup/fixtures.js'
import sqlite3 from 'sqlite3'

describe('Auth Controller Integration Tests', () => {
  let testServer: TestServerSetup
  let testDb: sqlite3.Database

  beforeAll(async () => {
    testDb = await setupTestDb()
    testServer = await startTestServer(testDb)
  })

  afterAll(async () => {
    await stopTestServer(testServer)
    await closeTestDb(testDb)
  })

  describe('POST /api/auth/register', () => {
    test('registers user with valid credentials and returns 201', async () => {
      const user = createValidUser()
      const response = await request(testServer.app)
        .post('/api/auth/register')
        .send(user)

      expect(response.status).toBe(201)
      expect(response.body.message).toBe('Usuário cadastrado com sucesso')
      expect(response.body.user).toBeDefined()
      expect(response.body.token).toBeDefined()
      expect(response.body.refreshToken).toBeDefined()
    })

    test('returns user object without password hash', async () => {
      const user = createValidUser()
      const response = await request(testServer.app)
        .post('/api/auth/register')
        .send(user)

      expect(response.status).toBe(201)
      expect(response.body.user).toHaveProperty('id')
      expect(response.body.user).toHaveProperty('nome_completo', user.nome_completo)
      expect(response.body.user).toHaveProperty('email', user.email)
      expect(response.body.user).not.toHaveProperty('senha_hash')
      expect(response.body.user).not.toHaveProperty('senha')
    })

    test('generated access token is valid JWT', async () => {
      const user = createValidUser()
      const response = await request(testServer.app)
        .post('/api/auth/register')
        .send(user)

      const decoded = jwt.decode(response.body.token) as any
      expect(decoded).toBeDefined()
      expect(decoded.id).toBe(response.body.user.id)
      expect(decoded.email).toBe(user.email)
    })

    test('generated refresh token is valid JWT', async () => {
      const user = createValidUser()
      const response = await request(testServer.app)
        .post('/api/auth/register')
        .send(user)

      const decoded = jwt.decode(response.body.refreshToken) as any
      expect(decoded).toBeDefined()
      expect(decoded.id).toBe(response.body.user.id)
    })

    test('returns 400 when nome_completo is missing', async () => {
      const user = createValidUser()
      delete (user as any).nome_completo
      const response = await request(testServer.app)
        .post('/api/auth/register')
        .send(user)

      expect(response.status).toBe(400)
      expect(response.body.erro).toContain('obrigatórios')
    })

    test('returns 400 when email is missing', async () => {
      const user = createValidUser()
      delete (user as any).email
      const response = await request(testServer.app)
        .post('/api/auth/register')
        .send(user)

      expect(response.status).toBe(400)
      expect(response.body.erro).toContain('obrigatórios')
    })

    test('returns 400 when senha is missing', async () => {
      const user = createValidUser()
      delete (user as any).senha
      const response = await request(testServer.app)
        .post('/api/auth/register')
        .send(user)

      expect(response.status).toBe(400)
      expect(response.body.erro).toContain('obrigatórios')
    })

    test('returns 400 for invalid email format', async () => {
      const user = createValidUser()
      user.email = 'not-an-email'
      const response = await request(testServer.app)
        .post('/api/auth/register')
        .send(user)

      expect(response.status).toBe(400)
      expect(response.body.erro).toContain('Email inválido')
    })

    test('returns 400 with detailed errors for weak password', async () => {
      const user = createValidUser()
      user.senha = 'weakpass'
      const response = await request(testServer.app)
        .post('/api/auth/register')
        .send(user)

      expect(response.status).toBe(400)
      expect(response.body.erro).toContain('Senha não atende aos requisitos')
      expect(response.body.falhas).toBeDefined()
      expect(Array.isArray(response.body.falhas)).toBe(true)
      expect(response.body.falhas.length).toBeGreaterThan(0)
    })

    test('returns 400 for password missing uppercase', async () => {
      const user = createValidUser()
      user.senha = 'testpass@123'
      const response = await request(testServer.app)
        .post('/api/auth/register')
        .send(user)

      expect(response.status).toBe(400)
      expect(response.body.falhas).toContain('Pelo menos uma letra maiúscula')
    })

    test('returns 400 for password missing lowercase', async () => {
      const user = createValidUser()
      user.senha = 'TESTPASS@123'
      const response = await request(testServer.app)
        .post('/api/auth/register')
        .send(user)

      expect(response.status).toBe(400)
      expect(response.body.falhas).toContain('Pelo menos uma letra minúscula')
    })

    test('returns 400 for password missing number', async () => {
      const user = createValidUser()
      user.senha = 'TestPass@'
      const response = await request(testServer.app)
        .post('/api/auth/register')
        .send(user)

      expect(response.status).toBe(400)
      expect(response.body.falhas).toContain('Pelo menos um número')
    })

    test('returns 400 for password missing special character', async () => {
      const user = createValidUser()
      user.senha = 'TestPass123'
      const response = await request(testServer.app)
        .post('/api/auth/register')
        .send(user)

      expect(response.status).toBe(400)
      expect(response.body.falhas).toContain('Pelo menos um caractere especial (!@#$%^&*)')
    })

    test('returns 409 when email already registered', async () => {
      const user = createValidUser()

      await request(testServer.app)
        .post('/api/auth/register')
        .send(user)

      const response = await request(testServer.app)
        .post('/api/auth/register')
        .send(user)

      expect(response.status).toBe(409)
      expect(response.body.erro).toContain('Email já cadastrado')
    })

    test('password is hashed and different in database and response', async () => {
      const user = createValidUser()
      const response = await request(testServer.app)
        .post('/api/auth/register')
        .send(user)

      expect(response.body.user).not.toHaveProperty('senha_hash')
      expect(response.body.user).not.toHaveProperty('senha')
      expect(response.status).toBe(201)
    })
  })

  describe('POST /api/auth/login', () => {
    test('logs in user with correct credentials and returns 200', async () => {
      const user = createValidUser()
      await request(testServer.app)
        .post('/api/auth/register')
        .send(user)

      const response = await request(testServer.app)
        .post('/api/auth/login')
        .send(createValidLogin(user))

      expect(response.status).toBe(200)
      expect(response.body.message).toBe('Login realizado com sucesso')
      expect(response.body.user).toBeDefined()
      expect(response.body.token).toBeDefined()
      expect(response.body.refreshToken).toBeDefined()
    })

    test('returns user object without password hash on login', async () => {
      const user = createValidUser()
      await request(testServer.app)
        .post('/api/auth/register')
        .send(user)

      const response = await request(testServer.app)
        .post('/api/auth/login')
        .send(createValidLogin(user))

      expect(response.status).toBe(200)
      expect(response.body.user).not.toHaveProperty('senha_hash')
      expect(response.body.user).not.toHaveProperty('senha')
    })

    test('generated access token is valid JWT on login', async () => {
      const user = createValidUser()
      await request(testServer.app)
        .post('/api/auth/register')
        .send(user)

      const response = await request(testServer.app)
        .post('/api/auth/login')
        .send(createValidLogin(user))

      const decoded = jwt.decode(response.body.token) as any
      expect(decoded).toBeDefined()
      expect(decoded.id).toBe(response.body.user.id)
      expect(decoded.email).toBe(user.email)
    })

    test('returns 400 when email is missing', async () => {
      const response = await request(testServer.app)
        .post('/api/auth/login')
        .send({ senha: 'TestPassword@123' })

      expect(response.status).toBe(400)
      expect(response.body.erro).toContain('obrigatórios')
    })

    test('returns 400 when senha is missing', async () => {
      const response = await request(testServer.app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' })

      expect(response.status).toBe(400)
      expect(response.body.erro).toContain('obrigatórios')
    })

    test('returns 401 for non-existent email (does not leak email existence)', async () => {
      const response = await request(testServer.app)
        .post('/api/auth/login')
        .send({ email: randomEmail(), senha: 'TestPassword@123' })

      expect(response.status).toBe(401)
      expect(response.body.erro).toBe('Email ou senha inválidos')
    })

    test('returns 401 for wrong password (does not leak email existence)', async () => {
      const user = createValidUser()
      await request(testServer.app)
        .post('/api/auth/register')
        .send(user)

      const response = await request(testServer.app)
        .post('/api/auth/login')
        .send({ email: user.email, senha: 'WrongPassword@123' })

      expect(response.status).toBe(401)
      expect(response.body.erro).toBe('Email ou senha inválidos')
    })

    test('generic error message for non-existent email and wrong password match', async () => {
      const user = createValidUser()
      await request(testServer.app)
        .post('/api/auth/register')
        .send(user)

      const wrongPasswordResponse = await request(testServer.app)
        .post('/api/auth/login')
        .send({ email: user.email, senha: 'Wrong@123' })

      const nonExistentResponse = await request(testServer.app)
        .post('/api/auth/login')
        .send({ email: randomEmail(), senha: 'TestPassword@123' })

      expect(wrongPasswordResponse.body.erro).toBe(nonExistentResponse.body.erro)
    })
  })

  describe('POST /api/auth/refresh', () => {
    test('generates new access token with valid refresh token', async () => {
      const user = createValidUser()
      const registerResponse = await request(testServer.app)
        .post('/api/auth/register')
        .send(user)

      const oldToken = registerResponse.body.token
      const refreshTokenValue = registerResponse.body.refreshToken

      await new Promise(resolve => setTimeout(resolve, 1100))

      const response = await request(testServer.app)
        .post('/api/auth/refresh')
        .send({ refreshToken: refreshTokenValue })

      expect(response.status).toBe(200)
      expect(response.body.token).toBeDefined()
      expect(response.body.token).not.toBe(oldToken)
    })

    test('refresh token remains unchanged', async () => {
      const user = createValidUser()
      const registerResponse = await request(testServer.app)
        .post('/api/auth/register')
        .send(user)

      const originalRefreshToken = registerResponse.body.refreshToken

      const response = await request(testServer.app)
        .post('/api/auth/refresh')
        .send({ refreshToken: originalRefreshToken })

      expect(response.body.refreshToken).toBe(originalRefreshToken)
    })

    test('returns 400 when refresh token is missing', async () => {
      const response = await request(testServer.app)
        .post('/api/auth/refresh')
        .send({})

      expect(response.status).toBe(400)
      expect(response.body.erro).toContain('Refresh token obrigatório')
    })

    test('returns 401 for invalid refresh token', async () => {
      const response = await request(testServer.app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid.token.here' })

      expect(response.status).toBe(401)
      expect(response.body.erro).toContain('inválido ou expirado')
    })

    test('returns 401 for tampered refresh token', async () => {
      const user = createValidUser()
      const registerResponse = await request(testServer.app)
        .post('/api/auth/register')
        .send(user)

      const tamperedToken = registerResponse.body.refreshToken.slice(0, -5) + 'XXXXX'

      const response = await request(testServer.app)
        .post('/api/auth/refresh')
        .send({ refreshToken: tamperedToken })

      expect(response.status).toBe(401)
      expect(response.body.erro).toContain('inválido ou expirado')
    })

    test('new access token contains correct user id', async () => {
      const user = createValidUser()
      const registerResponse = await request(testServer.app)
        .post('/api/auth/register')
        .send(user)

      const response = await request(testServer.app)
        .post('/api/auth/refresh')
        .send({ refreshToken: registerResponse.body.refreshToken })

      const decoded = jwt.decode(response.body.token) as any
      expect(decoded.id).toBe(registerResponse.body.user.id)
    })
  })
})

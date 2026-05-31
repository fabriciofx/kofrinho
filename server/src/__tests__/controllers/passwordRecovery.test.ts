import request from 'supertest'
import bcrypt from 'bcrypt'
import { setupTestDb, runAsync, getAsync, allAsync } from '../setup/database.js'
import { startTestServer, stopTestServer, TestServerSetup } from '../setup/testServer.js'
import { generateAccessToken } from '../../utils/jwt.js'
import { createValidUser } from '../setup/fixtures.js'
import { User } from '../../types/index.js'

describe('Password Recovery - POST /api/auth/forgot-password', () => {
  let testDb: any
  let testServer: TestServerSetup
  const baseUser = createValidUser()
  const userId = 1
  let senhaHash: string

  beforeAll(async () => {
    testDb = await setupTestDb()
    testServer = await startTestServer(testDb)
    senhaHash = await bcrypt.hash(baseUser.senha, 10)

    await runAsync(testDb, 
      `INSERT INTO users (id, nome_completo, email, senha_hash) 
       VALUES (?, ?, ?, ?)`,
      [userId, baseUser.nome_completo, baseUser.email, senhaHash]
    )
  })

  afterAll(async () => {
    await stopTestServer(testServer)
  })

  test('sends password reset email for valid email', async () => {
    const response = await request(testServer.app)
      .post('/api/auth/forgot-password')
      .send({ email: baseUser.email })

    expect(response.status).toBe(200)
    expect(response.body.message).toContain('sucesso')
  })

  test('returns 404 for non-existent email', async () => {
    const response = await request(testServer.app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nonexistent@example.com' })

    expect(response.status).toBe(404)
  })

  test('returns 400 when email is missing', async () => {
    const response = await request(testServer.app)
      .post('/api/auth/forgot-password')
      .send({})

    expect(response.status).toBe(400)
  })

  test('returns 400 for invalid email format', async () => {
    const response = await request(testServer.app)
      .post('/api/auth/forgot-password')
      .send({ email: 'invalid-email' })

    expect(response.status).toBe(400)
  })

  test('stores reset token in database', async () => {
    await request(testServer.app)
      .post('/api/auth/forgot-password')
      .send({ email: baseUser.email })

    const user = await getAsync<User>(testDb,
      'SELECT reset_token FROM users WHERE email = ?',
      [baseUser.email]
    )

    expect(user?.reset_token).toBeTruthy()
    expect(user?.reset_token).toMatch(/^[a-f0-9]{64}$/)
  })

  test('sets token expiration to 1 hour from now', async () => {
    await request(testServer.app)
      .post('/api/auth/forgot-password')
      .send({ email: baseUser.email })

    const user = await getAsync<User>(testDb,
      'SELECT reset_token_expira_em FROM users WHERE email = ?',
      [baseUser.email]
    )

    expect(user?.reset_token_expira_em).toBeTruthy()
    const expirationTime = new Date(user!.reset_token_expira_em!).getTime()
    const nowTime = Date.now()
    const diffMinutes = (expirationTime - nowTime) / 1000 / 60

    expect(diffMinutes).toBeGreaterThan(59)
    expect(diffMinutes).toBeLessThanOrEqual(60)
  })
})

describe('Password Recovery - POST /api/auth/reset-password', () => {
  let testDb: any
  let testServer: TestServerSetup

  beforeAll(async () => {
    testDb = await setupTestDb()
    testServer = await startTestServer(testDb)
  })

  afterAll(async () => {
    await stopTestServer(testServer)
  })

  test('resets password with valid token and new password', async () => {
    const baseUser = createValidUser()
    const userId = 100
    const senhaHash = await bcrypt.hash(baseUser.senha, 10)

    await runAsync(testDb, 
      `INSERT INTO users (id, nome_completo, email, senha_hash) 
       VALUES (?, ?, ?, ?)`,
      [userId, baseUser.nome_completo, baseUser.email, senhaHash]
    )

    await request(testServer.app)
      .post('/api/auth/forgot-password')
      .send({ email: baseUser.email })

    const user = await getAsync<User>(testDb,
      'SELECT reset_token FROM users WHERE email = ?',
      [baseUser.email]
    )

    const resetToken = user!.reset_token!
    const newPassword = 'NewPassword123!@'
    const response = await request(testServer.app)
      .post('/api/auth/reset-password')
      .send({ token: resetToken, novaSenha: newPassword })

    expect(response.status).toBe(200)
    expect(response.body.message).toContain('sucesso')
  })

  test('clears reset token after successful reset', async () => {
    const baseUser = createValidUser()
    const userId = 101
    const senhaHash = await bcrypt.hash(baseUser.senha, 10)

    await runAsync(testDb, 
      `INSERT INTO users (id, nome_completo, email, senha_hash) 
       VALUES (?, ?, ?, ?)`,
      [userId, baseUser.nome_completo, baseUser.email, senhaHash]
    )

    await request(testServer.app)
      .post('/api/auth/forgot-password')
      .send({ email: baseUser.email })

    const user1 = await getAsync<User>(testDb,
      'SELECT reset_token FROM users WHERE email = ?',
      [baseUser.email]
    )

    const resetToken = user1!.reset_token!
    const newPassword = 'NewPassword123!@'
    await request(testServer.app)
      .post('/api/auth/reset-password')
      .send({ token: resetToken, novaSenha: newPassword })

    const user2 = await getAsync<User>(testDb,
      'SELECT reset_token FROM users WHERE email = ?',
      [baseUser.email]
    )

    expect(user2?.reset_token).toBeNull()
  })

  test('returns 400 when token is missing', async () => {
    const response = await request(testServer.app)
      .post('/api/auth/reset-password')
      .send({ novaSenha: 'NewPassword123!@' })

    expect(response.status).toBe(400)
  })

  test('returns 400 when password is missing', async () => {
    const response = await request(testServer.app)
      .post('/api/auth/reset-password')
      .send({ token: 'a'.repeat(64) })

    expect(response.status).toBe(400)
  })

  test('returns 400 for invalid token format', async () => {
    const response = await request(testServer.app)
      .post('/api/auth/reset-password')
      .send({ token: 'invalid-token', novaSenha: 'NewPassword123!@' })

    expect(response.status).toBe(400)
  })

  test('returns 404 for invalid/non-existent token', async () => {
    const response = await request(testServer.app)
      .post('/api/auth/reset-password')
      .send({ token: 'a'.repeat(64), novaSenha: 'NewPassword123!@' })

    expect(response.status).toBe(404)
  })

  test('returns 400 when password does not meet requirements', async () => {
    const baseUser = createValidUser()
    const userId = 102
    const senhaHash = await bcrypt.hash(baseUser.senha, 10)

    await runAsync(testDb, 
      `INSERT INTO users (id, nome_completo, email, senha_hash) 
       VALUES (?, ?, ?, ?)`,
      [userId, baseUser.nome_completo, baseUser.email, senhaHash]
    )

    await request(testServer.app)
      .post('/api/auth/forgot-password')
      .send({ email: baseUser.email })

    const user = await getAsync<User>(testDb,
      'SELECT reset_token FROM users WHERE email = ?',
      [baseUser.email]
    )

    const resetToken = user!.reset_token!
    const response = await request(testServer.app)
      .post('/api/auth/reset-password')
      .send({ token: resetToken, novaSenha: 'weak' })

    expect(response.status).toBe(400)
    expect(response.body.erro).toContain('requisitos')
  })

  test('returns 401 when token is expired', async () => {
    const baseUser = createValidUser()
    const userId = 103
    const senhaHash = await bcrypt.hash(baseUser.senha, 10)

    await runAsync(testDb, 
      `INSERT INTO users (id, nome_completo, email, senha_hash) 
       VALUES (?, ?, ?, ?)`,
      [userId, baseUser.nome_completo, baseUser.email, senhaHash]
    )

    await request(testServer.app)
      .post('/api/auth/forgot-password')
      .send({ email: baseUser.email })

    const pastDate = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    await runAsync(testDb,
      'UPDATE users SET reset_token_expira_em = ? WHERE email = ?',
      [pastDate, baseUser.email]
    )

    const user = await getAsync<User>(testDb,
      'SELECT reset_token FROM users WHERE email = ?',
      [baseUser.email]
    )

    const resetToken = user!.reset_token!
    const response = await request(testServer.app)
      .post('/api/auth/reset-password')
      .send({ token: resetToken, novaSenha: 'NewPassword123!@' })

    expect(response.status).toBe(401)
    expect(response.body.erro).toContain('expirado')
  })

  test('allows login with new password after reset', async () => {
    const baseUser = createValidUser()
    const userId = 104
    const senhaHash = await bcrypt.hash(baseUser.senha, 10)

    await runAsync(testDb, 
      `INSERT INTO users (id, nome_completo, email, senha_hash) 
       VALUES (?, ?, ?, ?)`,
      [userId, baseUser.nome_completo, baseUser.email, senhaHash]
    )

    await request(testServer.app)
      .post('/api/auth/forgot-password')
      .send({ email: baseUser.email })

    const user1 = await getAsync<User>(testDb,
      'SELECT reset_token FROM users WHERE email = ?',
      [baseUser.email]
    )

    const resetToken = user1!.reset_token!
    const newPassword = 'NewPassword123!@'
    await request(testServer.app)
      .post('/api/auth/reset-password')
      .send({ token: resetToken, novaSenha: newPassword })

    const loginResponse = await request(testServer.app)
      .post('/api/auth/login')
      .send({ email: baseUser.email, senha: newPassword })

    expect(loginResponse.status).toBe(200)
    expect(loginResponse.body.token).toBeTruthy()
  })

  test('prevents login with old password after reset', async () => {
    const baseUser = createValidUser()
    const userId = 105
    const senhaHash = await bcrypt.hash(baseUser.senha, 10)

    await runAsync(testDb, 
      `INSERT INTO users (id, nome_completo, email, senha_hash) 
       VALUES (?, ?, ?, ?)`,
      [userId, baseUser.nome_completo, baseUser.email, senhaHash]
    )

    await request(testServer.app)
      .post('/api/auth/forgot-password')
      .send({ email: baseUser.email })

    const user1 = await getAsync<User>(testDb,
      'SELECT reset_token FROM users WHERE email = ?',
      [baseUser.email]
    )

    const resetToken = user1!.reset_token!
    const newPassword = 'NewPassword123!@'
    await request(testServer.app)
      .post('/api/auth/reset-password')
      .send({ token: resetToken, novaSenha: newPassword })

    const loginResponse = await request(testServer.app)
      .post('/api/auth/login')
      .send({ email: baseUser.email, senha: baseUser.senha })

    expect(loginResponse.status).toBe(401)
  })

  test('prevents reusing same reset token', async () => {
    const baseUser = createValidUser()
    const userId = 106
    const senhaHash = await bcrypt.hash(baseUser.senha, 10)

    await runAsync(testDb, 
      `INSERT INTO users (id, nome_completo, email, senha_hash) 
       VALUES (?, ?, ?, ?)`,
      [userId, baseUser.nome_completo, baseUser.email, senhaHash]
    )

    await request(testServer.app)
      .post('/api/auth/forgot-password')
      .send({ email: baseUser.email })

    const user1 = await getAsync<User>(testDb,
      'SELECT reset_token FROM users WHERE email = ?',
      [baseUser.email]
    )

    const resetToken = user1!.reset_token!
    const newPassword = 'NewPassword123!@'
    await request(testServer.app)
      .post('/api/auth/reset-password')
      .send({ token: resetToken, novaSenha: newPassword })

    const reusedResponse = await request(testServer.app)
      .post('/api/auth/reset-password')
      .send({ token: resetToken, novaSenha: 'AnotherPassword123!@' })

    expect(reusedResponse.status).toBe(404)
  })
})

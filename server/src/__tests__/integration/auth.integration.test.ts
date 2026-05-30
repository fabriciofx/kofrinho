import request from 'supertest'
import jwt from 'jsonwebtoken'
import { setupTestDb, closeTestDb, allAsync } from '../setup/database.js'
import { startTestServer, stopTestServer, TestServerSetup } from '../setup/testServer.js'
import { createValidUser, createValidLogin, randomEmail } from '../setup/fixtures.js'
import sqlite3 from 'sqlite3'

describe('Authentication Flow Integration Tests', () => {
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

  describe('Complete authentication flow', () => {
    test('complete flow: register → login → refresh token', async () => {
      const user = createValidUser()

      const registerRes = await request(testServer.app)
        .post('/api/auth/register')
        .send(user)

      expect(registerRes.status).toBe(201)
      const userId = registerRes.body.user.id
      const initialToken = registerRes.body.token
      const refreshToken = registerRes.body.refreshToken

      await new Promise(resolve => setTimeout(resolve, 1100))

      const loginRes = await request(testServer.app)
        .post('/api/auth/login')
        .send(createValidLogin(user))

      expect(loginRes.status).toBe(200)
      expect(loginRes.body.user.id).toBe(userId)
      expect(loginRes.body.token).not.toBe(initialToken)

      await new Promise(resolve => setTimeout(resolve, 1100))

      const refreshRes = await request(testServer.app)
        .post('/api/auth/refresh')
        .send({ refreshToken })

      expect(refreshRes.status).toBe(200)
      expect(refreshRes.body.token).not.toBe(initialToken)
      expect(refreshRes.body.token).not.toBe(loginRes.body.token)
    })

    test('multiple users are isolated from each other', async () => {
      const user1 = createValidUser()
      const user2 = createValidUser()

      const register1 = await request(testServer.app)
        .post('/api/auth/register')
        .send(user1)

      const register2 = await request(testServer.app)
        .post('/api/auth/register')
        .send(user2)

      expect(register1.status).toBe(201)
      expect(register2.status).toBe(201)
      expect(register1.body.user.id).not.toBe(register2.body.user.id)

      const login1 = await request(testServer.app)
        .post('/api/auth/login')
        .send(createValidLogin(user1))

      const login2 = await request(testServer.app)
        .post('/api/auth/login')
        .send(createValidLogin(user2))

      expect(login1.body.user.id).toBe(register1.body.user.id)
      expect(login2.body.user.id).toBe(register2.body.user.id)

      const decoded1 = jwt.decode(login1.body.token) as any
      const decoded2 = jwt.decode(login2.body.token) as any

      expect(decoded1.id).not.toBe(decoded2.id)
      expect(decoded1.email).not.toBe(decoded2.email)
    })

    test('user can login multiple times and get different tokens each time', async () => {
      const user = createValidUser()

      await request(testServer.app)
        .post('/api/auth/register')
        .send(user)

      const login1 = await request(testServer.app)
        .post('/api/auth/login')
        .send(createValidLogin(user))

      await new Promise(resolve => setTimeout(resolve, 1100))

      const login2 = await request(testServer.app)
        .post('/api/auth/login')
        .send(createValidLogin(user))

      expect(login1.status).toBe(200)
      expect(login2.status).toBe(200)
      expect(login1.body.token).not.toBe(login2.body.token)
      expect(login1.body.refreshToken).not.toBe(login2.body.refreshToken)

      const decoded1 = jwt.decode(login1.body.token) as any
      const decoded2 = jwt.decode(login2.body.token) as any

      expect(decoded1.id).toBe(decoded2.id)
      expect(decoded1.email).toBe(decoded2.email)
    })

    test('can refresh token multiple times', async () => {
      const user = createValidUser()

      const registerRes = await request(testServer.app)
        .post('/api/auth/register')
        .send(user)

      let currentRefreshToken = registerRes.body.refreshToken
      let previousToken = registerRes.body.token

      for (let i = 0; i < 3; i++) {
        await new Promise(resolve => setTimeout(resolve, 1100))

        const refreshRes = await request(testServer.app)
          .post('/api/auth/refresh')
          .send({ refreshToken: currentRefreshToken })

        expect(refreshRes.status).toBe(200)
        expect(refreshRes.body.token).not.toBe(previousToken)
        previousToken = refreshRes.body.token
        currentRefreshToken = refreshRes.body.refreshToken
      }
    })

    test('prevents duplicate email registration with sequential requests', async () => {
      const user1 = createValidUser()
      const user2 = { ...createValidUser(), email: user1.email }

      const res1 = await request(testServer.app)
        .post('/api/auth/register')
        .send(user1)

      const res2 = await request(testServer.app)
        .post('/api/auth/register')
        .send(user2)

      expect(res1.status).toBe(201)
      expect(res2.status).toBe(409)
      expect(res2.body.erro).toContain('Email já cadastrado')
    })

    test('token payload is consistent between register and login', async () => {
      const user = createValidUser()

      const registerRes = await request(testServer.app)
        .post('/api/auth/register')
        .send(user)

      const loginRes = await request(testServer.app)
        .post('/api/auth/login')
        .send(createValidLogin(user))

      const registerDecoded = jwt.decode(registerRes.body.token) as any
      const loginDecoded = jwt.decode(loginRes.body.token) as any

      expect(registerDecoded.id).toBe(loginDecoded.id)
      expect(registerDecoded.email).toBe(loginDecoded.email)
    })

    test('user data persists correctly across multiple operations', async () => {
      const user = createValidUser()

      const registerRes = await request(testServer.app)
        .post('/api/auth/register')
        .send(user)

      const userId = registerRes.body.user.id

      const loginRes = await request(testServer.app)
        .post('/api/auth/login')
        .send(createValidLogin(user))

      expect(loginRes.body.user.id).toBe(userId)
      expect(loginRes.body.user.nome_completo).toBe(user.nome_completo)
      expect(loginRes.body.user.email).toBe(user.email)
    })
  })
})

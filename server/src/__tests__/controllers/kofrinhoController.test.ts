import { randomUUID } from 'crypto'
import request from 'supertest'
import { setupTestDb, closeTestDb, runAsync } from '../setup/database.js'
import { startTestServer, stopTestServer, TestServerSetup } from '../setup/testServer.js'
import { createValidUser } from '../setup/fixtures.js'
import sqlite3 from 'sqlite3'
import { randomEmail } from '../setup/fixtures.js'

describe('Auth Middleware Tests', () => {
  let testServer: TestServerSetup
  let testDb: sqlite3.Database
  let validToken: string
  let userId: number

  beforeAll(async () => {
    testDb = await setupTestDb()
    testServer = await startTestServer(testDb)

    const user = createValidUser()
    const registerRes = await request(testServer.app)
      .post('/api/auth/register')
      .send(user)

    validToken = registerRes.body.token
    userId = registerRes.body.user.id
  })

  afterAll(async () => {
    await stopTestServer(testServer)
    await closeTestDb(testDb)
  })

  describe('Kofrinho CRUD Protected by Auth Middleware', () => {
    test('returns 401 when authorization header is missing', async () => {
      const response = await request(testServer.app)
        .get('/api/kofrinhos')

      expect(response.status).toBe(401)
      expect(response.body.erro).toContain('Token não fornecido')
    })

    test('returns 401 when authorization header has wrong format', async () => {
      const response = await request(testServer.app)
        .get('/api/kofrinhos')
        .set('Authorization', `Invalid ${validToken}`)

      expect(response.status).toBe(401)
      expect(response.body.erro).toContain('Token não fornecido')
    })

    test('returns 401 when token is invalid', async () => {
      const response = await request(testServer.app)
        .get('/api/kofrinhos')
        .set('Authorization', 'Bearer invalid.token.here')

      expect(response.status).toBe(401)
      expect(response.body.erro).toContain('Token inválido ou expirado')
    })

    test('returns 401 when token is tampered', async () => {
      const tamperedToken = validToken.slice(0, -5) + 'XXXXX'
      const response = await request(testServer.app)
        .get('/api/kofrinhos')
        .set('Authorization', `Bearer ${tamperedToken}`)

      expect(response.status).toBe(401)
      expect(response.body.erro).toContain('Token inválido ou expirado')
    })

    test('allows request with valid token', async () => {
      const response = await request(testServer.app)
        .get('/api/kofrinhos')
        .set('Authorization', `Bearer ${validToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('kofrinhos')
    })

    test('attaches userId to request when token is valid', async () => {
      const response = await request(testServer.app)
        .post('/api/kofrinhos')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Test Kofrinho' })

      expect(response.status).toBe(201)
      expect(response.body.kofrinho.user_id).toBe(userId)
    })
  })
})

describe('Kofrinho CRUD Operations', () => {
  let testServer: TestServerSetup
  let testDb: sqlite3.Database
  let validToken: string
  let userId: number

  beforeAll(async () => {
    testDb = await setupTestDb()
    testServer = await startTestServer(testDb)

    const user = createValidUser()
    const registerRes = await request(testServer.app)
      .post('/api/auth/register')
      .send(user)

    validToken = registerRes.body.token
    userId = registerRes.body.user.id
  })

  afterAll(async () => {
    await stopTestServer(testServer)
    await closeTestDb(testDb)
  })

  describe('POST /api/kofrinhos (Create)', () => {
    test('creates kofrinho with valid data and returns 201', async () => {
      const response = await request(testServer.app)
        .post('/api/kofrinhos')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          nome: 'Meu Primeiro Kofrinho',
          descricao: 'Para guardar moedas',
        })

      expect(response.status).toBe(201)
      expect(response.body.message).toBe('Kofrinho criado com sucesso')
      expect(response.body.kofrinho).toHaveProperty('id')
      expect(response.body.kofrinho.nome).toBe('Meu Primeiro Kofrinho')
      expect(response.body.kofrinho.descricao).toBe('Para guardar moedas')
      expect(response.body.kofrinho.user_id).toBe(userId)
    })

    test('returns 400 when nome is missing', async () => {
      const response = await request(testServer.app)
        .post('/api/kofrinhos')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ descricao: 'Sem nome' })

      expect(response.status).toBe(400)
      expect(response.body.erro).toContain('obrigatório')
    })

    test('returns 400 when nome exceeds 100 characters', async () => {
      const longName = 'a'.repeat(101)
      const response = await request(testServer.app)
        .post('/api/kofrinhos')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: longName })

      expect(response.status).toBe(400)
      expect(response.body.erro).toContain('100 caracteres')
    })

    test('creates kofrinho with descricao as optional', async () => {
      const response = await request(testServer.app)
        .post('/api/kofrinhos')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Kofrinho sem descrição' })

      expect(response.status).toBe(201)
      expect(response.body.kofrinho.nome).toBe('Kofrinho sem descrição')
      expect(response.body.kofrinho.descricao).toBeNull()
    })
  })

  describe('GET /api/kofrinhos (List)', () => {
    beforeEach(async () => {
      await request(testServer.app)
        .post('/api/kofrinhos')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Kofrinho 1' })

      await request(testServer.app)
        .post('/api/kofrinhos')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Kofrinho 2' })
    })

    test('returns empty list for new user', async () => {
      const newUser = createValidUser()
      const registerRes = await request(testServer.app)
        .post('/api/auth/register')
        .send(newUser)

      const response = await request(testServer.app)
        .get('/api/kofrinhos')
        .set('Authorization', `Bearer ${registerRes.body.token}`)

      expect(response.status).toBe(200)
      expect(response.body.kofrinhos).toEqual([])
    })

    test('returns all kofrinhos for authenticated user', async () => {
      const response = await request(testServer.app)
        .get('/api/kofrinhos')
        .set('Authorization', `Bearer ${validToken}`)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body.kofrinhos)).toBe(true)
      expect(response.body.kofrinhos.length).toBeGreaterThanOrEqual(2)
    })

    test('does not return kofrinhos from other users', async () => {
      const otherUser = createValidUser()
      const registerRes = await request(testServer.app)
        .post('/api/auth/register')
        .send(otherUser)

      const otherUserRes = await request(testServer.app)
        .get('/api/kofrinhos')
        .set('Authorization', `Bearer ${registerRes.body.token}`)

      const currentUserRes = await request(testServer.app)
        .get('/api/kofrinhos')
        .set('Authorization', `Bearer ${validToken}`)

      expect(otherUserRes.body.kofrinhos.length).toBe(0)
      expect(currentUserRes.body.kofrinhos.length).toBeGreaterThan(0)
    })

    test('returns kofrinhos in descending order by creation date', async () => {
      const response = await request(testServer.app)
        .get('/api/kofrinhos')
        .set('Authorization', `Bearer ${validToken}`)

      const { kofrinhos } = response.body
      for (let i = 0; i < kofrinhos.length - 1; i++) {
        expect(new Date(kofrinhos[i].criado_em).getTime())
          .toBeGreaterThanOrEqual(new Date(kofrinhos[i + 1].criado_em).getTime())
      }
    })
  })

  describe('GET /api/kofrinhos/:id (Get Single)', () => {
    let kofrinhoId: number

    beforeAll(async () => {
      const createRes = await request(testServer.app)
        .post('/api/kofrinhos')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Kofrinho específico' })

      kofrinhoId = createRes.body.kofrinho.id
    })

    test('returns kofrinho when user owns it', async () => {
      const response = await request(testServer.app)
        .get(`/api/kofrinhos/${kofrinhoId}`)
        .set('Authorization', `Bearer ${validToken}`)

      expect(response.status).toBe(200)
      expect(response.body.kofrinho.id).toBe(kofrinhoId)
      expect(response.body.kofrinho.nome).toBe('Kofrinho específico')
    })

    test('returns 404 when kofrinho does not exist', async () => {
      const response = await request(testServer.app)
        .get('/api/kofrinhos/99999')
        .set('Authorization', `Bearer ${validToken}`)

      expect(response.status).toBe(404)
      expect(response.body.erro).toContain('não encontrado')
    })

    test('returns 404 when user does not own kofrinho', async () => {
      const otherUser = createValidUser()
      const registerRes = await request(testServer.app)
        .post('/api/auth/register')
        .send(otherUser)

      const response = await request(testServer.app)
        .get(`/api/kofrinhos/${kofrinhoId}`)
        .set('Authorization', `Bearer ${registerRes.body.token}`)

      expect(response.status).toBe(404)
      expect(response.body.erro).toContain('não encontrado')
    })
  })

  describe('PUT /api/kofrinhos/:id (Update)', () => {
    let kofrinhoId: number

    beforeAll(async () => {
      const createRes = await request(testServer.app)
        .post('/api/kofrinhos')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Para atualizar', descricao: 'Original' })

      kofrinhoId = createRes.body.kofrinho.id
    })

    test('updates kofrinho with valid data and returns 200', async () => {
      const response = await request(testServer.app)
        .put(`/api/kofrinhos/${kofrinhoId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          nome: 'Atualizado',
          descricao: 'Nova descrição',
        })

      expect(response.status).toBe(200)
      expect(response.body.message).toBe('Kofrinho atualizado com sucesso')
      expect(response.body.kofrinho.nome).toBe('Atualizado')
      expect(response.body.kofrinho.descricao).toBe('Nova descrição')
    })

    test('updates only nome when only nome is provided', async () => {
      const response = await request(testServer.app)
        .put(`/api/kofrinhos/${kofrinhoId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Só nome' })

      expect(response.status).toBe(200)
      expect(response.body.kofrinho.nome).toBe('Só nome')
    })

    test('returns 404 when kofrinho does not exist', async () => {
      const response = await request(testServer.app)
        .put('/api/kofrinhos/99999')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Novo nome' })

      expect(response.status).toBe(404)
    })

    test('returns 400 when nome exceeds 100 characters', async () => {
      const longName = 'a'.repeat(101)
      const response = await request(testServer.app)
        .put(`/api/kofrinhos/${kofrinhoId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: longName })

      expect(response.status).toBe(400)
      expect(response.body.erro).toContain('100 caracteres')
    })
  })

  describe('DELETE /api/kofrinhos/:id (Delete)', () => {
    let kofrinhoIdToDelete: number

    beforeAll(async () => {
      const createRes = await request(testServer.app)
        .post('/api/kofrinhos')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Para deletar' })

      kofrinhoIdToDelete = createRes.body.kofrinho.id
    })

    test('deletes kofrinho and returns 200', async () => {
      const deleteRes = await request(testServer.app)
        .delete(`/api/kofrinhos/${kofrinhoIdToDelete}`)
        .set('Authorization', `Bearer ${validToken}`)

      expect(deleteRes.status).toBe(200)
      expect(deleteRes.body.message).toBe('Kofrinho deletado com sucesso')

      const getRes = await request(testServer.app)
        .get(`/api/kofrinhos/${kofrinhoIdToDelete}`)
        .set('Authorization', `Bearer ${validToken}`)

      expect(getRes.status).toBe(404)
    })

    test('returns 404 when kofrinho does not exist', async () => {
      const response = await request(testServer.app)
        .delete('/api/kofrinhos/99999')
        .set('Authorization', `Bearer ${validToken}`)

      expect(response.status).toBe(404)
    })

    test('returns 404 when user does not own kofrinho', async () => {
      const createRes = await request(testServer.app)
        .post('/api/kofrinhos')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'De outro usuário' })

      const otherUser = createValidUser()
      const registerRes = await request(testServer.app)
        .post('/api/auth/register')
        .send(otherUser)

      const response = await request(testServer.app)
        .delete(`/api/kofrinhos/${createRes.body.kofrinho.id}`)
        .set('Authorization', `Bearer ${registerRes.body.token}`)

      expect(response.status).toBe(404)
    })
  })

  // ─── Saldo (somatório das solicitações pagas) ────────────────────────────────

  describe('Saldo (somatório das solicitações pagas)', () => {
    async function criarKofrinhoComDepositante(): Promise<{ kofrinhoId: number; depositanteId: number }> {
      const kRes = await request(testServer.app)
        .post('/api/kofrinhos')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: `Saldo ${randomUUID()}` })
      const kofrinhoId = kRes.body.kofrinho.id

      const dRes = await request(testServer.app)
        .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Dep Saldo', valor: 100, recorrencia: 'mensal', email: 'depsaldo@teste.com' })
      return { kofrinhoId, depositanteId: dRes.body.depositante.id }
    }

    async function inserirSolicitacao(kofrinhoId: number, depositanteId: number, valor: number, pago: number) {
      await runAsync(testDb,
        'INSERT INTO solicitacoes (solicitacao_id, kofrinho_id, depositante_id, valor, pago) VALUES (?, ?, ?, ?, ?)',
        [randomUUID(), kofrinhoId, depositanteId, valor, pago]
      )
    }

    test('kofrinho recém-criado tem saldo 0', async () => {
      const kRes = await request(testServer.app)
        .post('/api/kofrinhos')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Sem solicitações' })
      expect(kRes.body.kofrinho.saldo).toBe(0)

      const getRes = await request(testServer.app)
        .get(`/api/kofrinhos/${kRes.body.kofrinho.id}`)
        .set('Authorization', `Bearer ${validToken}`)
      expect(getRes.body.kofrinho.saldo).toBe(0)
    })

    test('solicitações não pagas (pago=0) não entram no saldo', async () => {
      const { kofrinhoId, depositanteId } = await criarKofrinhoComDepositante()
      await inserirSolicitacao(kofrinhoId, depositanteId, 500, 0)
      await inserirSolicitacao(kofrinhoId, depositanteId, 300, 0)

      const res = await request(testServer.app)
        .get(`/api/kofrinhos/${kofrinhoId}`)
        .set('Authorization', `Bearer ${validToken}`)
      expect(res.body.kofrinho.saldo).toBe(0)
    })

    test('saldo é o somatório das solicitações pagas (pago=1)', async () => {
      const { kofrinhoId, depositanteId } = await criarKofrinhoComDepositante()
      await inserirSolicitacao(kofrinhoId, depositanteId, 100, 1)
      await inserirSolicitacao(kofrinhoId, depositanteId, 250.5, 1)
      await inserirSolicitacao(kofrinhoId, depositanteId, 999, 0) // não paga: ignorada

      const res = await request(testServer.app)
        .get(`/api/kofrinhos/${kofrinhoId}`)
        .set('Authorization', `Bearer ${validToken}`)
      expect(res.body.kofrinho.saldo).toBe(350.5)
    })

    test('o saldo aparece na listagem GET /kofrinhos', async () => {
      const { kofrinhoId, depositanteId } = await criarKofrinhoComDepositante()
      await inserirSolicitacao(kofrinhoId, depositanteId, 75, 1)
      await inserirSolicitacao(kofrinhoId, depositanteId, 25, 1)

      const res = await request(testServer.app)
        .get('/api/kofrinhos')
        .set('Authorization', `Bearer ${validToken}`)
      const kof = res.body.kofrinhos.find((k: any) => k.id === kofrinhoId)
      expect(kof.saldo).toBe(100)
    })

    test('o saldo de um kofrinho não inclui solicitações de outro', async () => {
      const a = await criarKofrinhoComDepositante()
      const b = await criarKofrinhoComDepositante()
      await inserirSolicitacao(a.kofrinhoId, a.depositanteId, 1000, 1)
      await inserirSolicitacao(b.kofrinhoId, b.depositanteId, 40, 1)

      const resA = await request(testServer.app).get(`/api/kofrinhos/${a.kofrinhoId}`).set('Authorization', `Bearer ${validToken}`)
      const resB = await request(testServer.app).get(`/api/kofrinhos/${b.kofrinhoId}`).set('Authorization', `Bearer ${validToken}`)
      expect(resA.body.kofrinho.saldo).toBe(1000)
      expect(resB.body.kofrinho.saldo).toBe(40)
    })

    test('confirmar uma solicitação via webhook passa a contar no saldo', async () => {
      const { kofrinhoId, depositanteId } = await criarKofrinhoComDepositante()
      const solicitacaoId = randomUUID()
      await runAsync(testDb,
        'INSERT INTO solicitacoes (solicitacao_id, kofrinho_id, depositante_id, valor, pago) VALUES (?, ?, ?, ?, 0)',
        [solicitacaoId, kofrinhoId, depositanteId, 200]
      )

      // antes da confirmação: saldo 0 (solicitação ainda pago=0)
      const antes = await request(testServer.app)
        .get(`/api/kofrinhos/${kofrinhoId}`).set('Authorization', `Bearer ${validToken}`)
      expect(antes.body.kofrinho.saldo).toBe(0)

      // confirma o pagamento via webhook público
      await request(testServer.app).post(`/api/solicitacoes/${solicitacaoId}`)

      const depois = await request(testServer.app)
        .get(`/api/kofrinhos/${kofrinhoId}`).set('Authorization', `Bearer ${validToken}`)
      expect(depois.body.kofrinho.saldo).toBe(200)
    })
  })
})

import request from 'supertest'
import sqlite3 from 'sqlite3'
import { setupTestDb, closeTestDb, getAsync, allAsync } from '../setup/database.js'
import { startTestServer, stopTestServer, TestServerSetup } from '../setup/testServer.js'
import { createValidUser } from '../setup/fixtures.js'

describe('Pagamento Controller', () => {
  let testServer: TestServerSetup
  let testDb: sqlite3.Database
  let validToken: string
  let kofrinhoId: number
  let depositanteId: number

  beforeAll(async () => {
    testDb = await setupTestDb()
    testServer = await startTestServer(testDb)

    const user = createValidUser()
    const reg = await request(testServer.app).post('/api/auth/register').send(user)
    validToken = reg.body.token

    const kRes = await request(testServer.app)
      .post('/api/kofrinhos')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ nome: 'Kofrinho Teste', descricao: 'Para pagamentos' })
    kofrinhoId = kRes.body.kofrinho.id

    const dRes = await request(testServer.app)
      .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
      .set('Authorization', `Bearer ${validToken}`)
      .send({ nome: 'João Silva', valor: 500, recorrencia: 'mensal', email: 'joao@teste.com' })
    depositanteId = dRes.body.depositante.id
  })

  afterAll(async () => {
    await stopTestServer(testServer)
    await closeTestDb(testDb)
  })

  // ─── POST /kofrinho/:kofrinhoId/depositante/:depositanteId ─────────────────

  describe('POST /kofrinho/:kofrinhoId/depositante/:depositanteId (webhook)', () => {
    test('registra pagamento e retorna 201', async () => {
      const res = await request(testServer.app)
        .post(`/kofrinho/${kofrinhoId}/depositante/${depositanteId}`)

      expect(res.status).toBe(201)
      expect(res.body.message).toBe('Pagamento registrado com sucesso')
    })

    test('salva o valor do depositante no registro de pagamento', async () => {
      await request(testServer.app)
        .post(`/kofrinho/${kofrinhoId}/depositante/${depositanteId}`)

      const pag = await getAsync<{ valor: number }>(
        testDb,
        'SELECT valor FROM pagamentos WHERE kofrinho_id = ? AND depositante_id = ? ORDER BY criado_em DESC LIMIT 1',
        [kofrinhoId, depositanteId]
      )
      expect(pag?.valor).toBe(500)
    })

    test('pode registrar múltiplos pagamentos para o mesmo depositante', async () => {
      await request(testServer.app)
        .post(`/kofrinho/${kofrinhoId}/depositante/${depositanteId}`)
      await request(testServer.app)
        .post(`/kofrinho/${kofrinhoId}/depositante/${depositanteId}`)

      const pags = await allAsync<{ id: number }>(
        testDb,
        'SELECT id FROM pagamentos WHERE kofrinho_id = ? AND depositante_id = ?',
        [kofrinhoId, depositanteId]
      )
      expect(pags.length).toBeGreaterThanOrEqual(2)
    })

    test('retorna 404 quando depositante não pertence ao kofrinho', async () => {
      const res = await request(testServer.app)
        .post(`/kofrinho/${kofrinhoId}/depositante/99999`)

      expect(res.status).toBe(404)
    })

    test('retorna 404 quando kofrinho não existe', async () => {
      const res = await request(testServer.app)
        .post(`/kofrinho/99999/depositante/${depositanteId}`)

      expect(res.status).toBe(404)
    })

    test('não requer autenticação (é um webhook público)', async () => {
      const res = await request(testServer.app)
        .post(`/kofrinho/${kofrinhoId}/depositante/${depositanteId}`)
      // Sem Authorization header — deve funcionar
      expect(res.status).toBe(201)
    })
  })

  // ─── GET /api/kofrinhos/:id/pagamentos ────────────────────────────────────

  describe('GET /api/kofrinhos/:id/pagamentos', () => {
    test('retorna lista de pagamentos com nome do depositante', async () => {
      // Garante pelo menos um pagamento registrado
      await request(testServer.app)
        .post(`/kofrinho/${kofrinhoId}/depositante/${depositanteId}`)

      const res = await request(testServer.app)
        .get(`/api/kofrinhos/${kofrinhoId}/pagamentos`)
        .set('Authorization', `Bearer ${validToken}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.pagamentos)).toBe(true)
      expect(res.body.pagamentos.length).toBeGreaterThan(0)

      const pag = res.body.pagamentos[0]
      expect(pag.depositante_nome).toBe('João Silva')
      expect(pag.valor).toBe(500)
      expect(pag.kofrinho_id).toBe(kofrinhoId)
      expect(pag.depositante_id).toBe(depositanteId)
      expect(pag.criado_em).toBeDefined()
    })

    test('retorna array vazio quando não há pagamentos', async () => {
      const kRes = await request(testServer.app)
        .post('/api/kofrinhos')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Kofrinho Sem Pagamentos' })

      const res = await request(testServer.app)
        .get(`/api/kofrinhos/${kRes.body.kofrinho.id}/pagamentos`)
        .set('Authorization', `Bearer ${validToken}`)

      expect(res.status).toBe(200)
      expect(res.body.pagamentos).toEqual([])
    })

    test('retorna 401 sem token', async () => {
      const res = await request(testServer.app)
        .get(`/api/kofrinhos/${kofrinhoId}/pagamentos`)

      expect(res.status).toBe(401)
    })

    test('retorna 404 quando kofrinho não pertence ao usuário', async () => {
      const outro = await request(testServer.app)
        .post('/api/auth/register').send(createValidUser())

      const res = await request(testServer.app)
        .get(`/api/kofrinhos/${kofrinhoId}/pagamentos`)
        .set('Authorization', `Bearer ${outro.body.token}`)

      expect(res.status).toBe(404)
    })

    test('pagamentos aparecem em ordem decrescente de data', async () => {
      await request(testServer.app)
        .post(`/kofrinho/${kofrinhoId}/depositante/${depositanteId}`)
      await request(testServer.app)
        .post(`/kofrinho/${kofrinhoId}/depositante/${depositanteId}`)

      const res = await request(testServer.app)
        .get(`/api/kofrinhos/${kofrinhoId}/pagamentos`)
        .set('Authorization', `Bearer ${validToken}`)

      const pags = res.body.pagamentos
      for (let i = 0; i < pags.length - 1; i++) {
        expect(new Date(pags[i].criado_em).getTime())
          .toBeGreaterThanOrEqual(new Date(pags[i + 1].criado_em).getTime())
      }
    })
  })
})

import { randomUUID } from 'crypto'
import request from 'supertest'
import sqlite3 from 'sqlite3'
import { setupTestDb, closeTestDb, getAsync, allAsync } from '../setup/database.js'
import { startTestServer, stopTestServer, TestServerSetup } from '../setup/testServer.js'
import { createValidUser } from '../setup/fixtures.js'

async function inserirPagamento(
  db: sqlite3.Database,
  pagamentoId: string,
  kofrinhoId: number,
  depositanteId: number,
  valor: number,
  pago = 0
): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO pagamentos (pagamento_id, kofrinho_id, depositante_id, valor, pago) VALUES (?, ?, ?, ?, ?)',
      [pagamentoId, kofrinhoId, depositanteId, valor, pago],
      (err) => (err ? reject(err) : resolve())
    )
  })
}

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

  // ─── POST /pagamentos/:pagamentoId (webhook) ───────────────────────────────

  describe('POST /pagamentos/:pagamentoId (webhook)', () => {
    let pagamentoId: string

    beforeEach(async () => {
      pagamentoId = randomUUID()
      await inserirPagamento(testDb, pagamentoId, kofrinhoId, depositanteId, 500)
    })

    test('confirma pagamento e retorna 200', async () => {
      const res = await request(testServer.app)
        .post(`/pagamentos/${pagamentoId}`)

      expect(res.status).toBe(200)
      expect(res.body.message).toBe('Pagamento confirmado com sucesso')
    })

    test('atualiza pago para 1 no banco de dados', async () => {
      await request(testServer.app)
        .post(`/pagamentos/${pagamentoId}`)

      const pag = await getAsync<{ pago: number }>(
        testDb,
        'SELECT pago FROM pagamentos WHERE pagamento_id = ?',
        [pagamentoId]
      )
      expect(pag?.pago).toBe(1)
    })

    test('retorna 404 quando pagamento_id não existe', async () => {
      const res = await request(testServer.app)
        .post('/pagamentos/uuid-inexistente')

      expect(res.status).toBe(404)
    })

    test('não requer autenticação (é um webhook público)', async () => {
      const res = await request(testServer.app)
        .post(`/pagamentos/${pagamentoId}`)
      expect(res.status).toBe(200)
    })

    test('pagamento permanece pago=0 antes da confirmação', async () => {
      const pag = await getAsync<{ pago: number }>(
        testDb,
        'SELECT pago FROM pagamentos WHERE pagamento_id = ?',
        [pagamentoId]
      )
      expect(pag?.pago).toBe(0)
    })
  })

  // ─── GET /api/kofrinhos/:id/pagamentos ────────────────────────────────────

  describe('GET /api/kofrinhos/:id/pagamentos', () => {
    test('retorna lista de pagamentos com nome do depositante', async () => {
      const uuid = randomUUID()
      await inserirPagamento(testDb, uuid, kofrinhoId, depositanteId, 500, 1)

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
      expect(pag.pagamento_id).toBeDefined()
      expect(pag.pago).toBeDefined()
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
      await inserirPagamento(testDb, randomUUID(), kofrinhoId, depositanteId, 500, 1)
      await inserirPagamento(testDb, randomUUID(), kofrinhoId, depositanteId, 500, 1)

      const res = await request(testServer.app)
        .get(`/api/kofrinhos/${kofrinhoId}/pagamentos`)
        .set('Authorization', `Bearer ${validToken}`)

      const pags = res.body.pagamentos
      for (let i = 0; i < pags.length - 1; i++) {
        expect(new Date(pags[i].criado_em).getTime())
          .toBeGreaterThanOrEqual(new Date(pags[i + 1].criado_em).getTime())
      }
    })

    test('não retorna pagamentos com pago=0', async () => {
      const naoConfirmadoId = randomUUID()
      await inserirPagamento(testDb, naoConfirmadoId, kofrinhoId, depositanteId, 200, 0)

      const res = await request(testServer.app)
        .get(`/api/kofrinhos/${kofrinhoId}/pagamentos`)
        .set('Authorization', `Bearer ${validToken}`)

      expect(res.status).toBe(200)
      const pags = res.body.pagamentos
      expect(pags.some((p: any) => p.pagamento_id === naoConfirmadoId)).toBe(false)
    })

    test('retorna apenas pagamentos com pago=1', async () => {
      const confirmadoId = randomUUID()
      await inserirPagamento(testDb, confirmadoId, kofrinhoId, depositanteId, 300, 1)

      const res = await request(testServer.app)
        .get(`/api/kofrinhos/${kofrinhoId}/pagamentos`)
        .set('Authorization', `Bearer ${validToken}`)

      expect(res.status).toBe(200)
      const pags = res.body.pagamentos
      expect(pags.some((p: any) => p.pagamento_id === confirmadoId)).toBe(true)
      expect(pags.every((p: any) => p.pago === 1)).toBe(true)
    })

    test('pagamento passa a aparecer na lista após confirmação via webhook', async () => {
      const uuid = randomUUID()
      await inserirPagamento(testDb, uuid, kofrinhoId, depositanteId, 400, 0)

      // Antes da confirmação: não aparece
      const antes = await request(testServer.app)
        .get(`/api/kofrinhos/${kofrinhoId}/pagamentos`)
        .set('Authorization', `Bearer ${validToken}`)
      expect(antes.body.pagamentos.some((p: any) => p.pagamento_id === uuid)).toBe(false)

      // Confirma via webhook
      await request(testServer.app).post(`/pagamentos/${uuid}`)

      // Após a confirmação: aparece
      const depois = await request(testServer.app)
        .get(`/api/kofrinhos/${kofrinhoId}/pagamentos`)
        .set('Authorization', `Bearer ${validToken}`)
      expect(depois.body.pagamentos.some((p: any) => p.pagamento_id === uuid)).toBe(true)
    })
  })
})

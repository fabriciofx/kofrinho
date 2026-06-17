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
  pago = 0,
  pago_em: string | null = null
): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO pagamentos (pagamento_id, kofrinho_id, depositante_id, valor, pago, pago_em) VALUES (?, ?, ?, ?, ?, ?)',
      [pagamentoId, kofrinhoId, depositanteId, valor, pago, pago_em],
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

  describe('POST /api/pagamentos/:pagamentoId (webhook)', () => {
    let pagamentoId: string

    beforeEach(async () => {
      pagamentoId = randomUUID()
      await inserirPagamento(testDb, pagamentoId, kofrinhoId, depositanteId, 500)
    })

    test('confirma pagamento e retorna 200', async () => {
      const res = await request(testServer.app)
        .post(`/api/pagamentos/${pagamentoId}`)

      expect(res.status).toBe(200)
      expect(res.body.message).toBe('Pagamento confirmado com sucesso')
    })

    test('atualiza pago para 1 no banco de dados', async () => {
      await request(testServer.app)
        .post(`/api/pagamentos/${pagamentoId}`)

      const pag = await getAsync<{ pago: number }>(
        testDb,
        'SELECT pago FROM pagamentos WHERE pagamento_id = ?',
        [pagamentoId]
      )
      expect(pag?.pago).toBe(1)
    })

    test('define pago_em com o timestamp da confirmação', async () => {
      const antes = new Date()
      await request(testServer.app).post(`/api/pagamentos/${pagamentoId}`)
      const depois = new Date()

      const pag = await getAsync<{ pago_em: string }>(
        testDb,
        'SELECT pago_em FROM pagamentos WHERE pagamento_id = ?',
        [pagamentoId]
      )
      expect(pag?.pago_em).toBeDefined()
      // SQLite CURRENT_TIMESTAMP retorna UTC sem sufixo 'Z'; adiciona para parse correto
      const pago_em = new Date(pag!.pago_em.replace(' ', 'T') + 'Z')
      expect(pago_em.getTime()).toBeGreaterThanOrEqual(antes.getTime() - 2000)
      expect(pago_em.getTime()).toBeLessThanOrEqual(depois.getTime() + 2000)
    })

    test('pago_em é null antes da confirmação', async () => {
      const pag = await getAsync<{ pago_em: string | null }>(
        testDb,
        'SELECT pago_em FROM pagamentos WHERE pagamento_id = ?',
        [pagamentoId]
      )
      expect(pag?.pago_em).toBeNull()
    })

    test('retorna 404 quando pagamento_id não existe', async () => {
      const res = await request(testServer.app)
        .post('/api/pagamentos/uuid-inexistente')

      expect(res.status).toBe(404)
    })

    test('não requer autenticação (é um webhook público)', async () => {
      const res = await request(testServer.app)
        .post(`/api/pagamentos/${pagamentoId}`)
      expect(res.status).toBe(200)
    })

    test('retorna 200 com envio de e-mail em background (NODE_ENV=test pula o Resend)', async () => {
      // sendPagamentoConfirmadoEmail retorna cedo em NODE_ENV=test sem lançar,
      // garantindo que o webhook sempre retorna 200 independente do e-mail
      const res = await request(testServer.app).post(`/api/pagamentos/${pagamentoId}`)
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
    test('retorna lista de pagamentos com nome do depositante e pago_em', async () => {
      const uuid = randomUUID()
      await inserirPagamento(testDb, uuid, kofrinhoId, depositanteId, 500, 0)
      await request(testServer.app).post(`/api/pagamentos/${uuid}`)

      const res = await request(testServer.app)
        .get(`/api/kofrinhos/${kofrinhoId}/pagamentos`)
        .set('Authorization', `Bearer ${validToken}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.pagamentos)).toBe(true)
      expect(res.body.pagamentos.length).toBeGreaterThan(0)

      const pag = res.body.pagamentos.find((p: any) => p.pagamento_id === uuid)
      expect(pag).toBeDefined()
      expect(pag.depositante_nome).toBe('João Silva')
      expect(pag.valor).toBe(500)
      expect(pag.kofrinho_id).toBe(kofrinhoId)
      expect(pag.depositante_id).toBe(depositanteId)
      expect(pag.pagamento_id).toBeDefined()
      expect(pag.pago).toBe(1)
      expect(pag.pago_em).toBeDefined()
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

    test('pagamentos aparecem em ordem decrescente de pago_em', async () => {
      const uuid1 = randomUUID()
      const uuid2 = randomUUID()
      // pago_em explícito para garantir ordem independente da resolução de segundos do SQLite
      await inserirPagamento(testDb, uuid1, kofrinhoId, depositanteId, 500, 1, '2026-01-01 09:00:00')
      await inserirPagamento(testDb, uuid2, kofrinhoId, depositanteId, 500, 1, '2026-01-01 10:00:00')

      const res = await request(testServer.app)
        .get(`/api/kofrinhos/${kofrinhoId}/pagamentos`)
        .set('Authorization', `Bearer ${validToken}`)

      const pags = res.body.pagamentos.filter(
        (p: any) => p.pagamento_id === uuid1 || p.pagamento_id === uuid2
      )
      expect(pags.length).toBe(2)
      // uuid2 tem pago_em mais recente → deve aparecer primeiro
      expect(pags[0].pagamento_id).toBe(uuid2)
      expect(pags[1].pagamento_id).toBe(uuid1)
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

      // Confirma via webhook (nova rota com /api/)
      await request(testServer.app).post(`/api/pagamentos/${uuid}`)

      // Após a confirmação: aparece com pago_em preenchido
      const depois = await request(testServer.app)
        .get(`/api/kofrinhos/${kofrinhoId}/pagamentos`)
        .set('Authorization', `Bearer ${validToken}`)
      const pag = depois.body.pagamentos.find((p: any) => p.pagamento_id === uuid)
      expect(pag).toBeDefined()
      expect(pag.pago_em).toBeDefined()
      expect(pag.pago_em).not.toBeNull()
    })
  })
})

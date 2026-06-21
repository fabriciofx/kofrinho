import { randomUUID } from 'crypto'
import request from 'supertest'
import sqlite3 from 'sqlite3'
import { setupTestDb, closeTestDb, getAsync, allAsync } from '../setup/database.js'
import { startTestServer, stopTestServer, TestServerSetup } from '../setup/testServer.js'
import { createValidUser } from '../setup/fixtures.js'

async function inserirSolicitacao(
  db: sqlite3.Database,
  solicitacaoId: string,
  kofrinhoId: number,
  depositanteId: number,
  valor: number,
  pago = 0,
  pago_em: string | null = null,
  criado_em: string | null = null
): Promise<void> {
  const cols = ['solicitacao_id', 'kofrinho_id', 'depositante_id', 'valor', 'pago', 'pago_em']
  const vals: any[] = [solicitacaoId, kofrinhoId, depositanteId, valor, pago, pago_em]
  if (criado_em !== null) {
    cols.push('criado_em')
    vals.push(criado_em)
  }
  const placeholders = cols.map(() => '?').join(', ')
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO solicitacoes (${cols.join(', ')}) VALUES (${placeholders})`,
      vals,
      (err) => (err ? reject(err) : resolve())
    )
  })
}

describe('Solicitação Controller', () => {
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
      .send({ nome: 'Kofrinho Teste', descricao: 'Para solicitações' })
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

  // ─── POST /solicitacoes/:solicitacaoId (webhook) ───────────────────────────

  describe('POST /api/solicitacoes/:solicitacaoId (webhook)', () => {
    let solicitacaoId: string

    beforeEach(async () => {
      solicitacaoId = randomUUID()
      await inserirSolicitacao(testDb, solicitacaoId, kofrinhoId, depositanteId, 500)
    })

    test('confirma solicitação e retorna 200', async () => {
      const res = await request(testServer.app)
        .post(`/api/solicitacoes/${solicitacaoId}`)

      expect(res.status).toBe(200)
      expect(res.body.message).toBe('Solicitação confirmada com sucesso')
    })

    test('atualiza pago para 1 no banco de dados', async () => {
      await request(testServer.app)
        .post(`/api/solicitacoes/${solicitacaoId}`)

      const pag = await getAsync<{ pago: number }>(
        testDb,
        'SELECT pago FROM solicitacoes WHERE solicitacao_id = ?',
        [solicitacaoId]
      )
      expect(pag?.pago).toBe(1)
    })

    test('define pago_em com o timestamp da confirmação', async () => {
      const antes = new Date()
      await request(testServer.app).post(`/api/solicitacoes/${solicitacaoId}`)
      const depois = new Date()

      const pag = await getAsync<{ pago_em: string }>(
        testDb,
        'SELECT pago_em FROM solicitacoes WHERE solicitacao_id = ?',
        [solicitacaoId]
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
        'SELECT pago_em FROM solicitacoes WHERE solicitacao_id = ?',
        [solicitacaoId]
      )
      expect(pag?.pago_em).toBeNull()
    })

    test('retorna 404 quando solicitacaoId não existe', async () => {
      const res = await request(testServer.app)
        .post('/api/solicitacoes/uuid-inexistente')

      expect(res.status).toBe(404)
    })

    test('não requer autenticação (é um webhook público)', async () => {
      const res = await request(testServer.app)
        .post(`/api/solicitacoes/${solicitacaoId}`)
      expect(res.status).toBe(200)
    })

    test('chamadas repetidas ao webhook retornam 200 sem alterar pago_em', async () => {
      // Primeira confirmação
      await request(testServer.app).post(`/api/solicitacoes/${solicitacaoId}`)
      const { pago_em: primeiroPagoEm } = await getAsync<{ pago_em: string }>(
        testDb, 'SELECT pago_em FROM solicitacoes WHERE solicitacao_id = ?', [solicitacaoId]
      ) as { pago_em: string }

      // Segunda chamada (gateway repetindo o webhook)
      const res = await request(testServer.app).post(`/api/solicitacoes/${solicitacaoId}`)
      expect(res.status).toBe(200)

      const { pago_em: segundoPagoEm } = await getAsync<{ pago_em: string }>(
        testDb, 'SELECT pago_em FROM solicitacoes WHERE solicitacao_id = ?', [solicitacaoId]
      ) as { pago_em: string }

      // pago_em não deve ser sobrescrito
      expect(segundoPagoEm).toBe(primeiroPagoEm)
    })

    test('retorna 200 com envio de e-mail em background (NODE_ENV=test pula o Resend)', async () => {
      const res = await request(testServer.app).post(`/api/solicitacoes/${solicitacaoId}`)
      expect(res.status).toBe(200)
    })

    test('solicitação permanece pago=0 antes da confirmação', async () => {
      const pag = await getAsync<{ pago: number }>(
        testDb,
        'SELECT pago FROM solicitacoes WHERE solicitacao_id = ?',
        [solicitacaoId]
      )
      expect(pag?.pago).toBe(0)
    })
  })

  // ─── GET /api/kofrinhos/:id/solicitacoes ──────────────────────────────────

  describe('GET /api/kofrinhos/:id/solicitacoes', () => {
    test('retorna lista de solicitações com nome do depositante e pago_em', async () => {
      const uuid = randomUUID()
      await inserirSolicitacao(testDb, uuid, kofrinhoId, depositanteId, 500, 0)
      await request(testServer.app).post(`/api/solicitacoes/${uuid}`)

      const res = await request(testServer.app)
        .get(`/api/kofrinhos/${kofrinhoId}/solicitacoes`)
        .set('Authorization', `Bearer ${validToken}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.solicitacoes)).toBe(true)
      expect(res.body.solicitacoes.length).toBeGreaterThan(0)

      const pag = res.body.solicitacoes.find((p: any) => p.solicitacao_id === uuid)
      expect(pag).toBeDefined()
      expect(pag.depositante_nome).toBe('João Silva')
      expect(pag.valor).toBe(500)
      expect(pag.kofrinho_id).toBe(kofrinhoId)
      expect(pag.depositante_id).toBe(depositanteId)
      expect(pag.solicitacao_id).toBeDefined()
      expect(pag.pago).toBe(1)
      expect(pag.pago_em).toBeDefined()
      expect(pag.criado_em).toBeDefined()
    })

    test('retorna array vazio quando não há solicitações', async () => {
      const kRes = await request(testServer.app)
        .post('/api/kofrinhos')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Kofrinho Sem Solicitações' })

      const res = await request(testServer.app)
        .get(`/api/kofrinhos/${kRes.body.kofrinho.id}/solicitacoes`)
        .set('Authorization', `Bearer ${validToken}`)

      expect(res.status).toBe(200)
      expect(res.body.solicitacoes).toEqual([])
    })

    test('retorna 401 sem token', async () => {
      const res = await request(testServer.app)
        .get(`/api/kofrinhos/${kofrinhoId}/solicitacoes`)

      expect(res.status).toBe(401)
    })

    test('retorna 404 quando kofrinho não pertence ao usuário', async () => {
      const outro = await request(testServer.app)
        .post('/api/auth/register').send(createValidUser())

      const res = await request(testServer.app)
        .get(`/api/kofrinhos/${kofrinhoId}/solicitacoes`)
        .set('Authorization', `Bearer ${outro.body.token}`)

      expect(res.status).toBe(404)
    })

    test('solicitações aparecem em ordem decrescente de criado_em (mais recentes primeiro)', async () => {
      const uuid1 = randomUUID()
      const uuid2 = randomUUID()
      // criado_em explícito para garantir ordem independente da resolução de segundos do SQLite
      await inserirSolicitacao(testDb, uuid1, kofrinhoId, depositanteId, 500, 0, null, '2026-01-01 09:00:00')
      await inserirSolicitacao(testDb, uuid2, kofrinhoId, depositanteId, 500, 0, null, '2026-01-01 10:00:00')

      const res = await request(testServer.app)
        .get(`/api/kofrinhos/${kofrinhoId}/solicitacoes`)
        .set('Authorization', `Bearer ${validToken}`)

      const pags = res.body.solicitacoes.filter(
        (p: any) => p.solicitacao_id === uuid1 || p.solicitacao_id === uuid2
      )
      expect(pags.length).toBe(2)
      // uuid2 foi enviada mais recentemente → deve aparecer primeiro
      expect(pags[0].solicitacao_id).toBe(uuid2)
      expect(pags[1].solicitacao_id).toBe(uuid1)
    })

    test('retorna solicitações a pagar (pago=0) com situação implícita "A Pagar"', async () => {
      const aPagarId = randomUUID()
      await inserirSolicitacao(testDb, aPagarId, kofrinhoId, depositanteId, 200, 0)

      const res = await request(testServer.app)
        .get(`/api/kofrinhos/${kofrinhoId}/solicitacoes`)
        .set('Authorization', `Bearer ${validToken}`)

      expect(res.status).toBe(200)
      const pag = res.body.solicitacoes.find((p: any) => p.solicitacao_id === aPagarId)
      expect(pag).toBeDefined()
      expect(pag.pago).toBe(0) // pago=0 → frontend exibe "A Pagar"
      expect(pag.pago_em).toBeNull()
    })

    test('retorna tanto solicitações a pagar (pago=0) quanto pagas (pago=1)', async () => {
      const aPagarId = randomUUID()
      const pagaId = randomUUID()
      await inserirSolicitacao(testDb, aPagarId, kofrinhoId, depositanteId, 300, 0)
      await inserirSolicitacao(testDb, pagaId, kofrinhoId, depositanteId, 300, 1)

      const res = await request(testServer.app)
        .get(`/api/kofrinhos/${kofrinhoId}/solicitacoes`)
        .set('Authorization', `Bearer ${validToken}`)

      expect(res.status).toBe(200)
      const pags = res.body.solicitacoes
      expect(pags.some((p: any) => p.solicitacao_id === aPagarId && p.pago === 0)).toBe(true)
      expect(pags.some((p: any) => p.solicitacao_id === pagaId && p.pago === 1)).toBe(true)
    })

    test('situação muda de "A Pagar" (pago=0) para "Paga" (pago=1) após webhook', async () => {
      const uuid = randomUUID()
      await inserirSolicitacao(testDb, uuid, kofrinhoId, depositanteId, 400, 0)

      // Antes da confirmação: aparece como "A Pagar" (pago=0, sem pago_em)
      const antes = await request(testServer.app)
        .get(`/api/kofrinhos/${kofrinhoId}/solicitacoes`)
        .set('Authorization', `Bearer ${validToken}`)
      const pagAntes = antes.body.solicitacoes.find((p: any) => p.solicitacao_id === uuid)
      expect(pagAntes).toBeDefined()
      expect(pagAntes.pago).toBe(0)
      expect(pagAntes.pago_em).toBeNull()

      // Confirma via webhook (chamada da Confrapix)
      await request(testServer.app).post(`/api/solicitacoes/${uuid}`)

      // Após a confirmação: situação "Paga" (pago=1, com pago_em preenchido)
      const depois = await request(testServer.app)
        .get(`/api/kofrinhos/${kofrinhoId}/solicitacoes`)
        .set('Authorization', `Bearer ${validToken}`)
      const pagDepois = depois.body.solicitacoes.find((p: any) => p.solicitacao_id === uuid)
      expect(pagDepois).toBeDefined()
      expect(pagDepois.pago).toBe(1)
      expect(pagDepois.pago_em).not.toBeNull()
    })
  })

  // ─── GET /api/solicitacoes/:solicitacaoId (página pública) ─────────────────

  describe('GET /api/solicitacoes/:solicitacaoId (página pública)', () => {
    const PIX_URL = 'data:image/png;base64,QRCODE_FAKE_BASE64'
    const PIX_CODE = '00020126580014br.gov.bcb.pix0136copia-e-cola-12345'

    async function inserirSolicitacaoComPix(
      solicitacaoId: string,
      valor: number,
      pago = 0
    ): Promise<void> {
      return new Promise((resolve, reject) => {
        testDb.run(
          `INSERT INTO solicitacoes
             (solicitacao_id, kofrinho_id, depositante_id, valor, pago, pix_url, pix_code)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [solicitacaoId, kofrinhoId, depositanteId, valor, pago, PIX_URL, PIX_CODE],
          (err) => (err ? reject(err) : resolve())
        )
      })
    }

    test('retorna 200 com o mesmo conteúdo do e-mail (valor, dono, kofrinho)', async () => {
      const uuid = randomUUID()
      await inserirSolicitacaoComPix(uuid, 500)

      const res = await request(testServer.app).get(`/api/solicitacoes/${uuid}`)

      expect(res.status).toBe(200)
      const s = res.body.solicitacao
      expect(s.solicitacao_id).toBe(uuid)
      expect(s.valor).toBe(500)
      expect(s.depositante_nome).toBe('João Silva')
      expect(s.kofrinho_nome).toBe('Kofrinho Teste')
      expect(s.kofrinho_descricao).toBe('Para solicitações')
      expect(s.dono_nome).toBeDefined()
    })

    test('retorna o QR Code (pix_url) e o código copia-e-cola (pix_code)', async () => {
      const uuid = randomUUID()
      await inserirSolicitacaoComPix(uuid, 750)

      const res = await request(testServer.app).get(`/api/solicitacoes/${uuid}`)

      expect(res.status).toBe(200)
      expect(res.body.solicitacao.pix_url).toBe(PIX_URL)
      expect(res.body.solicitacao.pix_code).toBe(PIX_CODE)
    })

    test('inclui o estado de pagamento (pago)', async () => {
      const uuid = randomUUID()
      await inserirSolicitacaoComPix(uuid, 100, 1)

      const res = await request(testServer.app).get(`/api/solicitacoes/${uuid}`)

      expect(res.status).toBe(200)
      expect(res.body.solicitacao.pago).toBe(1)
    })

    test('não requer autenticação (página pública)', async () => {
      const uuid = randomUUID()
      await inserirSolicitacaoComPix(uuid, 200)

      // Sem header Authorization
      const res = await request(testServer.app).get(`/api/solicitacoes/${uuid}`)
      expect(res.status).toBe(200)
    })

    test('retorna 404 quando a solicitação não existe', async () => {
      const res = await request(testServer.app).get('/api/solicitacoes/uuid-inexistente')

      expect(res.status).toBe(404)
      expect(res.body.erro).toBeDefined()
    })
  })
})

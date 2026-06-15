import request from 'supertest'
import sqlite3 from 'sqlite3'
import { setupTestDb, closeTestDb, getAsync, allAsync } from '../setup/database.js'
import { startTestServer, stopTestServer, TestServerSetup } from '../setup/testServer.js'
import { createValidUser } from '../setup/fixtures.js'

describe('Depositante Controller', () => {
  let testServer: TestServerSetup
  let testDb: sqlite3.Database
  let validToken: string
  let kofrinhoId: number

  beforeAll(async () => {
    testDb = await setupTestDb()
    testServer = await startTestServer(testDb)

    const user = createValidUser()
    const registerRes = await request(testServer.app)
      .post('/api/auth/register')
      .send(user)

    validToken = registerRes.body.token

    const kofrinhoRes = await request(testServer.app)
      .post('/api/kofrinhos')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ nome: 'Meu Kofrinho', descricao: 'Para testes' })

    kofrinhoId = kofrinhoRes.body.kofrinho.id
  })

  afterAll(async () => {
    await stopTestServer(testServer)
    await closeTestDb(testDb)
  })

  // ─── POST /api/kofrinhos/:id/depositantes ──────────────────────────────────

  describe('POST /api/kofrinhos/:id/depositantes', () => {
    test('cria depositante com dados válidos e retorna 201', async () => {
      const res = await request(testServer.app)
        .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Salário', valor: 5000, recorrencia: 'mensal' })

      expect(res.status).toBe(201)
      expect(res.body.message).toBe('Depositante criado com sucesso')
      expect(res.body.depositante).toMatchObject({
        nome: 'Salário',
        valor: 5000,
        recorrencia: 'mensal',
        kofrinho_id: kofrinhoId,
      })
      expect(res.body.depositante.id).toBeDefined()
    })

    test('cria agendamento automaticamente ao criar depositante', async () => {
      const res = await request(testServer.app)
        .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Bônus', valor: 1000, recorrencia: 'mensal' })

      expect(res.status).toBe(201)
      const depositanteId = res.body.depositante.id

      const ag = await getAsync<{ id: number; recorrencia: string; proxima_execucao: string; ativo: number }>(
        testDb,
        'SELECT id, recorrencia, proxima_execucao, ativo FROM agendamentos WHERE depositante_id = ?',
        [depositanteId]
      )

      expect(ag).toBeDefined()
      expect(ag!.recorrencia).toBe('mensal')
      expect(ag!.ativo).toBe(1)
    })

    test('agendamento tem proxima_execucao no futuro', async () => {
      const res = await request(testServer.app)
        .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Aporte Semanal', valor: 200, recorrencia: 'semanal' })

      const depositanteId = res.body.depositante.id
      const ag = await getAsync<{ proxima_execucao: string }>(
        testDb,
        'SELECT proxima_execucao FROM agendamentos WHERE depositante_id = ?',
        [depositanteId]
      )

      expect(new Date(ag!.proxima_execucao).getTime()).toBeGreaterThan(Date.now())
    })

    test('agendamento herda a recorrencia do depositante', async () => {
      for (const recorrencia of ['diario', 'semanal', 'mensal', 'anual'] as const) {
        const res = await request(testServer.app)
          .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
          .set('Authorization', `Bearer ${validToken}`)
          .send({ nome: `Dep ${recorrencia}`, valor: 100, recorrencia })

        const depositanteId = res.body.depositante.id
        const ag = await getAsync<{ recorrencia: string }>(
          testDb,
          'SELECT recorrencia FROM agendamentos WHERE depositante_id = ?',
          [depositanteId]
        )

        expect(ag!.recorrencia).toBe(recorrencia)
      }
    })

    test('retorna 400 quando nome está ausente', async () => {
      const res = await request(testServer.app)
        .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ valor: 500, recorrencia: 'mensal' })

      expect(res.status).toBe(400)
      expect(res.body.erro).toContain('obrigatório')
    })

    test('retorna 400 quando valor é zero ou negativo', async () => {
      const resZero = await request(testServer.app)
        .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Inválido', valor: 0, recorrencia: 'mensal' })

      expect(resZero.status).toBe(400)

      const resNeg = await request(testServer.app)
        .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Inválido', valor: -100, recorrencia: 'mensal' })

      expect(resNeg.status).toBe(400)
    })

    test('retorna 400 para recorrencia inválida', async () => {
      const res = await request(testServer.app)
        .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Dep', valor: 100, recorrencia: 'bimestral' })

      expect(res.status).toBe(400)
      expect(res.body.erro).toContain('Recorrência inválida')
    })

    test('retorna 404 quando kofrinho não existe', async () => {
      const res = await request(testServer.app)
        .post('/api/kofrinhos/99999/depositantes')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Dep', valor: 100, recorrencia: 'mensal' })

      expect(res.status).toBe(404)
    })

    test('retorna 401 sem token', async () => {
      const res = await request(testServer.app)
        .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
        .send({ nome: 'Dep', valor: 100, recorrencia: 'mensal' })

      expect(res.status).toBe(401)
    })
  })

  // ─── GET /api/kofrinhos/:id/depositantes ──────────────────────────────────

  describe('GET /api/kofrinhos/:id/depositantes', () => {
    test('retorna lista de depositantes do kofrinho', async () => {
      const kRes = await request(testServer.app)
        .post('/api/kofrinhos')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Kofrinho Listagem' })

      const kId = kRes.body.kofrinho.id

      await request(testServer.app)
        .post(`/api/kofrinhos/${kId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'D1', valor: 100, recorrencia: 'mensal' })

      await request(testServer.app)
        .post(`/api/kofrinhos/${kId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'D2', valor: 200, recorrencia: 'semanal' })

      const res = await request(testServer.app)
        .get(`/api/kofrinhos/${kId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.depositantes)).toBe(true)
      expect(res.body.depositantes.length).toBe(2)
    })

    test('retorna array vazio quando não há depositantes', async () => {
      const kRes = await request(testServer.app)
        .post('/api/kofrinhos')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Kofrinho Vazio' })

      const res = await request(testServer.app)
        .get(`/api/kofrinhos/${kRes.body.kofrinho.id}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)

      expect(res.status).toBe(200)
      expect(res.body.depositantes).toEqual([])
    })
  })

  // ─── DELETE /api/kofrinhos/:id/depositantes/:depositanteId ────────────────

  describe('DELETE /api/kofrinhos/:id/depositantes/:depositanteId', () => {
    test('deleta depositante e retorna 200', async () => {
      const criaRes = await request(testServer.app)
        .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Para deletar', valor: 300, recorrencia: 'diario' })

      const depId = criaRes.body.depositante.id

      const delRes = await request(testServer.app)
        .delete(`/api/kofrinhos/${kofrinhoId}/depositantes/${depId}`)
        .set('Authorization', `Bearer ${validToken}`)

      expect(delRes.status).toBe(200)
      expect(delRes.body.message).toBe('Depositante removido com sucesso')
    })

    test('deletar depositante remove o agendamento em cascata', async () => {
      const criaRes = await request(testServer.app)
        .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Com Agendamento', valor: 800, recorrencia: 'mensal' })

      const depId = criaRes.body.depositante.id

      // Confirma que agendamento existe
      const agAntes = await getAsync<{ id: number }>(
        testDb,
        'SELECT id FROM agendamentos WHERE depositante_id = ?',
        [depId]
      )
      expect(agAntes).toBeDefined()

      // Deleta depositante
      await request(testServer.app)
        .delete(`/api/kofrinhos/${kofrinhoId}/depositantes/${depId}`)
        .set('Authorization', `Bearer ${validToken}`)

      // Agendamento deve ter sido removido em cascata
      const agDepois = await getAsync<{ id: number }>(
        testDb,
        'SELECT id FROM agendamentos WHERE depositante_id = ?',
        [depId]
      )
      expect(agDepois).toBeUndefined()
    })

    test('retorna 404 quando depositante não existe', async () => {
      const res = await request(testServer.app)
        .delete(`/api/kofrinhos/${kofrinhoId}/depositantes/99999`)
        .set('Authorization', `Bearer ${validToken}`)

      expect(res.status).toBe(404)
    })

    test('retorna 404 quando kofrinho não pertence ao usuário', async () => {
      const otherUser = createValidUser()
      const otherReg = await request(testServer.app)
        .post('/api/auth/register')
        .send(otherUser)

      const res = await request(testServer.app)
        .delete(`/api/kofrinhos/${kofrinhoId}/depositantes/1`)
        .set('Authorization', `Bearer ${otherReg.body.token}`)

      expect(res.status).toBe(404)
    })
  })
})

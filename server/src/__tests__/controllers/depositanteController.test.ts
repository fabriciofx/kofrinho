import { jest } from '@jest/globals'
import request from 'supertest'
import sqlite3 from 'sqlite3'
import { setupTestDb, closeTestDb, getAsync } from '../setup/database.js'
import { startTestServer, stopTestServer, TestServerSetup } from '../setup/testServer.js'
import { createValidUser } from '../setup/fixtures.js'
import { processarAgendamentos } from '../../services/schedulerService.js'

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
    test('cria depositante com dados válidos (incluindo email) e retorna 201', async () => {
      const res = await request(testServer.app)
        .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Salário', valor: 5000, recorrencia: 'mensal', email: 'salario@teste.com' })

      expect(res.status).toBe(201)
      expect(res.body.message).toBe('Depositante criado com sucesso')
      expect(res.body.depositante).toMatchObject({
        nome: 'Salário',
        valor: 5000,
        recorrencia: 'mensal',
        kofrinho_id: kofrinhoId,
        email: 'salario@teste.com',
      })
      expect(res.body.depositante.id).toBeDefined()
    })

    test('cria depositante com email e telefone e retorna 201', async () => {
      const res = await request(testServer.app)
        .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          nome: 'João Silva',
          valor: 2000,
          recorrencia: 'mensal',
          email: 'joao@exemplo.com',
          telefone: '(11) 98765-4321',
        })

      expect(res.status).toBe(201)
      expect(res.body.depositante.email).toBe('joao@exemplo.com')
      expect(res.body.depositante.telefone).toBe('(11) 98765-4321')
    })

    // ── Email obrigatório ─────────────────────────────────────────────────────

    test('retorna 400 quando email está ausente', async () => {
      const res = await request(testServer.app)
        .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Sem Email', valor: 100, recorrencia: 'mensal' })

      expect(res.status).toBe(400)
      expect(res.body.erro).toContain('obrigatório')
    })

    test('retorna 400 quando email é string vazia', async () => {
      const res = await request(testServer.app)
        .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Email Vazio', valor: 100, recorrencia: 'mensal', email: '' })

      expect(res.status).toBe(400)
      expect(res.body.erro).toContain('obrigatório')
    })

    test('retorna 400 quando email contém apenas espaços', async () => {
      const res = await request(testServer.app)
        .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Email Spaces', valor: 100, recorrencia: 'mensal', email: '   ' })

      expect(res.status).toBe(400)
      expect(res.body.erro).toContain('obrigatório')
    })

    test('retorna 400 para email com formato inválido', async () => {
      const casos = ['invalido', 'sem@dominio', '@semlocal.com', 'dois@@arroba.com']

      for (const email of casos) {
        const res = await request(testServer.app)
          .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
          .set('Authorization', `Bearer ${validToken}`)
          .send({ nome: 'Dep', valor: 100, recorrencia: 'mensal', email })

        expect(res.status).toBe(400)
        expect(res.body.erro).toContain('E-mail inválido')
      }
    })

    // ── Persistência de email e telefone ─────────────────────────────────────

    test('salva email no banco ao criar depositante', async () => {
      const res = await request(testServer.app)
        .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Com Email', valor: 300, recorrencia: 'semanal', email: 'teste@banco.com' })

      const row = await getAsync<{ email: string }>(
        testDb,
        'SELECT email FROM depositantes WHERE id = ?',
        [res.body.depositante.id]
      )

      expect(row?.email).toBe('teste@banco.com')
    })

    test('salva telefone no banco ao criar depositante', async () => {
      const res = await request(testServer.app)
        .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          nome: 'Com Telefone',
          valor: 150,
          recorrencia: 'diario',
          email: 'tel@banco.com',
          telefone: '+55 11 91234-5678',
        })

      const row = await getAsync<{ telefone: string }>(
        testDb,
        'SELECT telefone FROM depositantes WHERE id = ?',
        [res.body.depositante.id]
      )

      expect(row?.telefone).toBe('+55 11 91234-5678')
    })

    test('salva email e telefone juntos no banco', async () => {
      const res = await request(testServer.app)
        .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          nome: 'Completo',
          valor: 500,
          recorrencia: 'anual',
          email: 'completo@teste.com',
          telefone: '(21) 3456-7890',
        })

      const row = await getAsync<{ email: string; telefone: string }>(
        testDb,
        'SELECT email, telefone FROM depositantes WHERE id = ?',
        [res.body.depositante.id]
      )

      expect(row?.email).toBe('completo@teste.com')
      expect(row?.telefone).toBe('(21) 3456-7890')
    })

    test('telefone retorna null quando não fornecido', async () => {
      const res = await request(testServer.app)
        .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Só Email', valor: 100, recorrencia: 'mensal', email: 'soemail@teste.com' })

      expect(res.status).toBe(201)
      expect(res.body.depositante.email).toBe('soemail@teste.com')
      expect(res.body.depositante.telefone).toBeNull()
    })

    test('email e telefone aparecem na listagem de depositantes', async () => {
      const kRes = await request(testServer.app)
        .post('/api/kofrinhos')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Kofrinho Listagem Contato' })

      const kId = kRes.body.kofrinho.id

      await request(testServer.app)
        .post(`/api/kofrinhos/${kId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          nome: 'Maria',
          valor: 800,
          recorrencia: 'mensal',
          email: 'maria@lista.com',
          telefone: '(31) 9999-8888',
        })

      const listRes = await request(testServer.app)
        .get(`/api/kofrinhos/${kId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)

      expect(listRes.status).toBe(200)
      const dep = listRes.body.depositantes[0]
      expect(dep.email).toBe('maria@lista.com')
      expect(dep.telefone).toBe('(31) 9999-8888')
    })

    test('remove espaços em branco do email antes de salvar', async () => {
      const res = await request(testServer.app)
        .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Trim Email', valor: 100, recorrencia: 'mensal', email: '  trim@exemplo.com  ' })

      expect(res.status).toBe(201)
      expect(res.body.depositante.email).toBe('trim@exemplo.com')
    })

    test('remove espaços em branco do telefone antes de salvar', async () => {
      const res = await request(testServer.app)
        .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          nome: 'Trim Tel',
          valor: 100,
          recorrencia: 'mensal',
          email: 'trim@tel.com',
          telefone: '  11 9999-0000  ',
        })

      expect(res.status).toBe(201)
      expect(res.body.depositante.telefone).toBe('11 9999-0000')
    })

    // ── Agendamento ───────────────────────────────────────────────────────────

    test('cria agendamento automaticamente ao criar depositante', async () => {
      const res = await request(testServer.app)
        .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Bônus', valor: 1000, recorrencia: 'mensal', email: 'bonus@ag.com' })

      expect(res.status).toBe(201)

      const ag = await getAsync<{ recorrencia: string; ativo: number }>(
        testDb,
        'SELECT recorrencia, ativo FROM agendamentos WHERE depositante_id = ?',
        [res.body.depositante.id]
      )

      expect(ag).toBeDefined()
      expect(ag!.recorrencia).toBe('mensal')
      expect(ag!.ativo).toBe(1)
    })

    test('agendamento tem proxima_execucao imediata para o scheduler disparar o primeiro e-mail', async () => {
      const antes = Date.now()
      const res = await request(testServer.app)
        .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Aporte Semanal', valor: 200, recorrencia: 'semanal', email: 'semanal@ag.com' })

      const ag = await getAsync<{ proxima_execucao: string }>(
        testDb,
        'SELECT proxima_execucao FROM agendamentos WHERE depositante_id = ?',
        [res.body.depositante.id]
      )

      // proxima_execucao <= agora: scheduler processa imediatamente no próximo ciclo
      expect(new Date(ag!.proxima_execucao).getTime()).toBeLessThanOrEqual(Date.now())
      // foi criada durante este teste, não é uma data antiga
      expect(new Date(ag!.proxima_execucao).getTime()).toBeGreaterThanOrEqual(antes - 1000)
    })

    test('agendamento herda a recorrencia do depositante', async () => {
      for (const recorrencia of ['diario', 'semanal', 'mensal', 'anual'] as const) {
        const res = await request(testServer.app)
          .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
          .set('Authorization', `Bearer ${validToken}`)
          .send({ nome: `Dep ${recorrencia}`, valor: 100, recorrencia, email: `${recorrencia}@ag.com` })

        const ag = await getAsync<{ recorrencia: string }>(
          testDb,
          'SELECT recorrencia FROM agendamentos WHERE depositante_id = ?',
          [res.body.depositante.id]
        )

        expect(ag!.recorrencia).toBe(recorrencia)
      }
    })

    // ── Outras validações ─────────────────────────────────────────────────────

    test('retorna 400 quando nome está ausente', async () => {
      const res = await request(testServer.app)
        .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ valor: 500, recorrencia: 'mensal', email: 'nome@ausente.com' })

      expect(res.status).toBe(400)
      expect(res.body.erro).toContain('obrigatório')
    })

    test('retorna 400 quando valor é menor que R$ 0,50', async () => {
      for (const [val, email] of [[0, 'zero@val.com'], [-1, 'neg@val.com'], [0.49, 'abaixo@val.com']]) {
        const res = await request(testServer.app)
          .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
          .set('Authorization', `Bearer ${validToken}`)
          .send({ nome: 'Inválido', valor: val, recorrencia: 'mensal', email })
        expect(res.status).toBe(400)
        expect(res.body.erro).toContain('0,50')
      }
    })

    test('aceita valor exatamente igual a R$ 0,50', async () => {
      const res = await request(testServer.app)
        .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Mínimo', valor: 0.50, recorrencia: 'mensal', email: 'min@val.com' })
      expect(res.status).toBe(201)
      expect(res.body.depositante.valor).toBe(0.5)
    })

    test('retorna 400 para recorrencia inválida', async () => {
      const res = await request(testServer.app)
        .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Dep', valor: 100, recorrencia: 'bimestral', email: 'rec@inv.com' })

      expect(res.status).toBe(400)
      expect(res.body.erro).toContain('Recorrência inválida')
    })

    test('retorna 404 quando kofrinho não existe', async () => {
      const res = await request(testServer.app)
        .post('/api/kofrinhos/99999/depositantes')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Dep', valor: 100, recorrencia: 'mensal', email: 'k@404.com' })

      expect(res.status).toBe(404)
    })

    test('retorna 401 sem token', async () => {
      const res = await request(testServer.app)
        .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
        .send({ nome: 'Dep', valor: 100, recorrencia: 'mensal', email: 'sem@token.com' })

      expect(res.status).toBe(401)
    })
  })

  // ─── PUT /api/kofrinhos/:id/depositantes/:depositanteId ──────────────────

  describe('PUT /api/kofrinhos/:id/depositantes/:depositanteId', () => {
    let depId: number

    beforeEach(async () => {
      const res = await request(testServer.app)
        .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Original', valor: 100, recorrencia: 'mensal', email: 'original@teste.com', telefone: '11 9000-0000' })
      depId = res.body.depositante.id
    })

    test('atualiza todos os campos e retorna 200', async () => {
      const res = await request(testServer.app)
        .put(`/api/kofrinhos/${kofrinhoId}/depositantes/${depId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Atualizado', valor: 500, recorrencia: 'semanal', email: 'novo@teste.com', telefone: '21 8888-7777' })

      expect(res.status).toBe(200)
      expect(res.body.message).toBe('Depositante atualizado com sucesso')
      expect(res.body.depositante).toMatchObject({
        nome: 'Atualizado',
        valor: 500,
        recorrencia: 'semanal',
        email: 'novo@teste.com',
        telefone: '21 8888-7777',
      })
    })

    test('atualiza apenas o nome (patch parcial)', async () => {
      const res = await request(testServer.app)
        .put(`/api/kofrinhos/${kofrinhoId}/depositantes/${depId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Só o Nome' })

      expect(res.status).toBe(200)
      expect(res.body.depositante.nome).toBe('Só o Nome')
      expect(res.body.depositante.email).toBe('original@teste.com')
      expect(res.body.depositante.valor).toBe(100)
    })

    test('atualiza apenas o email', async () => {
      const res = await request(testServer.app)
        .put(`/api/kofrinhos/${kofrinhoId}/depositantes/${depId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ email: 'trocado@email.com' })

      expect(res.status).toBe(200)
      expect(res.body.depositante.email).toBe('trocado@email.com')
      expect(res.body.depositante.nome).toBe('Original')
    })

    test('atualiza apenas o telefone', async () => {
      const res = await request(testServer.app)
        .put(`/api/kofrinhos/${kofrinhoId}/depositantes/${depId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ telefone: '31 7777-6666' })

      expect(res.status).toBe(200)
      expect(res.body.depositante.telefone).toBe('31 7777-6666')
    })

    test('atualiza recorrencia e sincroniza o agendamento', async () => {
      await request(testServer.app)
        .put(`/api/kofrinhos/${kofrinhoId}/depositantes/${depId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ recorrencia: 'anual' })

      const ag = await getAsync<{ recorrencia: string }>(
        testDb,
        'SELECT recorrencia FROM agendamentos WHERE depositante_id = ?',
        [depId]
      )
      expect(ag!.recorrencia).toBe('anual')
    })

    test('retorna 400 para email vazio', async () => {
      const res = await request(testServer.app)
        .put(`/api/kofrinhos/${kofrinhoId}/depositantes/${depId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ email: '' })

      expect(res.status).toBe(400)
      expect(res.body.erro).toContain('obrigatório')
    })

    test('retorna 400 para email inválido', async () => {
      const res = await request(testServer.app)
        .put(`/api/kofrinhos/${kofrinhoId}/depositantes/${depId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ email: 'nao-e-email' })

      expect(res.status).toBe(400)
      expect(res.body.erro).toContain('E-mail inválido')
    })

    test('retorna 400 para valor abaixo de R$ 0,50', async () => {
      for (const valor of [-50, 0, 0.49]) {
        const res = await request(testServer.app)
          .put(`/api/kofrinhos/${kofrinhoId}/depositantes/${depId}`)
          .set('Authorization', `Bearer ${validToken}`)
          .send({ valor })
        expect(res.status).toBe(400)
      }
    })

    test('aceita valor exatamente igual a R$ 0,50 na edição', async () => {
      const res = await request(testServer.app)
        .put(`/api/kofrinhos/${kofrinhoId}/depositantes/${depId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ valor: 0.50 })
      expect(res.status).toBe(200)
      expect(res.body.depositante.valor).toBe(0.5)
    })

    test('retorna 400 para recorrencia inválida', async () => {
      const res = await request(testServer.app)
        .put(`/api/kofrinhos/${kofrinhoId}/depositantes/${depId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ recorrencia: 'bimestral' })

      expect(res.status).toBe(400)
    })

    test('retorna 400 quando nenhum campo é enviado', async () => {
      const res = await request(testServer.app)
        .put(`/api/kofrinhos/${kofrinhoId}/depositantes/${depId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({})

      expect(res.status).toBe(400)
    })

    test('retorna 404 quando depositante não existe', async () => {
      const res = await request(testServer.app)
        .put(`/api/kofrinhos/${kofrinhoId}/depositantes/99999`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'X' })

      expect(res.status).toBe(404)
    })

    test('retorna 404 quando kofrinho não pertence ao usuário', async () => {
      const outro = await request(testServer.app).post('/api/auth/register').send(createValidUser())
      const res = await request(testServer.app)
        .put(`/api/kofrinhos/${kofrinhoId}/depositantes/${depId}`)
        .set('Authorization', `Bearer ${outro.body.token}`)
        .send({ nome: 'X' })

      expect(res.status).toBe(404)
    })

    test('retorna 401 sem token', async () => {
      const res = await request(testServer.app)
        .put(`/api/kofrinhos/${kofrinhoId}/depositantes/${depId}`)
        .send({ nome: 'X' })

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
        .send({ nome: 'D1', valor: 100, recorrencia: 'mensal', email: 'd1@lista.com' })

      await request(testServer.app)
        .post(`/api/kofrinhos/${kId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'D2', valor: 200, recorrencia: 'semanal', email: 'd2@lista.com' })

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
        .send({ nome: 'Para deletar', valor: 300, recorrencia: 'diario', email: 'del@teste.com' })

      const delRes = await request(testServer.app)
        .delete(`/api/kofrinhos/${kofrinhoId}/depositantes/${criaRes.body.depositante.id}`)
        .set('Authorization', `Bearer ${validToken}`)

      expect(delRes.status).toBe(200)
      expect(delRes.body.message).toBe('Depositante removido com sucesso')
    })

    test('deletar depositante remove o agendamento em cascata', async () => {
      const criaRes = await request(testServer.app)
        .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Com Agendamento', valor: 800, recorrencia: 'mensal', email: 'cascade@teste.com' })

      const depId = criaRes.body.depositante.id

      const agAntes = await getAsync<{ id: number }>(
        testDb,
        'SELECT id FROM agendamentos WHERE depositante_id = ?',
        [depId]
      )
      expect(agAntes).toBeDefined()

      await request(testServer.app)
        .delete(`/api/kofrinhos/${kofrinhoId}/depositantes/${depId}`)
        .set('Authorization', `Bearer ${validToken}`)

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

  // ─── Data de início da recorrência (agendamento + envio de solicitação) ──────

  describe('Data de início da recorrência', () => {
    // Extrai o dia local (ano/mês/dia) de uma data ISO — o cálculo de recorrência
    // opera em horário local, então comparamos no mesmo referencial.
    function diaLocal(iso: string) {
      const dt = new Date(iso)
      return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() }
    }

    function novoMockEnvio(): { mockSend: ReturnType<typeof jest.fn>; mockConfrapix: ReturnType<typeof jest.fn> } {
      process.env.KOFRINHO_API_URL = 'https://api.test/api'
      const mockSend: ReturnType<typeof jest.fn> = jest.fn().mockImplementation(() => Promise.resolve())
      const mockConfrapix: ReturnType<typeof jest.fn> = jest.fn().mockImplementation(() =>
        Promise.resolve({ pixUrl: 'data:image/png;base64,QR', pixCode: 'pix-code' })
      )
      return { mockSend, mockConfrapix }
    }

    test('armazena a data de início escolhida no depositante', async () => {
      const res = await request(testServer.app)
        .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Com Data', valor: 100, recorrencia: 'mensal', email: 'comdata@teste.com', data_inicio: '2030-03-15' })

      expect(res.status).toBe(201)
      expect(res.body.depositante.data_inicio).toBe('2030-03-15')

      const row = await getAsync<{ data_inicio: string }>(
        testDb, 'SELECT data_inicio FROM depositantes WHERE id = ?', [res.body.depositante.id]
      )
      expect(row?.data_inicio).toBe('2030-03-15')
    })

    test('o agendamento usa a data escolhida como primeira execução (preserva o dia)', async () => {
      const res = await request(testServer.app)
        .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Dia 15', valor: 100, recorrencia: 'mensal', email: 'dia15@teste.com', data_inicio: '2030-03-15' })

      const ag = await getAsync<{ proxima_execucao: string }>(
        testDb, 'SELECT proxima_execucao FROM agendamentos WHERE depositante_id = ?', [res.body.depositante.id]
      )
      expect(diaLocal(ag!.proxima_execucao)).toEqual({ y: 2030, m: 3, d: 15 })
    })

    test('retorna 400 para data_inicio em formato inválido', async () => {
      for (const data_inicio of ['ontem', '15/03/2030', '2030-13-40', '2030-02-30']) {
        const res = await request(testServer.app)
          .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
          .set('Authorization', `Bearer ${validToken}`)
          .send({ nome: 'Data Ruim', valor: 100, recorrencia: 'mensal', email: 'dataruim@teste.com', data_inicio })
        expect(res.status).toBe(400)
        expect(res.body.erro).toContain('Data de início inválida')
      }
    })

    test('NÃO envia a solicitação antes da data escolhida (data futura)', async () => {
      const emailUnico = `futuro-${Date.now()}@teste.com`
      const res = await request(testServer.app)
        .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Futuro', valor: 100, recorrencia: 'mensal', email: emailUnico, data_inicio: '2100-06-15' })
      const depId = res.body.depositante.id

      const { mockSend, mockConfrapix } = novoMockEnvio()
      await processarAgendamentos(testDb, mockSend, mockConfrapix)

      // o depositante com data futura não deve ter recebido e-mail
      expect(mockSend.mock.calls.some((c) => c[0] === emailUnico)).toBe(false)

      // e a próxima execução continua sendo a data futura escolhida
      const ag = await getAsync<{ proxima_execucao: string }>(
        testDb, 'SELECT proxima_execucao FROM agendamentos WHERE depositante_id = ?', [depId]
      )
      expect(diaLocal(ag!.proxima_execucao)).toEqual({ y: 2100, m: 6, d: 15 })
      delete process.env.KOFRINHO_API_URL
    })

    test('envia a solicitação (e-mail) corretamente quando a data escolhida já chegou', async () => {
      const emailUnico = `passado-${Date.now()}@teste.com`
      await request(testServer.app)
        .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Passado', valor: 250, recorrencia: 'mensal', email: emailUnico, data_inicio: '2020-01-10' })

      const { mockSend, mockConfrapix } = novoMockEnvio()
      await processarAgendamentos(testDb, mockSend, mockConfrapix)

      const chamada = mockSend.mock.calls.find((c) => c[0] === emailUnico)
      expect(chamada).toBeDefined()
      // args do sendFn: [email, nomeDono, nomeKofrinho, descricao, valor, recorrencia, pixUrl, pixCode]
      expect(chamada![4]).toBe(250)
      expect(chamada![5]).toBe('mensal')
      delete process.env.KOFRINHO_API_URL
    })

    test('atualizar a data de início recalcula a próxima execução do agendamento', async () => {
      const res = await request(testServer.app)
        .post(`/api/kofrinhos/${kofrinhoId}/depositantes`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ nome: 'Edita Data', valor: 100, recorrencia: 'anual', email: 'editadata@teste.com', data_inicio: '2030-03-15' })
      const depId = res.body.depositante.id

      await request(testServer.app)
        .put(`/api/kofrinhos/${kofrinhoId}/depositantes/${depId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ data_inicio: '2031-09-20' })

      const ag = await getAsync<{ proxima_execucao: string }>(
        testDb, 'SELECT proxima_execucao FROM agendamentos WHERE depositante_id = ?', [depId]
      )
      expect(diaLocal(ag!.proxima_execucao)).toEqual({ y: 2031, m: 9, d: 20 })
    })
  })
})

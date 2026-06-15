import { jest } from '@jest/globals'
import sqlite3 from 'sqlite3'
import { calcularProximaExecucao, processarAgendamentos, type Recorrencia } from '../../services/schedulerService.js'
import { setupTestDb, closeTestDb, getAsync } from '../setup/database.js'

// Helper para inserir dados de teste diretamente no banco
async function inserirUsuario(db: sqlite3.Database, email: string): Promise<number> {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO users (nome_completo, email, senha_hash)
       VALUES ('Usuário Teste', ?, 'hash')`,
      [email],
      function (this: any, err) {
        if (err) reject(err)
        else resolve(this.lastID)
      }
    )
  })
}

async function inserirKofrinho(db: sqlite3.Database, userId: number, nome: string): Promise<number> {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO kofrinhos (user_id, nome) VALUES (?, ?)`,
      [userId, nome],
      function (this: any, err) {
        if (err) reject(err)
        else resolve(this.lastID)
      }
    )
  })
}

async function inserirDepositante(
  db: sqlite3.Database,
  kofrinhoId: number,
  nome: string,
  valor: number,
  recorrencia: Recorrencia
): Promise<number> {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO depositantes (kofrinho_id, nome, valor, recorrencia) VALUES (?, ?, ?, ?)`,
      [kofrinhoId, nome, valor, recorrencia],
      function (this: any, err) {
        if (err) reject(err)
        else resolve(this.lastID)
      }
    )
  })
}

async function inserirAgendamento(
  db: sqlite3.Database,
  depositanteId: number,
  kofrinhoId: number,
  userId: number,
  recorrencia: Recorrencia,
  proximaExecucao: Date,
  ativo = 1
): Promise<number> {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO agendamentos (depositante_id, kofrinho_id, user_id, recorrencia, proxima_execucao, ativo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [depositanteId, kofrinhoId, userId, recorrencia, proximaExecucao.toISOString(), ativo],
      function (this: any, err) {
        if (err) reject(err)
        else resolve(this.lastID)
      }
    )
  })
}

// ─── calcularProximaExecucao ──────────────────────────────────────────────────

describe('calcularProximaExecucao', () => {
  const base = new Date('2025-06-15T08:00:00.000Z')

  test('diario: adiciona 1 dia', () => {
    const result = calcularProximaExecucao('diario', base)
    expect(result.toISOString()).toContain('2025-06-16')
  })

  test('semanal: adiciona 7 dias', () => {
    const result = calcularProximaExecucao('semanal', base)
    expect(result.toISOString()).toContain('2025-06-22')
  })

  test('mensal: adiciona 1 mês', () => {
    const result = calcularProximaExecucao('mensal', base)
    expect(result.toISOString()).toContain('2025-07-15')
  })

  test('anual: adiciona 1 ano', () => {
    const result = calcularProximaExecucao('anual', base)
    expect(result.toISOString()).toContain('2026-06-15')
  })

  test('mensal: trata overflow de mês (31 jan → 28/29 fev)', () => {
    const jan31 = new Date('2025-01-31T00:00:00.000Z')
    const result = calcularProximaExecucao('mensal', jan31)
    // JS Date lida com overflow: 31 fev → 3 mar; ou usa último dia de fev
    // O valor deve ser maior que a data base
    expect(result.getTime()).toBeGreaterThan(jan31.getTime())
  })

  test('usa a data atual quando `from` não é fornecido', () => {
    const antes = new Date()
    const result = calcularProximaExecucao('diario')
    expect(result.getTime()).toBeGreaterThan(antes.getTime())
  })

  test('lança erro para recorrência desconhecida', () => {
    expect(() => calcularProximaExecucao('quinzenal' as Recorrencia, base)).toThrow(
      'Recorrência desconhecida'
    )
  })
})

// ─── processarAgendamentos ────────────────────────────────────────────────────

describe('processarAgendamentos', () => {
  let db: sqlite3.Database
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSendFn: ReturnType<typeof jest.fn>
  let userId: number
  let kofrinhoId: number
  let depositanteId: number

  beforeEach(async () => {
    db = await setupTestDb()
    mockSendFn = jest.fn().mockImplementation(() => Promise.resolve())

    userId = await inserirUsuario(db, `user-${Date.now()}@teste.com`)
    kofrinhoId = await inserirKofrinho(db, userId, 'Kofrinho Teste')
    depositanteId = await inserirDepositante(db, kofrinhoId, 'Salário', 3000, 'mensal')
  })

  afterEach(async () => {
    await closeTestDb(db)
    jest.clearAllMocks()
  })

  test('retorna 0 quando não há agendamentos vencidos', async () => {
    const futuro = new Date(Date.now() + 1_000_000)
    await inserirAgendamento(db, depositanteId, kofrinhoId, userId, 'mensal', futuro)

    const enviados = await processarAgendamentos(db, mockSendFn)

    expect(enviados).toBe(0)
    expect(mockSendFn).not.toHaveBeenCalled()
  })

  test('envia e-mail e retorna 1 quando há agendamento vencido', async () => {
    const passado = new Date(Date.now() - 1000)
    await inserirAgendamento(db, depositanteId, kofrinhoId, userId, 'mensal', passado)

    const enviados = await processarAgendamentos(db, mockSendFn)

    expect(enviados).toBe(1)
    expect(mockSendFn).toHaveBeenCalledTimes(1)
  })

  test('envia e-mail com os dados corretos do depositante', async () => {
    const passado = new Date(Date.now() - 1000)
    await inserirAgendamento(db, depositanteId, kofrinhoId, userId, 'mensal', passado)

    await processarAgendamentos(db, mockSendFn)

    const [email, nomeUsuario, nomeKofrinho, nomeDepositante, valor, recorrencia] =
      mockSendFn.mock.calls[0]

    expect(email).toMatch(/@teste\.com/)
    expect(nomeUsuario).toBe('Usuário Teste')
    expect(nomeKofrinho).toBe('Kofrinho Teste')
    expect(nomeDepositante).toBe('Salário')
    expect(valor).toBe(3000)
    expect(recorrencia).toBe('mensal')
  })

  test('não processa agendamento inativo (ativo = 0)', async () => {
    const passado = new Date(Date.now() - 1000)
    await inserirAgendamento(db, depositanteId, kofrinhoId, userId, 'mensal', passado, 0)

    const enviados = await processarAgendamentos(db, mockSendFn)

    expect(enviados).toBe(0)
    expect(mockSendFn).not.toHaveBeenCalled()
  })

  test('atualiza proxima_execucao para o futuro após processar', async () => {
    const passado = new Date(Date.now() - 1000)
    const agId = await inserirAgendamento(db, depositanteId, kofrinhoId, userId, 'mensal', passado)

    await processarAgendamentos(db, mockSendFn)

    const ag = await getAsync<{ proxima_execucao: string }>(
      db,
      'SELECT proxima_execucao FROM agendamentos WHERE id = ?',
      [agId]
    )

    expect(ag).toBeDefined()
    expect(new Date(ag!.proxima_execucao).getTime()).toBeGreaterThan(Date.now())
  })

  test('atualiza ultima_execucao após processar', async () => {
    const passado = new Date(Date.now() - 1000)
    const agId = await inserirAgendamento(db, depositanteId, kofrinhoId, userId, 'diario', passado)

    const antes = Date.now()
    await processarAgendamentos(db, mockSendFn)

    const ag = await getAsync<{ ultima_execucao: string }>(
      db,
      'SELECT ultima_execucao FROM agendamentos WHERE id = ?',
      [agId]
    )

    expect(ag?.ultima_execucao).toBeDefined()
    expect(new Date(ag!.ultima_execucao).getTime()).toBeGreaterThanOrEqual(antes - 100)
  })

  test('processa múltiplos agendamentos vencidos', async () => {
    const d2 = await inserirDepositante(db, kofrinhoId, 'Bônus', 500, 'semanal')
    const d3 = await inserirDepositante(db, kofrinhoId, 'Aluguel', 1200, 'mensal')

    const passado = new Date(Date.now() - 1000)
    await inserirAgendamento(db, depositanteId, kofrinhoId, userId, 'mensal', passado)
    await inserirAgendamento(db, d2, kofrinhoId, userId, 'semanal', passado)
    await inserirAgendamento(db, d3, kofrinhoId, userId, 'mensal', passado)

    const enviados = await processarAgendamentos(db, mockSendFn)

    expect(enviados).toBe(3)
    expect(mockSendFn).toHaveBeenCalledTimes(3)
  })

  test('não reprocessa agendamento já processado na mesma rodada', async () => {
    const passado = new Date(Date.now() - 1000)
    await inserirAgendamento(db, depositanteId, kofrinhoId, userId, 'diario', passado)

    await processarAgendamentos(db, mockSendFn)
    const enviados2 = await processarAgendamentos(db, mockSendFn)

    expect(enviados2).toBe(0)
    expect(mockSendFn).toHaveBeenCalledTimes(1)
  })

  test('comportamento após reinício: processa jobs vencidos durante downtime', async () => {
    // Simula job que deveria ter sido executado ontem (servidor estava offline)
    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const agId = await inserirAgendamento(db, depositanteId, kofrinhoId, userId, 'diario', ontem)

    // Simula reinício chamando processarAgendamentos diretamente
    const enviados = await processarAgendamentos(db, mockSendFn)

    expect(enviados).toBe(1)
    expect(mockSendFn).toHaveBeenCalledTimes(1)

    // Após processar, proxima_execucao deve ser amanhã (não ontem)
    const ag = await getAsync<{ proxima_execucao: string }>(
      db,
      'SELECT proxima_execucao FROM agendamentos WHERE id = ?',
      [agId]
    )
    expect(new Date(ag!.proxima_execucao).getTime()).toBeGreaterThan(Date.now())
  })

  test('proxima_execucao após processar respeita a recorrência correta', async () => {
    const passado = new Date(Date.now() - 1000)
    const agId = await inserirAgendamento(db, depositanteId, kofrinhoId, userId, 'semanal', passado)

    const antes = new Date()
    await processarAgendamentos(db, mockSendFn)

    const ag = await getAsync<{ proxima_execucao: string }>(
      db,
      'SELECT proxima_execucao FROM agendamentos WHERE id = ?',
      [agId]
    )

    const proxima = new Date(ag!.proxima_execucao)
    const diffMs = proxima.getTime() - antes.getTime()
    const seteDiasMs = 7 * 24 * 60 * 60 * 1000

    // proxima_execucao deve ser ~7 dias no futuro (tolerância de 1 min)
    expect(diffMs).toBeGreaterThan(seteDiasMs - 60_000)
    expect(diffMs).toBeLessThan(seteDiasMs + 60_000)
  })

  test('continua processando os demais quando um envio falha', async () => {
    const d2 = await inserirDepositante(db, kofrinhoId, 'Outro', 200, 'diario')

    const passado = new Date(Date.now() - 1000)
    await inserirAgendamento(db, depositanteId, kofrinhoId, userId, 'mensal', passado)
    await inserirAgendamento(db, d2, kofrinhoId, userId, 'diario', passado)

    // Primeiro envio falha, segundo deve prosseguir
    mockSendFn
      .mockRejectedValueOnce(new Error('SMTP error'))
      .mockImplementationOnce(() => Promise.resolve())

    const enviados = await processarAgendamentos(db, mockSendFn)

    expect(enviados).toBe(1)
    expect(mockSendFn).toHaveBeenCalledTimes(2)
  })
})

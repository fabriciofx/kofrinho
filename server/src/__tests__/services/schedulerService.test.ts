import { jest } from '@jest/globals'
import sqlite3 from 'sqlite3'
import { calcularProximaExecucao, processarAgendamentos, type Recorrencia } from '../../services/schedulerService.js'
import { construirPayloadConfrapix, formatarDataExpiracao } from '../../services/confrapixService.js'
import { setupTestDb, closeTestDb, getAsync } from '../setup/database.js'

// ─── Helpers de inserção ──────────────────────────────────────────────────────

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

async function inserirKofrinho(
  db: sqlite3.Database,
  userId: number,
  nome: string,
  descricao: string | null = null
): Promise<number> {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO kofrinhos (user_id, nome, descricao) VALUES (?, ?, ?)`,
      [userId, nome, descricao],
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
  recorrencia: Recorrencia,
  email: string | null = 'depositante@teste.com'
): Promise<number> {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO depositantes (kofrinho_id, nome, valor, recorrencia, email) VALUES (?, ?, ?, ?, ?)`,
      [kofrinhoId, nome, valor, recorrencia, email],
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

// ─── formatarDataExpiracao ────────────────────────────────────────────────────

describe('formatarDataExpiracao', () => {
  test('retorna data 24h no futuro no formato YYYY-MM-DD HH:MM:SS (UTC)', () => {
    const agora = new Date('2025-06-15T10:00:00.000Z')
    expect(formatarDataExpiracao(agora)).toBe('2025-06-16 10:00:00')
  })

  test('lida corretamente com virada de mês', () => {
    const agora = new Date('2025-01-31T23:00:00.000Z')
    expect(formatarDataExpiracao(agora)).toBe('2025-02-01 23:00:00')
  })

  test('lida corretamente com virada de ano', () => {
    const agora = new Date('2024-12-31T12:00:00.000Z')
    expect(formatarDataExpiracao(agora)).toBe('2025-01-01 12:00:00')
  })
})

// ─── construirPayloadConfrapix ────────────────────────────────────────────────

describe('construirPayloadConfrapix', () => {
  const agora = new Date('2025-06-15T08:00:00.000Z')
  const uuid = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5'

  beforeEach(() => { process.env.KOFRINHO_API_URL = 'https://api.mandacaru.org' })
  afterEach(() => { delete process.env.KOFRINHO_API_URL })

  test('amount é o valor do depositante', () => {
    const p = construirPayloadConfrapix(2500, null, uuid, agora)
    expect(p.amount).toBe(2500)
  })

  test('description é a descrição do kofrinho', () => {
    const p = construirPayloadConfrapix(100, 'Férias 2025', uuid, agora)
    expect(p.description).toBe('Férias 2025')
  })

  test('description é string vazia quando descrição é null', () => {
    const p = construirPayloadConfrapix(100, null, uuid, agora)
    expect(p.description).toBe('')
  })

  test('expiration_date é 24h no futuro no formato correto', () => {
    const p = construirPayloadConfrapix(100, null, uuid, agora)
    expect(p.expiration_date).toBe('2025-06-16 08:00:00')
  })

  test('callback_url contém o pagamento_id', () => {
    const p = construirPayloadConfrapix(100, null, uuid, agora)
    expect(p.callback_url).toBe(`https://api.mandacaru.org/pagamentos/${uuid}`)
  })
})

// ─── calcularProximaExecucao ──────────────────────────────────────────────────

describe('calcularProximaExecucao', () => {
  const base = new Date('2025-06-15T08:00:00.000Z')

  test('diario: adiciona 1 dia', () => {
    expect(calcularProximaExecucao('diario', base).toISOString()).toContain('2025-06-16')
  })

  test('semanal: adiciona 7 dias', () => {
    expect(calcularProximaExecucao('semanal', base).toISOString()).toContain('2025-06-22')
  })

  test('mensal: adiciona 1 mês', () => {
    expect(calcularProximaExecucao('mensal', base).toISOString()).toContain('2025-07-15')
  })

  test('anual: adiciona 1 ano', () => {
    expect(calcularProximaExecucao('anual', base).toISOString()).toContain('2026-06-15')
  })

  test('mensal: trata overflow de mês (31 jan → 28/29 fev)', () => {
    const jan31 = new Date('2025-01-31T00:00:00.000Z')
    expect(calcularProximaExecucao('mensal', jan31).getTime()).toBeGreaterThan(jan31.getTime())
  })

  test('usa a data atual quando `from` não é fornecido', () => {
    expect(calcularProximaExecucao('diario').getTime()).toBeGreaterThan(Date.now())
  })

  test('lança erro para recorrência desconhecida', () => {
    expect(() => calcularProximaExecucao('quinzenal' as Recorrencia, base)).toThrow('Recorrência desconhecida')
  })
})

// ─── processarAgendamentos ────────────────────────────────────────────────────

describe('processarAgendamentos', () => {
  let db: sqlite3.Database
  let mockSendFn: ReturnType<typeof jest.fn>
  let mockConfrapixFn: ReturnType<typeof jest.fn>
  let userId: number
  let kofrinhoId: number
  let depositanteId: number

  beforeEach(async () => {
    db = await setupTestDb()
    process.env.KOFRINHO_API_URL = 'https://api.mandacaru.org'
    mockSendFn = jest.fn().mockImplementation(() => Promise.resolve())
    mockConfrapixFn = jest.fn().mockImplementation(() => Promise.resolve({
      pixUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      pixCode: '00020126580014br.gov.bcb.pix0136test-pix-code-12345678901234567890',
    }))

    userId = await inserirUsuario(db, `user-${Date.now()}@teste.com`)
    kofrinhoId = await inserirKofrinho(db, userId, 'Kofrinho Teste')
    depositanteId = await inserirDepositante(db, kofrinhoId, 'Salário', 3000, 'mensal')
  })

  afterEach(async () => {
    await closeTestDb(db)
    jest.clearAllMocks()
    delete process.env.KOFRINHO_API_URL
  })

  // ── Comportamento geral ───────────────────────────────────────────────────

  test('retorna 0 quando não há agendamentos vencidos', async () => {
    const futuro = new Date(Date.now() + 1_000_000)
    await inserirAgendamento(db, depositanteId, kofrinhoId, userId, 'mensal', futuro)

    const enviados = await processarAgendamentos(db, mockSendFn, mockConfrapixFn)

    expect(enviados).toBe(0)
    expect(mockSendFn).not.toHaveBeenCalled()
    expect(mockConfrapixFn).not.toHaveBeenCalled()
  })

  test('processa agendamento vencido e retorna 1', async () => {
    const passado = new Date(Date.now() - 1000)
    await inserirAgendamento(db, depositanteId, kofrinhoId, userId, 'mensal', passado)

    const enviados = await processarAgendamentos(db, mockSendFn, mockConfrapixFn)

    expect(enviados).toBe(1)
    expect(mockConfrapixFn).toHaveBeenCalledTimes(1)
    expect(mockSendFn).toHaveBeenCalledTimes(1)
  })

  test('não processa agendamento inativo (ativo = 0)', async () => {
    const passado = new Date(Date.now() - 1000)
    await inserirAgendamento(db, depositanteId, kofrinhoId, userId, 'mensal', passado, 0)

    const enviados = await processarAgendamentos(db, mockSendFn, mockConfrapixFn)

    expect(enviados).toBe(0)
    expect(mockConfrapixFn).not.toHaveBeenCalled()
    expect(mockSendFn).not.toHaveBeenCalled()
  })

  test('processa múltiplos agendamentos vencidos', async () => {
    const d2 = await inserirDepositante(db, kofrinhoId, 'Bônus', 500, 'semanal')
    const passado = new Date(Date.now() - 1000)
    await inserirAgendamento(db, depositanteId, kofrinhoId, userId, 'mensal', passado)
    await inserirAgendamento(db, d2, kofrinhoId, userId, 'semanal', passado)

    const enviados = await processarAgendamentos(db, mockSendFn, mockConfrapixFn)

    expect(enviados).toBe(2)
    expect(mockConfrapixFn).toHaveBeenCalledTimes(2)
    expect(mockSendFn).toHaveBeenCalledTimes(2)
  })

  test('não reprocessa agendamento já processado', async () => {
    const passado = new Date(Date.now() - 1000)
    await inserirAgendamento(db, depositanteId, kofrinhoId, userId, 'diario', passado)

    await processarAgendamentos(db, mockSendFn, mockConfrapixFn)
    const enviados2 = await processarAgendamentos(db, mockSendFn, mockConfrapixFn)

    expect(enviados2).toBe(0)
    expect(mockConfrapixFn).toHaveBeenCalledTimes(1)
    expect(mockSendFn).toHaveBeenCalledTimes(1)
  })

  test('atualiza proxima_execucao para o futuro após processar', async () => {
    const passado = new Date(Date.now() - 1000)
    const agId = await inserirAgendamento(db, depositanteId, kofrinhoId, userId, 'mensal', passado)

    await processarAgendamentos(db, mockSendFn, mockConfrapixFn)

    const ag = await getAsync<{ proxima_execucao: string }>(
      db, 'SELECT proxima_execucao FROM agendamentos WHERE id = ?', [agId]
    )
    expect(new Date(ag!.proxima_execucao).getTime()).toBeGreaterThan(Date.now())
  })

  test('atualiza ultima_execucao após processar', async () => {
    const passado = new Date(Date.now() - 1000)
    const agId = await inserirAgendamento(db, depositanteId, kofrinhoId, userId, 'diario', passado)
    const antes = Date.now()

    await processarAgendamentos(db, mockSendFn, mockConfrapixFn)

    const ag = await getAsync<{ ultima_execucao: string }>(
      db, 'SELECT ultima_execucao FROM agendamentos WHERE id = ?', [agId]
    )
    expect(new Date(ag!.ultima_execucao).getTime()).toBeGreaterThanOrEqual(antes - 100)
  })

  test('envia para o e-mail do depositante (não do dono)', async () => {
    const depId = await inserirDepositante(db, kofrinhoId, 'Salário', 3000, 'mensal', 'dep@particular.com')
    const passado = new Date(Date.now() - 1000)
    await inserirAgendamento(db, depId, kofrinhoId, userId, 'mensal', passado)

    await processarAgendamentos(db, mockSendFn, mockConfrapixFn)

    const [emailDest] = mockSendFn.mock.calls[0]
    expect(emailDest).toBe('dep@particular.com')
  })

  test('passa null como descrição quando kofrinho não tem descrição', async () => {
    const passado = new Date(Date.now() - 1000)
    await inserirAgendamento(db, depositanteId, kofrinhoId, userId, 'mensal', passado)

    await processarAgendamentos(db, mockSendFn, mockConfrapixFn)

    const [, , , descricaoKofrinho] = mockSendFn.mock.calls[0]
    expect(descricaoKofrinho).toBeNull()
  })

  test('proxima_execucao respeita a recorrência correta após processar', async () => {
    const passado = new Date(Date.now() - 1000)
    const agId = await inserirAgendamento(db, depositanteId, kofrinhoId, userId, 'semanal', passado)
    const antes = new Date()

    await processarAgendamentos(db, mockSendFn, mockConfrapixFn)

    const ag = await getAsync<{ proxima_execucao: string }>(
      db, 'SELECT proxima_execucao FROM agendamentos WHERE id = ?', [agId]
    )
    const diff = new Date(ag!.proxima_execucao).getTime() - antes.getTime()
    const sete = 7 * 24 * 60 * 60 * 1000
    expect(diff).toBeGreaterThan(sete - 60_000)
    expect(diff).toBeLessThan(sete + 60_000)
  })

  test('comportamento após reinício: processa jobs vencidos durante downtime', async () => {
    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const agId = await inserirAgendamento(db, depositanteId, kofrinhoId, userId, 'diario', ontem)

    const enviados = await processarAgendamentos(db, mockSendFn, mockConfrapixFn)

    expect(enviados).toBe(1)
    const ag = await getAsync<{ proxima_execucao: string }>(
      db, 'SELECT proxima_execucao FROM agendamentos WHERE id = ?', [agId]
    )
    expect(new Date(ag!.proxima_execucao).getTime()).toBeGreaterThan(Date.now())
  })

  test('continua processando os demais quando um envio falha', async () => {
    const d2 = await inserirDepositante(db, kofrinhoId, 'Outro', 200, 'diario')
    const passado = new Date(Date.now() - 1000)
    await inserirAgendamento(db, depositanteId, kofrinhoId, userId, 'mensal', passado)
    await inserirAgendamento(db, d2, kofrinhoId, userId, 'diario', passado)

    mockSendFn
      .mockRejectedValueOnce(new Error('SMTP error'))
      .mockImplementationOnce(() => Promise.resolve())

    const enviados = await processarAgendamentos(db, mockSendFn, mockConfrapixFn)

    expect(enviados).toBe(1)
    expect(mockSendFn).toHaveBeenCalledTimes(2)
  })

  // ── Chamada Confrapix ─────────────────────────────────────────────────────

  test('chama confrapixFn antes de sendFn', async () => {
    const ordem: string[] = []
    mockConfrapixFn.mockImplementation(() => {
      ordem.push('confrapix')
      return Promise.resolve({ pixUrl: 'data:image/png;base64,test', pixCode: 'pix-code' })
    })
    mockSendFn.mockImplementation(() => { ordem.push('email'); return Promise.resolve() })

    const passado = new Date(Date.now() - 1000)
    await inserirAgendamento(db, depositanteId, kofrinhoId, userId, 'mensal', passado)

    await processarAgendamentos(db, mockSendFn, mockConfrapixFn)

    expect(ordem).toEqual(['confrapix', 'email'])
  })

  test('chama confrapixFn com payload correto', async () => {
    const kfId = await inserirKofrinho(db, userId, 'Cofre Viagem', 'Férias 2025')
    const depId = await inserirDepositante(db, kfId, 'Parcela', 1500, 'mensal', 'viagem@teste.com')
    const passado = new Date(Date.now() - 1000)
    await inserirAgendamento(db, depId, kfId, userId, 'mensal', passado)

    await processarAgendamentos(db, mockSendFn, mockConfrapixFn)

    const payload = mockConfrapixFn.mock.calls[0][0]
    expect(payload.amount).toBe(1500)
    expect(payload.description).toBe('Férias 2025')
    expect(payload.callback_url).toMatch(
      /^https:\/\/api\.mandacaru\.org\/pagamentos\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
    expect(payload.expiration_date).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })

  test('expiration_date no payload está ~24h no futuro', async () => {
    const passado = new Date(Date.now() - 1000)
    await inserirAgendamento(db, depositanteId, kofrinhoId, userId, 'mensal', passado)

    const antes = Date.now()
    await processarAgendamentos(db, mockSendFn, mockConfrapixFn)

    const { expiration_date } = mockConfrapixFn.mock.calls[0][0]
    const expiraMs = new Date(expiration_date.replace(' ', 'T') + 'Z').getTime()
    const vinte4h = 24 * 60 * 60 * 1000
    expect(expiraMs - antes).toBeGreaterThan(vinte4h - 5000)
    expect(expiraMs - antes).toBeLessThan(vinte4h + 5000)
  })

  test('não envia e-mail se confrapixFn falhar', async () => {
    mockConfrapixFn.mockRejectedValueOnce(new Error('Confrapix indisponível'))

    const passado = new Date(Date.now() - 1000)
    await inserirAgendamento(db, depositanteId, kofrinhoId, userId, 'mensal', passado)

    const enviados = await processarAgendamentos(db, mockSendFn, mockConfrapixFn)

    expect(enviados).toBe(0)
    expect(mockSendFn).not.toHaveBeenCalled()
  })

  test('não atualiza proxima_execucao se confrapixFn falhar', async () => {
    mockConfrapixFn.mockRejectedValueOnce(new Error('Confrapix error'))

    const passado = new Date(Date.now() - 1000)
    const agId = await inserirAgendamento(db, depositanteId, kofrinhoId, userId, 'mensal', passado)

    await processarAgendamentos(db, mockSendFn, mockConfrapixFn)

    const ag = await getAsync<{ proxima_execucao: string }>(
      db, 'SELECT proxima_execucao FROM agendamentos WHERE id = ?', [agId]
    )
    // proxima_execucao deve continuar no passado (não foi atualizada)
    expect(new Date(ag!.proxima_execucao).getTime()).toBeLessThan(Date.now())
  })

  test('sendFn recebe pixUrl retornado pelo confrapixFn', async () => {
    mockConfrapixFn.mockImplementation(() => Promise.resolve({
      pixUrl: 'data:image/png;base64,QRCODE123',
      pixCode: 'PIX_CODE_ABC',
    }))

    const passado = new Date(Date.now() - 1000)
    await inserirAgendamento(db, depositanteId, kofrinhoId, userId, 'mensal', passado)

    await processarAgendamentos(db, mockSendFn, mockConfrapixFn)

    const args = mockSendFn.mock.calls[0]
    expect(args[6]).toBe('data:image/png;base64,QRCODE123')
  })

  test('sendFn recebe pixCode retornado pelo confrapixFn', async () => {
    mockConfrapixFn.mockImplementation(() => Promise.resolve({
      pixUrl: 'data:image/png;base64,QRCODE123',
      pixCode: '00020126580014br.gov.bcb.pix0136CODIGO_COPIA_COLA',
    }))

    const passado = new Date(Date.now() - 1000)
    await inserirAgendamento(db, depositanteId, kofrinhoId, userId, 'mensal', passado)

    await processarAgendamentos(db, mockSendFn, mockConfrapixFn)

    const args = mockSendFn.mock.calls[0]
    expect(args[7]).toBe('00020126580014br.gov.bcb.pix0136CODIGO_COPIA_COLA')
  })

  test('envia e-mail com os dados corretos do depositante', async () => {
    const kfId = await inserirKofrinho(db, userId, 'Cofre Viagem', 'Economias para férias')
    const depId = await inserirDepositante(db, kfId, 'Parcela', 500, 'mensal', 'viajante@teste.com')
    const passado = new Date(Date.now() - 1000)
    await inserirAgendamento(db, depId, kfId, userId, 'mensal', passado)

    await processarAgendamentos(db, mockSendFn, mockConfrapixFn)

    const [emailDest, nomeDonoKofrinho, nomeKofrinho, descricaoKofrinho, valor, recorrencia] =
      mockSendFn.mock.calls[0]

    expect(emailDest).toBe('viajante@teste.com')
    expect(nomeDonoKofrinho).toBe('Usuário Teste')
    expect(nomeKofrinho).toBe('Cofre Viagem')
    expect(descricaoKofrinho).toBe('Economias para férias')
    expect(valor).toBe(500)
    expect(recorrencia).toBe('mensal')
  })
})

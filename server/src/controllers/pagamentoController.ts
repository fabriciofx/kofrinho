import { Request, Response } from 'express'
import { getAsync, allAsync, runAsync } from '../database/db.js'
import { AuthRequest } from '../middleware/auth.js'
import { Pagamento } from '../types/index.js'

// ─── SSE: registro de clientes por kofrinho ───────────────────────────────────
const sseClients = new Map<number, Set<Response>>()

function adicionarSseClient(kofrinhoId: number, res: Response): void {
  if (!sseClients.has(kofrinhoId)) sseClients.set(kofrinhoId, new Set())
  sseClients.get(kofrinhoId)!.add(res)
}

function removerSseClient(kofrinhoId: number, res: Response): void {
  const set = sseClients.get(kofrinhoId)
  if (!set) return
  set.delete(res)
  if (set.size === 0) sseClients.delete(kofrinhoId)
}

function notificarKofrinho(kofrinhoId: number): void {
  const clients = sseClients.get(kofrinhoId)
  if (!clients) return
  for (const res of clients) {
    res.write(`data: ${JSON.stringify({ tipo: 'pagamento_confirmado' })}\n\n`)
  }
}

interface DbInjectedRequest extends Request {
  testDb?: any
}

interface DbInjectedAuthRequest extends AuthRequest {
  testDb?: any
}

function getDbAsync<T>(req: any, sql: string, params: any[]) {
  const db = req.testDb
  if (db) {
    return new Promise<T | undefined>((resolve, reject) => {
      db.get(sql, params, (err: Error | null, row: T) => {
        if (err) reject(err)
        else resolve(row as T | undefined)
      })
    })
  }
  return getAsync<T>(sql, params)
}

function allDbAsync<T>(req: any, sql: string, params: any[]) {
  const db = req.testDb
  if (db) {
    return new Promise<T[]>((resolve, reject) => {
      db.all(sql, params, (err: Error | null, rows: T[]) => {
        if (err) reject(err)
        else resolve(rows || [])
      })
    })
  }
  return allAsync<T>(sql, params)
}

function runDbAsync(req: any, sql: string, params: any[]): Promise<void> {
  const db = req.testDb
  if (db) {
    return new Promise<void>((resolve, reject) => {
      db.run(sql, params, (err: Error | null) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }
  return runAsync(sql, params)
}

// Webhook chamado pela Confrapix quando o pagamento é confirmado
// POST /api/pagamentos/:pagamentoId
export async function registrarPagamento(req: DbInjectedRequest, res: Response) {
  try {
    const { pagamentoId } = req.params

    const pagamento = await getDbAsync<{ id: number; pago: number; kofrinho_id: number }>(req,
      'SELECT id, pago, kofrinho_id FROM pagamentos WHERE pagamento_id = ?',
      [pagamentoId]
    )
    if (!pagamento) {
      return res.status(404).json({ erro: 'Pagamento não encontrado' })
    }

    await runDbAsync(req,
      'UPDATE pagamentos SET pago = 1, pago_em = CURRENT_TIMESTAMP WHERE pagamento_id = ?',
      [pagamentoId]
    )

    notificarKofrinho(pagamento.kofrinho_id)

    console.log(`✅ Pagamento confirmado: ${pagamentoId}`)
    return res.status(200).json({ message: 'Pagamento confirmado com sucesso' })
  } catch (err) {
    console.error('❌ Erro ao confirmar pagamento:', err)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

// SSE: stream de eventos de pagamento para um kofrinho (requer auth)
// GET /api/kofrinhos/:id/pagamentos/eventos
export async function streamPagamentosEventos(req: DbInjectedAuthRequest, res: Response): Promise<void> {
  const kofrinhoId = parseInt(req.params.id)
  const userId = req.userId!

  const kofrinho = await getDbAsync<{ id: number }>(req,
    'SELECT id FROM kofrinhos WHERE id = ? AND user_id = ?',
    [kofrinhoId, userId]
  )
  if (!kofrinho) {
    res.status(404).json({ erro: 'Kofrinho não encontrado' })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  res.write(': connected\n\n')
  adicionarSseClient(kofrinhoId, res)

  // Heartbeat a cada 30s para manter a conexão viva em proxies
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 30000)

  res.on('close', () => {
    clearInterval(heartbeat)
    removerSseClient(kofrinhoId, res)
  })
}

// Listagem de pagamentos confirmados de um kofrinho (requer auth)
// GET /api/kofrinhos/:id/pagamentos
export async function listPagamentos(req: DbInjectedAuthRequest, res: Response) {
  try {
    const { id: kofrinhoId } = req.params
    const userId = req.userId

    const kofrinho = await getDbAsync<{ id: number }>(req,
      'SELECT id FROM kofrinhos WHERE id = ? AND user_id = ?',
      [kofrinhoId, userId]
    )
    if (!kofrinho) {
      return res.status(404).json({ erro: 'Kofrinho não encontrado' })
    }

    const pagamentos = await allDbAsync<Pagamento>(req,
      `SELECT p.id, p.pagamento_id, p.kofrinho_id, p.depositante_id, p.valor, p.pago, p.pago_em, p.criado_em,
              d.nome AS depositante_nome
       FROM pagamentos p
       JOIN depositantes d ON p.depositante_id = d.id
       WHERE p.kofrinho_id = ? AND p.pago = 1
       ORDER BY p.pago_em DESC`,
      [kofrinhoId]
    )

    return res.status(200).json({ pagamentos })
  } catch (err) {
    console.error('❌ Erro ao listar pagamentos:', err)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

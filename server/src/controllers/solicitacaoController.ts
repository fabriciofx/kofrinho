import { Request, Response } from 'express'
import { getAsync, allAsync, runAsync } from '../database/db.js'
import { AuthRequest } from '../middleware/auth.js'
import { Solicitacao } from '../types/index.js'
import { sendPagamentoConfirmadoEmail } from '../services/emailService.js'

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
    res.write(`data: ${JSON.stringify({ tipo: 'solicitacao_confirmada' })}\n\n`)
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
// POST /api/solicitacoes/:solicitacaoId
export async function registrarSolicitacao(req: DbInjectedRequest, res: Response) {
  try {
    const { solicitacaoId } = req.params

    const solicitacao = await getDbAsync<{ id: number; pago: number; kofrinho_id: number }>(req,
      'SELECT id, pago, kofrinho_id FROM pagamentos WHERE solicitacao_id = ?',
      [solicitacaoId]
    )
    if (!solicitacao) {
      return res.status(404).json({ erro: 'Solicitação não encontrada' })
    }

    // Idempotência: chamadas repetidas do webhook não disparam novo e-mail
    if (solicitacao.pago === 1) {
      return res.status(200).json({ message: 'Solicitação já confirmada' })
    }

    await runDbAsync(req,
      'UPDATE pagamentos SET pago = 1, pago_em = CURRENT_TIMESTAMP WHERE solicitacao_id = ?',
      [solicitacaoId]
    )

    notificarKofrinho(solicitacao.kofrinho_id)

    // Busca dados para o e-mail de confirmação e dispara de forma assíncrona
    const dadosEmail = await getDbAsync<{
      pago_em: string
      valor: number
      depositante_nome: string
      depositante_email: string | null
      kofrinho_nome: string
      kofrinho_descricao: string | null
    }>(req,
      `SELECT p.pago_em, p.valor,
              d.nome AS depositante_nome, d.email AS depositante_email,
              k.nome AS kofrinho_nome, k.descricao AS kofrinho_descricao
       FROM pagamentos p
       JOIN depositantes d ON p.depositante_id = d.id
       JOIN kofrinhos k ON p.kofrinho_id = k.id
       WHERE p.solicitacao_id = ?`,
      [solicitacaoId]
    )

    if (dadosEmail?.depositante_email) {
      sendPagamentoConfirmadoEmail(
        dadosEmail.depositante_email,
        dadosEmail.depositante_nome,
        dadosEmail.kofrinho_nome,
        dadosEmail.kofrinho_descricao,
        dadosEmail.valor,
        dadosEmail.pago_em
      ).catch(err => console.error('❌ Erro ao enviar e-mail de confirmação:', err))
    }

    console.log(`✅ Solicitação confirmada: ${solicitacaoId}`)
    return res.status(200).json({ message: 'Solicitação confirmada com sucesso' })
  } catch (err) {
    console.error('❌ Erro ao confirmar solicitação:', err)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

// SSE: stream de eventos de solicitação para um kofrinho (requer auth)
// GET /api/kofrinhos/:id/solicitacoes/eventos
export async function streamSolicitacoesEventos(req: DbInjectedAuthRequest, res: Response): Promise<void> {
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

// Listagem de solicitações confirmadas de um kofrinho (requer auth)
// GET /api/kofrinhos/:id/solicitacoes
export async function listSolicitacoes(req: DbInjectedAuthRequest, res: Response) {
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

    const solicitacoes = await allDbAsync<Solicitacao>(req,
      `SELECT p.id, p.solicitacao_id, p.kofrinho_id, p.depositante_id, p.valor, p.pago, p.pago_em, p.criado_em,
              d.nome AS depositante_nome
       FROM pagamentos p
       JOIN depositantes d ON p.depositante_id = d.id
       WHERE p.kofrinho_id = ? AND p.pago = 1
       ORDER BY p.pago_em DESC`,
      [kofrinhoId]
    )

    return res.status(200).json({ solicitacoes })
  } catch (err) {
    console.error('❌ Erro ao listar solicitações:', err)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

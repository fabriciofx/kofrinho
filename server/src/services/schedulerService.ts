import { randomUUID } from 'crypto'
import sqlite3 from 'sqlite3'
import { allAsync, runAsync } from '../database/db.js'
import { sendAgendamentoEmail } from './emailService.js'
import { chamarConfrapix, construirPayloadConfrapix, type ConfrapixFn } from './confrapixService.js'
import { notificarKofrinho } from '../controllers/solicitacaoController.js'

export type Recorrencia = 'diario' | 'semanal' | 'mensal' | 'anual'

export type EmailSendFn = (
  emailDepositante: string,
  nomeDonoKofrinho: string,
  nomeKofrinho: string,
  descricaoKofrinho: string | null,
  valor: number,
  recorrencia: string,
  pixUrl: string,
  pixCode: string
) => Promise<void>

export { type ConfrapixFn }

export function calcularProximaExecucao(recorrencia: Recorrencia, from: Date = new Date()): Date {
  const next = new Date(from)
  switch (recorrencia) {
    case 'diario':  next.setDate(next.getDate() + 1); break
    case 'semanal': next.setDate(next.getDate() + 7); break
    case 'mensal':  next.setMonth(next.getMonth() + 1); break
    case 'anual':   next.setFullYear(next.getFullYear() + 1); break
    default: throw new Error(`Recorrência desconhecida: ${recorrencia}`)
  }
  return next
}

interface AgendamentoPendente {
  id: number
  recorrencia: Recorrencia
  kofrinho_id: number
  depositante_id: number
  depositante_email: string
  nome_completo: string
  kofrinho_nome: string
  kofrinho_descricao: string | null
  valor: number
}

function allDbAsync<T>(db: sqlite3.Database | undefined, sql: string, params: any[]): Promise<T[]> {
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

function runDbAsync(db: sqlite3.Database | undefined, sql: string, params: any[]): Promise<void> {
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

let isProcessing = false

export async function processarAgendamentos(
  db?: sqlite3.Database,
  sendFn: EmailSendFn = sendAgendamentoEmail,
  confrapixFn: ConfrapixFn = chamarConfrapix
): Promise<number> {
  if (isProcessing) return 0
  isProcessing = true

  const agora = new Date()
  const now = agora.toISOString()

  try {

  const pendentes = await allDbAsync<AgendamentoPendente>(db,
    `SELECT a.id, a.recorrencia,
            a.kofrinho_id, a.depositante_id,
            d.email AS depositante_email,
            u.nome_completo,
            k.nome  AS kofrinho_nome,
            k.descricao AS kofrinho_descricao,
            d.valor
     FROM agendamentos a
     JOIN users u        ON a.user_id       = u.id
     JOIN kofrinhos k    ON a.kofrinho_id   = k.id
     JOIN depositantes d ON a.depositante_id = d.id
     WHERE a.proxima_execucao <= ? AND a.ativo = 1`,
    [now]
  )

  let enviados = 0
  for (const ag of pendentes) {
    try {
      const solicitacaoId = randomUUID()

      await runDbAsync(db,
        'INSERT INTO solicitacoes (solicitacao_id, kofrinho_id, depositante_id, valor, pago) VALUES (?, ?, ?, ?, 0)',
        [solicitacaoId, ag.kofrinho_id, ag.depositante_id, ag.valor]
      )

      // Notifica clientes SSE para que a nova solicitação ("A Pagar") apareça ao vivo
      notificarKofrinho(ag.kofrinho_id, 'solicitacao_criada')

      const payload = construirPayloadConfrapix(
        ag.valor,
        ag.kofrinho_descricao,
        solicitacaoId,
        agora
      )
      const { pixUrl, pixCode } = await confrapixFn(payload)

      await sendFn(
        ag.depositante_email,
        ag.nome_completo,
        ag.kofrinho_nome,
        ag.kofrinho_descricao,
        ag.valor,
        ag.recorrencia,
        pixUrl,
        pixCode
      )

      const proxima = calcularProximaExecucao(ag.recorrencia).toISOString()
      await runDbAsync(db,
        'UPDATE agendamentos SET proxima_execucao = ?, ultima_execucao = ? WHERE id = ?',
        [proxima, now, ag.id]
      )
      enviados++
    } catch (err) {
      console.error(`❌ Erro ao processar agendamento ${ag.id}:`, err)
    }
  }

  if (enviados > 0) {
    console.log(`⏰ Agendador: ${enviados} e-mail(s) enviado(s)`)
  }

  return enviados
  } finally {
    isProcessing = false
  }
}

const POLL_INTERVAL_MS = 1_000

let intervalId: ReturnType<typeof setInterval> | null = null

export function iniciarAgendador(): void {
  processarAgendamentos().catch(err => console.error('❌ Erro no agendador:', err))

  intervalId = setInterval(() => {
    processarAgendamentos().catch(err => console.error('❌ Erro no agendador:', err))
  }, POLL_INTERVAL_MS)

  console.log(`⏰ Agendador iniciado (intervalo: ${POLL_INTERVAL_MS / 1000}s)`)
}

export function pararAgendador(): void {
  if (intervalId !== null) {
    clearInterval(intervalId)
    intervalId = null
    console.log('⏹ Agendador parado')
  }
}

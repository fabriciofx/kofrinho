import sqlite3 from 'sqlite3'
import { allAsync, runAsync } from '../database/db.js'
import { sendAgendamentoEmail } from './emailService.js'

export type Recorrencia = 'diario' | 'semanal' | 'mensal' | 'anual'

export type EmailSendFn = (
  email: string,
  nomeUsuario: string,
  nomeKofrinho: string,
  nomeDepositante: string,
  valor: number,
  recorrencia: string
) => Promise<void>

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
  email: string
  nome_completo: string
  kofrinho_nome: string
  depositante_nome: string
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

export async function processarAgendamentos(
  db?: sqlite3.Database,
  sendFn: EmailSendFn = sendAgendamentoEmail
): Promise<number> {
  const now = new Date().toISOString()

  const pendentes = await allDbAsync<AgendamentoPendente>(db,
    `SELECT a.id, a.recorrencia,
            u.email, u.nome_completo,
            k.nome AS kofrinho_nome,
            d.nome AS depositante_nome, d.valor
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
      await sendFn(
        ag.email,
        ag.nome_completo,
        ag.kofrinho_nome,
        ag.depositante_nome,
        ag.valor,
        ag.recorrencia
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
}

const POLL_INTERVAL_MS = 60_000

let intervalId: ReturnType<typeof setInterval> | null = null

export function iniciarAgendador(): void {
  // Processa imediatamente ao iniciar para cobrir jobs vencidos durante downtime
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

import { Response } from 'express'
import { getAsync, allAsync, runAsync, runAsyncWithLastId } from '../database/db.js'
import { AuthRequest } from '../middleware/auth.js'
import { Depositante } from '../types/index.js'
import { calcularProximaExecucao, type Recorrencia } from '../services/schedulerService.js'
import { isValidEmail } from '../utils/validation.js'

interface DbInjectedRequest extends AuthRequest {
  testDb?: any
}

function getDbAsync<T>(req: any, sql: string, params: any[]) {
  const db = req.testDb
  if (db) {
    return new Promise<T>((resolve, reject) => {
      db.get(sql, params, (err: Error | null, row: T) => {
        if (err) reject(err)
        else resolve(row as T)
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

function runDbAsyncWithLastId(req: any, sql: string, params: any[]): Promise<number> {
  const db = req.testDb
  if (db) {
    return new Promise<number>((resolve, reject) => {
      db.run(sql, params, function (this: any, err: Error | null) {
        if (err) reject(err)
        else resolve(this.lastID as number)
      })
    })
  }
  return runAsyncWithLastId(sql, params)
}

const RECORRENCIAS_VALIDAS = ['anual', 'mensal', 'semanal', 'diario']

// Valida uma data no formato 'YYYY-MM-DD' e devolve suas partes, ou null se inválida.
function parseDataInicio(value: any): { y: number; m: number; d: number } | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [y, m, d] = value.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null
  return { y, m, d }
}

// A partir da data de início escolhida, calcula a primeira execução do agendamento
// (meia-noite local daquele dia). É a partir dela que o scheduler dispara o e-mail
// e a recorrência avança (diária, semanal, mensal ou anual) preservando o dia.
function proximaExecucaoDeData(value: string): string {
  const { y, m, d } = parseDataInicio(value)!
  return new Date(y, m - 1, d, 0, 0, 0).toISOString()
}

export async function createDepositante(req: DbInjectedRequest, res: Response) {
  try {
    const { id: kofrinhoId } = req.params
    const { nome, valor, recorrencia, email, telefone, data_inicio } = req.body
    const userId = req.userId

    const kofrinho = await getDbAsync<{ id: number }>(req,
      'SELECT id FROM kofrinhos WHERE id = ? AND user_id = ?',
      [kofrinhoId, userId]
    )
    if (!kofrinho) {
      return res.status(404).json({ erro: 'Kofrinho não encontrado' })
    }

    if (!nome || !nome.trim()) {
      return res.status(400).json({ erro: 'Nome é obrigatório' })
    }
    if (valor === undefined || valor === null || isNaN(Number(valor)) || Number(valor) < 0.5) {
      return res.status(400).json({ erro: 'Valor deve ser no mínimo R$ 0,50' })
    }
    if (!recorrencia || !RECORRENCIAS_VALIDAS.includes(recorrencia)) {
      return res.status(400).json({ erro: 'Recorrência inválida. Use: anual, mensal, semanal ou diario' })
    }
    // data_inicio é opcional: se ausente, mantém o comportamento de envio imediato.
    // Se informada, deve ser uma data válida no formato AAAA-MM-DD.
    const temData = data_inicio !== undefined && data_inicio !== null && data_inicio !== ''
    if (temData && !parseDataInicio(data_inicio)) {
      return res.status(400).json({ erro: 'Data de início inválida. Use o formato AAAA-MM-DD' })
    }
    const dataInicioNorm = temData ? data_inicio : null
    const emailNorm = email ? String(email).trim() : null
    if (!emailNorm) {
      return res.status(400).json({ erro: 'E-mail é obrigatório' })
    }
    if (!isValidEmail(emailNorm)) {
      return res.status(400).json({ erro: 'E-mail inválido' })
    }
    const telefoneNorm = telefone ? String(telefone).trim() : null

    const lastId = await runDbAsyncWithLastId(req,
      'INSERT INTO depositantes (kofrinho_id, nome, valor, recorrencia, email, telefone, data_inicio) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [kofrinhoId, nome.trim(), Number(valor), recorrencia, emailNorm, telefoneNorm, dataInicioNorm]
    )

    const depositante = await getDbAsync<Depositante>(req,
      'SELECT id, kofrinho_id, nome, valor, recorrencia, email, telefone, data_inicio, criado_em FROM depositantes WHERE id = ?',
      [lastId]
    )

    // proxima_execucao = data de início escolhida (meia-noite daquele dia) → o scheduler
    // envia o primeiro e-mail a partir desse dia e a recorrência avança a partir dele.
    // Sem data, mantém o envio imediato (agora).
    const proxima = dataInicioNorm ? proximaExecucaoDeData(dataInicioNorm) : new Date().toISOString()
    await runDbAsync(req,
      'INSERT INTO agendamentos (depositante_id, kofrinho_id, user_id, recorrencia, proxima_execucao) VALUES (?, ?, ?, ?, ?)',
      [lastId, kofrinhoId, userId, recorrencia, proxima]
    )

    return res.status(201).json({ message: 'Depositante criado com sucesso', depositante })
  } catch (err) {
    console.error('❌ Erro ao criar depositante:', err)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

export async function updateDepositante(req: DbInjectedRequest, res: Response) {
  try {
    const { id: kofrinhoId, depositanteId } = req.params
    const { nome, valor, recorrencia, email, telefone, data_inicio } = req.body
    const userId = req.userId

    const kofrinho = await getDbAsync<{ id: number }>(req,
      'SELECT id FROM kofrinhos WHERE id = ? AND user_id = ?',
      [kofrinhoId, userId]
    )
    if (!kofrinho) return res.status(404).json({ erro: 'Kofrinho não encontrado' })

    const depositanteAtual = await getDbAsync<{ id: number; recorrencia: string }>(req,
      'SELECT id, recorrencia FROM depositantes WHERE id = ? AND kofrinho_id = ?',
      [depositanteId, kofrinhoId]
    )
    if (!depositanteAtual) return res.status(404).json({ erro: 'Depositante não encontrado' })

    if (nome !== undefined && !String(nome).trim()) {
      return res.status(400).json({ erro: 'Nome é obrigatório' })
    }
    if (valor !== undefined && (isNaN(Number(valor)) || Number(valor) < 0.5)) {
      return res.status(400).json({ erro: 'Valor deve ser no mínimo R$ 0,50' })
    }
    if (recorrencia !== undefined && !RECORRENCIAS_VALIDAS.includes(recorrencia)) {
      return res.status(400).json({ erro: 'Recorrência inválida. Use: anual, mensal, semanal ou diario' })
    }
    if (data_inicio !== undefined && !parseDataInicio(data_inicio)) {
      return res.status(400).json({ erro: 'Data de início inválida. Use o formato AAAA-MM-DD' })
    }

    let emailNorm: string | undefined
    if (email !== undefined) {
      emailNorm = String(email).trim()
      if (!emailNorm) return res.status(400).json({ erro: 'E-mail é obrigatório' })
      if (!isValidEmail(emailNorm)) return res.status(400).json({ erro: 'E-mail inválido' })
    }

    const telefoneNorm = telefone !== undefined ? (String(telefone).trim() || null) : undefined

    const sets: string[] = []
    const params: any[] = []
    if (nome !== undefined)      { sets.push('nome = ?');        params.push(String(nome).trim()) }
    if (valor !== undefined)     { sets.push('valor = ?');       params.push(Number(valor)) }
    if (recorrencia !== undefined) { sets.push('recorrencia = ?'); params.push(recorrencia) }
    if (emailNorm !== undefined) { sets.push('email = ?');       params.push(emailNorm) }
    if (telefoneNorm !== undefined) { sets.push('telefone = ?'); params.push(telefoneNorm) }
    if (data_inicio !== undefined) { sets.push('data_inicio = ?'); params.push(data_inicio) }

    if (sets.length === 0) {
      return res.status(400).json({ erro: 'Nenhum campo para atualizar' })
    }

    params.push(depositanteId)
    await runDbAsync(req, `UPDATE depositantes SET ${sets.join(', ')} WHERE id = ?`, params)

    // Atualiza o agendamento quando a recorrência ou a data de início mudam.
    // Se a data de início mudou, a próxima execução é recalculada a partir dela.
    const agSets: string[] = []
    const agParams: any[] = []
    if (recorrencia !== undefined && recorrencia !== depositanteAtual.recorrencia) {
      agSets.push('recorrencia = ?'); agParams.push(recorrencia)
    }
    if (data_inicio !== undefined) {
      agSets.push('proxima_execucao = ?'); agParams.push(proximaExecucaoDeData(data_inicio))
    }
    if (agSets.length > 0) {
      agParams.push(depositanteId)
      await runDbAsync(req,
        `UPDATE agendamentos SET ${agSets.join(', ')} WHERE depositante_id = ?`,
        agParams
      )
    }

    const depositante = await getDbAsync<Depositante>(req,
      'SELECT id, kofrinho_id, nome, valor, recorrencia, email, telefone, data_inicio, criado_em FROM depositantes WHERE id = ?',
      [depositanteId]
    )

    return res.status(200).json({ message: 'Depositante atualizado com sucesso', depositante })
  } catch (err) {
    console.error('❌ Erro ao atualizar depositante:', err)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

export async function deleteDepositante(req: DbInjectedRequest, res: Response) {
  try {
    const { id: kofrinhoId, depositanteId } = req.params
    const userId = req.userId

    const kofrinho = await getDbAsync<{ id: number }>(req,
      'SELECT id FROM kofrinhos WHERE id = ? AND user_id = ?',
      [kofrinhoId, userId]
    )
    if (!kofrinho) {
      return res.status(404).json({ erro: 'Kofrinho não encontrado' })
    }

    const depositante = await getDbAsync<{ id: number }>(req,
      'SELECT id FROM depositantes WHERE id = ? AND kofrinho_id = ?',
      [depositanteId, kofrinhoId]
    )
    if (!depositante) {
      return res.status(404).json({ erro: 'Depositante não encontrado' })
    }

    const db = req.testDb
    if (db) {
      await new Promise<void>((resolve, reject) => {
        db.run('DELETE FROM depositantes WHERE id = ?', [depositanteId], (err: Error | null) => {
          if (err) reject(err)
          else resolve()
        })
      })
    } else {
      await runAsync('DELETE FROM depositantes WHERE id = ?', [depositanteId])
    }

    return res.status(200).json({ message: 'Depositante removido com sucesso' })
  } catch (err) {
    console.error('❌ Erro ao deletar depositante:', err)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

export async function listDepositantes(req: DbInjectedRequest, res: Response) {
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

    const depositantes = await allDbAsync<Depositante>(req,
      'SELECT id, kofrinho_id, nome, valor, recorrencia, email, telefone, data_inicio, criado_em FROM depositantes WHERE kofrinho_id = ? ORDER BY criado_em DESC',
      [kofrinhoId]
    )

    return res.status(200).json({ depositantes })
  } catch (err) {
    console.error('❌ Erro ao listar depositantes:', err)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

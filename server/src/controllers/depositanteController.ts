import { Response } from 'express'
import { getAsync, allAsync, runAsync, runAsyncWithLastId } from '../database/db.js'
import { AuthRequest } from '../middleware/auth.js'
import { Depositante } from '../types/index.js'
import { calcularProximaExecucao, type Recorrencia } from '../services/schedulerService.js'

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

export async function createDepositante(req: DbInjectedRequest, res: Response) {
  try {
    const { id: kofrinhoId } = req.params
    const { nome, valor, recorrencia } = req.body
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
    if (valor === undefined || valor === null || isNaN(Number(valor)) || Number(valor) <= 0) {
      return res.status(400).json({ erro: 'Valor deve ser um número positivo' })
    }
    if (!recorrencia || !RECORRENCIAS_VALIDAS.includes(recorrencia)) {
      return res.status(400).json({ erro: 'Recorrência inválida. Use: anual, mensal, semanal ou diario' })
    }

    const lastId = await runDbAsyncWithLastId(req,
      'INSERT INTO depositantes (kofrinho_id, nome, valor, recorrencia) VALUES (?, ?, ?, ?)',
      [kofrinhoId, nome.trim(), Number(valor), recorrencia]
    )

    const depositante = await getDbAsync<Depositante>(req,
      'SELECT id, kofrinho_id, nome, valor, recorrencia, criado_em FROM depositantes WHERE id = ?',
      [lastId]
    )

    const proxima = calcularProximaExecucao(recorrencia as Recorrencia).toISOString()
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
      'SELECT id, kofrinho_id, nome, valor, recorrencia, criado_em FROM depositantes WHERE kofrinho_id = ? ORDER BY criado_em DESC',
      [kofrinhoId]
    )

    return res.status(200).json({ depositantes })
  } catch (err) {
    console.error('❌ Erro ao listar depositantes:', err)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

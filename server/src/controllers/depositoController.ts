import { Response } from 'express'
import { getAsync, allAsync, runAsyncWithLastId } from '../database/db.js'
import { AuthRequest } from '../middleware/auth.js'
import { Deposito } from '../types/index.js'

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

export async function createDeposito(req: DbInjectedRequest, res: Response) {
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
      'INSERT INTO depositos (kofrinho_id, nome, valor, recorrencia) VALUES (?, ?, ?, ?)',
      [kofrinhoId, nome.trim(), Number(valor), recorrencia]
    )

    const deposito = await getDbAsync<Deposito>(req,
      'SELECT id, kofrinho_id, nome, valor, recorrencia, criado_em FROM depositos WHERE id = ?',
      [lastId]
    )

    return res.status(201).json({ message: 'Depósito criado com sucesso', deposito })
  } catch (err) {
    console.error('❌ Erro ao criar depósito:', err)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

export async function deleteDeposito(req: DbInjectedRequest, res: Response) {
  try {
    const { id: kofrinhoId, depositoId } = req.params
    const userId = req.userId

    const kofrinho = await getDbAsync<{ id: number }>(req,
      'SELECT id FROM kofrinhos WHERE id = ? AND user_id = ?',
      [kofrinhoId, userId]
    )
    if (!kofrinho) {
      return res.status(404).json({ erro: 'Kofrinho não encontrado' })
    }

    const deposito = await getDbAsync<{ id: number }>(req,
      'SELECT id FROM depositos WHERE id = ? AND kofrinho_id = ?',
      [depositoId, kofrinhoId]
    )
    if (!deposito) {
      return res.status(404).json({ erro: 'Depósito não encontrado' })
    }

    await new Promise<void>((resolve, reject) => {
      const db = req.testDb
      if (db) {
        db.run('DELETE FROM depositos WHERE id = ?', [depositoId], (err: Error | null) => {
          if (err) reject(err)
          else resolve()
        })
      } else {
        import('../database/db.js').then(({ runAsync }) =>
          runAsync('DELETE FROM depositos WHERE id = ?', [depositoId])
        ).then(resolve).catch(reject)
      }
    })

    return res.status(200).json({ message: 'Depósito removido com sucesso' })
  } catch (err) {
    console.error('❌ Erro ao deletar depósito:', err)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

export async function listDepositos(req: DbInjectedRequest, res: Response) {
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

    const depositos = await allDbAsync<Deposito>(req,
      'SELECT id, kofrinho_id, nome, valor, recorrencia, criado_em FROM depositos WHERE kofrinho_id = ? ORDER BY criado_em DESC',
      [kofrinhoId]
    )

    return res.status(200).json({ depositos })
  } catch (err) {
    console.error('❌ Erro ao listar depósitos:', err)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

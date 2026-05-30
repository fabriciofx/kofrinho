import { Request, Response } from 'express'
import { getAsync, runAsync, allAsync } from '../database/db.js'
import { AuthRequest } from '../middleware/auth.js'
import { Kofrinho } from '../types/index.js'

// Type that allows optional test database injection
interface DbInjectedRequest extends AuthRequest {
  testDb?: any
}

function getDb(req: any) {
  return req.testDb
}

function getDbAsync<T>(req: any, sql: string, params: any[]) {
  const db = getDb(req)
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

function runDbAsync(req: any, sql: string, params: any[]) {
  const db = getDb(req)
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

function allDbAsync<T>(req: any, sql: string, params: any[]) {
  const db = getDb(req)
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
  const db = getDb(req)
  if (db) {
    return new Promise<number>((resolve, reject) => {
      db.run(sql, params, function(this: any, err: Error | null) {
        if (err) reject(err)
        else resolve(this.lastID as number)
      })
    })
  }
  return runAsync(sql, params).then(() => 0)
}

export async function createKofrinho(req: DbInjectedRequest, res: Response) {
  try {
    const { nome, descricao } = req.body
    const userId = req.userId

    if (!nome) {
      return res.status(400).json({ erro: 'Nome é obrigatório' })
    }

    if (nome.length > 100) {
      return res.status(400).json({ erro: 'Nome não pode exceder 100 caracteres' })
    }

    const lastId = await runDbAsyncWithLastId(req,
      `INSERT INTO kofrinhos (nome, descricao, user_id) VALUES (?, ?, ?)`,
      [nome, descricao || null, userId]
    )

    const kofrinho = await getDbAsync<Kofrinho>(req,
      'SELECT id, nome, descricao, user_id, criado_em FROM kofrinhos WHERE id = ?',
      [lastId]
    )

    return res.status(201).json({
      message: 'Kofrinho criado com sucesso',
      kofrinho,
    })
  } catch (err) {
    console.error('❌ Erro ao criar kofrinho:', err)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

export async function listKofrinhos(req: DbInjectedRequest, res: Response) {
  try {
    const userId = req.userId

    const kofrinhos = await allDbAsync<Kofrinho>(req,
      'SELECT id, nome, descricao, user_id, criado_em FROM kofrinhos WHERE user_id = ? ORDER BY criado_em DESC',
      [userId]
    )

    return res.status(200).json({
      kofrinhos,
    })
  } catch (err) {
    console.error('❌ Erro ao listar kofrinhos:', err)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

export async function getKofrinho(req: DbInjectedRequest, res: Response) {
  try {
    const { id } = req.params
    const userId = req.userId

    const kofrinho = await getDbAsync<Kofrinho>(req,
      'SELECT id, nome, descricao, user_id, criado_em FROM kofrinhos WHERE id = ? AND user_id = ?',
      [id, userId]
    )

    if (!kofrinho) {
      return res.status(404).json({ erro: 'Kofrinho não encontrado' })
    }

    return res.status(200).json({ kofrinho })
  } catch (err) {
    console.error('❌ Erro ao buscar kofrinho:', err)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

export async function updateKofrinho(req: DbInjectedRequest, res: Response) {
  try {
    const { id } = req.params
    const { nome, descricao } = req.body
    const userId = req.userId

    const kofrinho = await getDbAsync<Kofrinho>(req,
      'SELECT id FROM kofrinhos WHERE id = ? AND user_id = ?',
      [id, userId]
    )

    if (!kofrinho) {
      return res.status(404).json({ erro: 'Kofrinho não encontrado' })
    }

    if (nome && nome.length > 100) {
      return res.status(400).json({ erro: 'Nome não pode exceder 100 caracteres' })
    }

    await runDbAsync(req,
      `UPDATE kofrinhos SET nome = COALESCE(?, nome), descricao = COALESCE(?, descricao) WHERE id = ?`,
      [nome || null, descricao !== undefined ? descricao : null, id]
    )

    const updated = await getDbAsync<Kofrinho>(req,
      'SELECT id, nome, descricao, user_id, criado_em FROM kofrinhos WHERE id = ?',
      [id]
    )

    return res.status(200).json({
      message: 'Kofrinho atualizado com sucesso',
      kofrinho: updated,
    })
  } catch (err) {
    console.error('❌ Erro ao atualizar kofrinho:', err)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

export async function deleteKofrinho(req: DbInjectedRequest, res: Response) {
  try {
    const { id } = req.params
    const userId = req.userId

    const kofrinho = await getDbAsync<Kofrinho>(req,
      'SELECT id FROM kofrinhos WHERE id = ? AND user_id = ?',
      [id, userId]
    )

    if (!kofrinho) {
      return res.status(404).json({ erro: 'Kofrinho não encontrado' })
    }

    await runDbAsync(req, 'DELETE FROM kofrinhos WHERE id = ?', [id])

    return res.status(200).json({
      message: 'Kofrinho deletado com sucesso',
    })
  } catch (err) {
    console.error('❌ Erro ao deletar kofrinho:', err)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

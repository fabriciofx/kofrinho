import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.js'
import { validateImageFile, getAvatarUrl, deleteAvatarFile, extractFilenameFromPath } from '../utils/avatarUpload.js'
import { User } from '../types/index.js'

interface DbInjectedRequest extends AuthRequest {
  testDb?: any
}

function getDb(req: any) {
  return req.testDb
}

function getDbAsync<T>(req: any, sql: string, params: any[]) {
  const db = getDb(req)
  if (db) {
    return new Promise<T | undefined>((resolve, reject) => {
      db.get(sql, params, (err: Error | null, row: T) => {
        if (err) reject(err)
        else resolve(row)
      })
    })
  }

  // For production - would need to import db helpers
  return Promise.reject(new Error('Production DB not configured in controller'))
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

  // For production - would need to import db helpers
  return Promise.reject(new Error('Production DB not configured in controller'))
}

export async function uploadAvatar(req: DbInjectedRequest, res: Response) {
  try {
    const userId = req.userId

    if (!req.file) {
      return res.status(400).json({ erro: 'Arquivo não fornecido' })
    }

    const validation = validateImageFile(req.file)
    if (!validation.valid) {
      if (req.file.path) {
        deleteAvatarFile(extractFilenameFromPath(req.file.path))
      }
      return res.status(400).json({ erro: validation.error })
    }

    const user = await getDbAsync<User>(req,
      'SELECT id, foto_avatar FROM users WHERE id = ?',
      [userId]
    )

    if (!user) {
      deleteAvatarFile(extractFilenameFromPath(req.file.path))
      return res.status(404).json({ erro: 'Usuário não encontrado' })
    }

    if (user.foto_avatar) {
      deleteAvatarFile(user.foto_avatar)
    }

    const filename = extractFilenameFromPath(req.file.path)
    const avatarUrl = getAvatarUrl(filename)

    await runDbAsync(req,
      'UPDATE users SET foto_avatar = ? WHERE id = ?',
      [filename, userId]
    )

    const updatedUser = await getDbAsync<User>(req,
      'SELECT id, nome_completo, email, foto_avatar, criado_em FROM users WHERE id = ?',
      [userId]
    )

    return res.status(200).json({
      message: 'Avatar enviado com sucesso',
      user: {
        ...updatedUser,
        foto_avatar: updatedUser?.foto_avatar ? getAvatarUrl(updatedUser.foto_avatar) : null
      }
    })
  } catch (err) {
    if (req.file) {
      deleteAvatarFile(extractFilenameFromPath(req.file.path))
    }
    console.error('❌ Erro ao enviar avatar:', err)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

export async function deleteAvatar(req: DbInjectedRequest, res: Response) {
  try {
    const userId = req.userId

    const user = await getDbAsync<User>(req,
      'SELECT id, foto_avatar FROM users WHERE id = ?',
      [userId]
    )

    if (!user) {
      return res.status(404).json({ erro: 'Usuário não encontrado' })
    }

    if (!user.foto_avatar) {
      return res.status(400).json({ erro: 'Usuário não possui avatar' })
    }

    deleteAvatarFile(user.foto_avatar)

    await runDbAsync(req,
      'UPDATE users SET foto_avatar = NULL WHERE id = ?',
      [userId]
    )

    const updatedUser = await getDbAsync<User>(req,
      'SELECT id, nome_completo, email, foto_avatar, criado_em FROM users WHERE id = ?',
      [userId]
    )

    return res.status(200).json({
      message: 'Avatar removido com sucesso',
      user: updatedUser
    })
  } catch (err) {
    console.error('❌ Erro ao remover avatar:', err)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

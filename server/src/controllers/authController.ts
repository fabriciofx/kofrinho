import { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import { getAsync, runAsync } from '../database/db.js'
import { isValidEmail, isValidPassword, getPasswordValidationErrors } from '../utils/validation.js'
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js'
import { generateResetToken, isResetTokenValid, validateResetTokenFormat } from '../utils/passwordRecovery.js'
import { sendPasswordResetEmail } from '../services/emailService.js'
import { User } from '../types/index.js'

interface DbInjectedRequest extends Request {
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

export async function register(req: DbInjectedRequest, res: Response) {
  try {
    const { nome_completo, email, senha } = req.body

    if (!nome_completo || !email || !senha) {
      return res.status(400).json({ 
        erro: 'Nome completo, email e senha são obrigatórios' 
      })
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ erro: 'Email inválido' })
    }

    const passwordErrors = getPasswordValidationErrors(senha)
    if (passwordErrors.length > 0) {
      return res.status(400).json({ 
        erro: 'Senha não atende aos requisitos',
        requisitos: [
          'Mínimo 8 caracteres',
          'Pelo menos uma letra maiúscula',
          'Pelo menos uma letra minúscula',
          'Pelo menos um número',
          'Pelo menos um caractere especial (!@#$%^&*)'
        ],
        falhas: passwordErrors
      })
    }

    const existingUser = await getDbAsync<User>(req,
      'SELECT id FROM users WHERE email = ?',
      [email]
    )

    if (existingUser) {
      return res.status(409).json({ erro: 'Email já cadastrado' })
    }

    const senhaHash = await bcrypt.hash(senha, 10)

    await runDbAsync(req,
      `INSERT INTO users (nome_completo, email, senha_hash) 
       VALUES (?, ?, ?)`,
      [nome_completo, email, senhaHash]
    )

    const usuario = await getDbAsync<User>(req,
      'SELECT id, nome_completo, email, foto_avatar, criado_em FROM users WHERE email = ?',
      [email]
    )

    if (!usuario) {
      return res.status(500).json({ erro: 'Erro ao criar usuário' })
    }

    const accessToken = generateAccessToken(usuario.id, usuario.email)
    const refreshToken = generateRefreshToken(usuario.id)

    return res.status(201).json({
      message: 'Usuário cadastrado com sucesso',
      user: usuario,
      token: accessToken,
      refreshToken
    })
  } catch (err) {
    console.error('❌ Erro ao registrar:', err)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

export async function login(req: DbInjectedRequest, res: Response) {
  try {
    const { email, senha } = req.body

    if (!email || !senha) {
      return res.status(400).json({ 
        erro: 'Email e senha são obrigatórios' 
      })
    }

    const usuario = await getDbAsync<User>(req,
      'SELECT id, nome_completo, email, senha_hash, foto_avatar, criado_em FROM users WHERE email = ?',
      [email]
    )

    if (!usuario) {
      return res.status(401).json({ erro: 'Email ou senha inválidos' })
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash || '')

    if (!senhaValida) {
      return res.status(401).json({ erro: 'Email ou senha inválidos' })
    }

    const accessToken = generateAccessToken(usuario.id, usuario.email)
    const refreshToken = generateRefreshToken(usuario.id)

    const usuarioRetorno = {
      id: usuario.id,
      nome_completo: usuario.nome_completo,
      email: usuario.email,
      foto_avatar: usuario.foto_avatar,
      criado_em: usuario.criado_em
    }

    return res.status(200).json({
      message: 'Login realizado com sucesso',
      user: usuarioRetorno,
      token: accessToken,
      refreshToken
    })
  } catch (err) {
    console.error('❌ Erro ao fazer login:', err)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

export async function refreshToken(req: DbInjectedRequest, res: Response) {
  try {
    const { refreshToken: oldRefreshToken } = req.body

    if (!oldRefreshToken) {
      return res.status(400).json({ erro: 'Refresh token obrigatório' })
    }

    const payload = verifyRefreshToken(oldRefreshToken)
    if (!payload) {
      return res.status(401).json({ erro: 'Refresh token inválido ou expirado' })
    }

    const usuario = await getDbAsync<User>(req,
      'SELECT id, email FROM users WHERE id = ?',
      [payload.id]
    )

    if (!usuario) {
      return res.status(401).json({ erro: 'Usuário não encontrado' })
    }

    const newAccessToken = generateAccessToken(usuario.id, usuario.email)

    return res.status(200).json({
      token: newAccessToken,
      refreshToken: oldRefreshToken
    })
  } catch (err) {
    console.error('❌ Erro ao renovar token:', err)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

export async function requestPasswordReset(req: DbInjectedRequest, res: Response) {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ erro: 'Email é obrigatório' })
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ erro: 'Email inválido' })
    }

    const usuario = await getDbAsync<User>(req,
      'SELECT id, email FROM users WHERE email = ?',
      [email]
    )

    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado' })
    }

    const { token, expiresAt } = generateResetToken()

    await runDbAsync(req,
      'UPDATE users SET reset_token = ?, reset_token_expira_em = ? WHERE id = ?',
      [token, expiresAt.toISOString(), usuario.id]
    )

    try {
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password`
      await sendPasswordResetEmail(usuario.email, token, resetUrl)
    } catch (emailErr) {
      console.error('⚠️ Erro ao enviar email de recuperação:', emailErr)
    }

    return res.status(200).json({
      message: 'Email de recuperação enviado com sucesso'
    })
  } catch (err) {
    console.error('❌ Erro ao solicitar recuperação de senha:', err)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

export async function resetPassword(req: DbInjectedRequest, res: Response) {
  try {
    const { token, novaSenha } = req.body

    if (!token || !novaSenha) {
      return res.status(400).json({ erro: 'Token e nova senha são obrigatórios' })
    }

    if (!validateResetTokenFormat(token)) {
      return res.status(400).json({ erro: 'Token inválido' })
    }

    const passwordErrors = getPasswordValidationErrors(novaSenha)
    if (passwordErrors.length > 0) {
      return res.status(400).json({ 
        erro: 'Senha não atende aos requisitos',
        requisitos: [
          'Mínimo 8 caracteres',
          'Pelo menos uma letra maiúscula',
          'Pelo menos uma letra minúscula',
          'Pelo menos um número',
          'Pelo menos um caractere especial (!@#$%^&*)'
        ],
        falhas: passwordErrors
      })
    }

    const usuario = await getDbAsync<User>(req,
      'SELECT id, reset_token, reset_token_expira_em FROM users WHERE reset_token = ?',
      [token]
    )

    if (!usuario) {
      return res.status(404).json({ erro: 'Token não encontrado ou inválido' })
    }

    if (!usuario.reset_token_expira_em || !isResetTokenValid(usuario.reset_token_expira_em)) {
      return res.status(401).json({ erro: 'Token expirado' })
    }

    const novaHashSenha = await bcrypt.hash(novaSenha, 10)

    await runDbAsync(req,
      'UPDATE users SET senha_hash = ?, reset_token = NULL, reset_token_expira_em = NULL WHERE id = ?',
      [novaHashSenha, usuario.id]
    )

    return res.status(200).json({
      message: 'Senha redefinida com sucesso'
    })
  } catch (err) {
    console.error('❌ Erro ao redefinir senha:', err)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

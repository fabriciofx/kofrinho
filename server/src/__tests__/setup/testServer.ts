import express from 'express'
import cors from 'cors'
import sqlite3 from 'sqlite3'
import { Server } from 'http'
import path from 'path'

import { register, login, refreshToken, requestPasswordReset, resetPassword } from '../../controllers/authController.js'
import { createKofrinho, listKofrinhos, getKofrinho, updateKofrinho, deleteKofrinho } from '../../controllers/kofrinhoController.js'
import { createDepositante, listDepositantes, deleteDepositante } from '../../controllers/depositanteController.js'
import { uploadAvatar, deleteAvatar } from '../../controllers/avatarController.js'
import { authMiddleware } from '../../middleware/auth.js'
import { uploadMiddleware } from '../../config/multer.js'

export interface TestServerSetup {
  app: express.Application
  server: Server
  port: number
  db: sqlite3.Database
}

export interface DbRequest extends Request {
  testDb?: sqlite3.Database
}

export async function startTestServer(db: sqlite3.Database): Promise<TestServerSetup> {
  const app = express()

  app.use(express.json())
  app.use(cors())

  // Middleware para injetar o banco de teste
  app.use((req: any, res, next) => {
    req.testDb = db
    next()
  })

  app.post('/api/auth/register', register)
  app.post('/api/auth/login', login)
  app.post('/api/auth/refresh', refreshToken)
  app.post('/api/auth/forgot-password', requestPasswordReset)
  app.post('/api/auth/reset-password', resetPassword)

  app.post('/api/avatars/upload', authMiddleware, uploadMiddleware.single('avatar'), uploadAvatar)
  app.delete('/api/avatars', authMiddleware, deleteAvatar)

  app.post('/api/kofrinhos', authMiddleware, createKofrinho)
  app.get('/api/kofrinhos', authMiddleware, listKofrinhos)
  app.get('/api/kofrinhos/:id', authMiddleware, getKofrinho)
  app.put('/api/kofrinhos/:id', authMiddleware, updateKofrinho)
  app.delete('/api/kofrinhos/:id', authMiddleware, deleteKofrinho)

  app.post('/api/kofrinhos/:id/depositantes', authMiddleware, createDepositante)
  app.get('/api/kofrinhos/:id/depositantes', authMiddleware, listDepositantes)
  app.delete('/api/kofrinhos/:id/depositantes/:depositanteId', authMiddleware, deleteDepositante)

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Test server running' })
  })

  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const address = server.address()
      const port = typeof address === 'object' ? address?.port || 3000 : 3000
      console.log(`🚀 Test server running on port ${port}`)
      resolve({ app, server, port, db })
    }).on('error', reject)
  })
}

export async function stopTestServer(setup: TestServerSetup): Promise<void> {
  return new Promise((resolve, reject) => {
    setup.server.close((err) => {
      if (err) {
        reject(err)
      } else {
        console.log('✅ Test server closed')
        resolve()
      }
    })
  })
}

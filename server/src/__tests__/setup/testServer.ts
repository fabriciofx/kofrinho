import express from 'express'
import cors from 'cors'
import sqlite3 from 'sqlite3'
import { Server } from 'http'

import { register, login, refreshToken } from '../../controllers/authController.js'

export interface TestServerSetup {
  app: express.Application
  server: Server
  port: number
  db: sqlite3.Database
}

export async function startTestServer(db: sqlite3.Database): Promise<TestServerSetup> {
  const app = express()

  app.use(express.json())
  app.use(cors())

  app.post('/api/auth/register', register)
  app.post('/api/auth/login', login)
  app.post('/api/auth/refresh', refreshToken)

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

import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { initializeDatabase } from './database/init.js'
import { iniciarAgendador } from './services/schedulerService.js'
import authRoutes from './routes/authRoutes.js'
import kofrinhoRoutes from './routes/kofrinhoRoutes.js'
import avatarRoutes from './routes/avatarRoutes.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = 3000

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}))

app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb' }))

app.use('/api/auth', authRoutes)
app.use('/api/kofrinhos', kofrinhoRoutes)
app.use('/api/avatars', avatarRoutes)

app.use('/api/avatars', express.static(path.join(__dirname, '../uploads/avatars')))

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server running on port 3000' })
})

// Catch-all: rotas não encontradas retornam JSON, nunca HTML
app.use((_req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada' })
})

async function startServer() {
  try {
    await initializeDatabase()
    
    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando em http://localhost:${PORT}`)
      console.log(`📊 Documentação: http://localhost:${PORT}/api/health`)
      iniciarAgendador()
    })
  } catch (err) {
    console.error('❌ Falha ao iniciar servidor:', err)
    process.exit(1)
  }
}

startServer()

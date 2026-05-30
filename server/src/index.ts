import express from 'express'
import cors from 'cors'
import { initializeDatabase } from './database/init.js'
import authRoutes from './routes/authRoutes.js'
import kofrinhoRoutes from './routes/kofrinhoRoutes.js'

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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server running on port 3000' })
})

async function startServer() {
  try {
    await initializeDatabase()
    
    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando em http://localhost:${PORT}`)
      console.log(`📊 Documentação: http://localhost:${PORT}/api/health`)
    })
  } catch (err) {
    console.error('❌ Falha ao iniciar servidor:', err)
    process.exit(1)
  }
}

startServer()

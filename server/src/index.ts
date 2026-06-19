import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { initializeDatabase } from './database/init.js'
import { iniciarAgendador } from './services/schedulerService.js'
import authRoutes from './routes/authRoutes.js'
import kofrinhoRoutes from './routes/kofrinhoRoutes.js'
import avatarRoutes from './routes/avatarRoutes.js'
import { registrarSolicitacao } from './controllers/solicitacaoController.js'
import { runAsync } from './database/db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = 3000

const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map(o => o.trim())

app.use(cors({
  origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
  credentials: true
}))

app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

app.use('/api/auth', authRoutes)
app.use('/api/kofrinhos', kofrinhoRoutes)
app.use('/api/avatars', avatarRoutes)

app.use('/api/avatars', express.static(path.join(__dirname, '../uploads/avatars')))

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server running on port 3000' })
})

// Webhook Confrapix: confirma solicitação (sem auth)
app.post('/api/solicitacoes/:solicitacaoId', registrarSolicitacao)

// Rota auxiliar para criar solicitações pendentes em testes E2E (não disponível em produção)
if (process.env.TEST_ROUTES === 'true') {
  app.post('/test/solicitacoes', async (req, res) => {
    try {
      const { solicitacao_id, kofrinho_id, depositante_id, valor } = req.body
      await runAsync(
        'INSERT INTO pagamentos (solicitacao_id, kofrinho_id, depositante_id, valor, pago) VALUES (?, ?, ?, ?, 0)',
        [solicitacao_id, kofrinho_id, depositante_id, valor]
      )
      res.status(201).json({ message: 'Solicitação de teste criada' })
    } catch (err) {
      res.status(500).json({ erro: 'Erro ao criar solicitação de teste' })
    }
  })
}

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

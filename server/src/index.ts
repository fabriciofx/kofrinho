import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { version } = require('../package.json') as { version: string }
import { initializeDatabase } from './database/init.js'
import { iniciarAgendador } from './services/schedulerService.js'
import authRoutes from './routes/authRoutes.js'
import kofrinhoRoutes from './routes/kofrinhoRoutes.js'
import avatarRoutes from './routes/avatarRoutes.js'
import { registrarSolicitacao } from './controllers/solicitacaoController.js'
import { runAsync, runAsyncWithLastId } from './database/db.js'

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

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Server running on port 3000' })
})

app.get('/api/version', (_req, res) => {
  res.json({ version })
})

// Webhook Confrapix: confirma solicitação (sem auth)
app.post('/api/solicitacoes/:solicitacaoId', registrarSolicitacao)

// Rotas auxiliares para testes E2E (não disponíveis em produção)
if (process.env.TEST_ROUTES === 'true') {
  app.post('/test/solicitacoes', async (req, res) => {
    try {
      const { solicitacao_id, kofrinho_id, depositante_id, valor } = req.body
      await runAsync(
        'INSERT INTO solicitacoes (solicitacao_id, kofrinho_id, depositante_id, valor, pago) VALUES (?, ?, ?, ?, 0)',
        [solicitacao_id, kofrinho_id, depositante_id, valor]
      )
      res.status(201).json({ message: 'Solicitação de teste criada' })
    } catch (err) {
      res.status(500).json({ erro: 'Erro ao criar solicitação de teste' })
    }
  })

  // Cria um depositante SEM agendamento, para que o scheduler não gere
  // solicitações automáticas e os testes permaneçam determinísticos.
  app.post('/test/depositantes', async (req, res) => {
    try {
      const { kofrinho_id, nome, valor, recorrencia, email } = req.body
      const id = await runAsyncWithLastId(
        'INSERT INTO depositantes (kofrinho_id, nome, valor, recorrencia, email) VALUES (?, ?, ?, ?, ?)',
        [kofrinho_id, nome, valor, recorrencia ?? 'mensal', email ?? null]
      )
      res.status(201).json({ depositante: { id, kofrinho_id, nome, valor } })
    } catch (err) {
      res.status(500).json({ erro: 'Erro ao criar depositante de teste' })
    }
  })

  // Remove um usuário de teste pelo e-mail. O CASCADE apaga em sequência:
  // kofrinhos → depositantes → agendamentos + solicitações.
  app.delete('/test/users/:email', async (req, res) => {
    try {
      await runAsync('DELETE FROM users WHERE email = ?', [req.params.email])
      res.status(200).json({ message: 'Usuário removido' })
    } catch (err) {
      res.status(500).json({ erro: 'Erro ao remover usuário de teste' })
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
      // SCHEDULER_DISABLED=true desliga o agendador (usado nos testes E2E,
      // para evitar escritas a cada segundo que sobrecarregam o servidor)
      if (process.env.SCHEDULER_DISABLED === 'true') {
        console.log('⏸ Agendador desabilitado (SCHEDULER_DISABLED=true)')
      } else {
        iniciarAgendador()
      }
    })
  } catch (err) {
    console.error('❌ Falha ao iniciar servidor:', err)
    process.exit(1)
  }
}

startServer()

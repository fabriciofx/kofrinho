import { runAsync } from './db.js'

export async function initializeDatabase() {
  try {
    await runAsync(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome_completo TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        senha_hash TEXT NOT NULL,
        foto_avatar TEXT,
        reset_token TEXT,
        reset_token_expira_em DATETIME,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await runAsync(`
      CREATE TABLE IF NOT EXISTS kofrinhos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        nome TEXT NOT NULL,
        descricao TEXT,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    await runAsync(`
      CREATE INDEX IF NOT EXISTS idx_kofrinhos_user_id 
      ON kofrinhos(user_id)
    `)

    await runAsync(`
      CREATE INDEX IF NOT EXISTS idx_users_email
      ON users(email)
    `)

    await runAsync(`
      CREATE TABLE IF NOT EXISTS depositantes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kofrinho_id INTEGER NOT NULL,
        nome TEXT NOT NULL,
        valor REAL NOT NULL,
        recorrencia TEXT NOT NULL CHECK(recorrencia IN ('anual', 'mensal', 'semanal', 'diario')),
        email TEXT,
        telefone TEXT,
        data_inicio TEXT,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (kofrinho_id) REFERENCES kofrinhos(id) ON DELETE CASCADE
      )
    `)

    await runAsync(`
      CREATE INDEX IF NOT EXISTS idx_depositantes_kofrinho_id
      ON depositantes(kofrinho_id)
    `)

    // Migrations: adiciona colunas em bancos existentes (ignorado se já existirem)
    try { await runAsync('ALTER TABLE depositantes ADD COLUMN email TEXT') } catch { /* já existe */ }
    try { await runAsync('ALTER TABLE depositantes ADD COLUMN telefone TEXT') } catch { /* já existe */ }
    try { await runAsync('ALTER TABLE depositantes ADD COLUMN data_inicio TEXT') } catch { /* já existe */ }

    await runAsync(`
      CREATE TABLE IF NOT EXISTS agendamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        depositante_id INTEGER NOT NULL,
        kofrinho_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        recorrencia TEXT NOT NULL CHECK(recorrencia IN ('anual', 'mensal', 'semanal', 'diario')),
        proxima_execucao DATETIME NOT NULL,
        ultima_execucao DATETIME,
        ativo INTEGER NOT NULL DEFAULT 1,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (depositante_id) REFERENCES depositantes(id) ON DELETE CASCADE,
        FOREIGN KEY (kofrinho_id) REFERENCES kofrinhos(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    await runAsync(`
      CREATE INDEX IF NOT EXISTS idx_agendamentos_depositante_id
      ON agendamentos(depositante_id)
    `)

    await runAsync(`
      CREATE INDEX IF NOT EXISTS idx_agendamentos_proxima_execucao
      ON agendamentos(proxima_execucao)
    `)

    await runAsync(`
      CREATE TABLE IF NOT EXISTS solicitacoes (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        solicitacao_id   TEXT UNIQUE NOT NULL,
        kofrinho_id    INTEGER NOT NULL,
        depositante_id INTEGER NOT NULL,
        valor          REAL NOT NULL,
        pago           INTEGER NOT NULL DEFAULT 0,
        pago_em        DATETIME,
        pix_url        TEXT,
        pix_code       TEXT,
        criado_em      DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (kofrinho_id)    REFERENCES kofrinhos(id)    ON DELETE CASCADE,
        FOREIGN KEY (depositante_id) REFERENCES depositantes(id) ON DELETE CASCADE
      )
    `)

    await runAsync(`
      CREATE INDEX IF NOT EXISTS idx_solicitacoes_kofrinho_id
      ON solicitacoes(kofrinho_id)
    `)

    // Migrations para bancos existentes (ignorado se já aplicado)
    try { await runAsync('ALTER TABLE pagamentos RENAME TO solicitacoes') } catch { /* já renomeado ou não existe */ }
    try { await runAsync('ALTER TABLE solicitacoes RENAME COLUMN pagamento_id TO solicitacao_id') } catch { /* já renomeado ou não existe */ }
    try { await runAsync('ALTER TABLE solicitacoes ADD COLUMN pago INTEGER DEFAULT 0') } catch { /* já existe */ }
    try { await runAsync('ALTER TABLE solicitacoes ADD COLUMN pago_em DATETIME') } catch { /* já existe */ }
    try { await runAsync('ALTER TABLE solicitacoes ADD COLUMN pix_url TEXT') } catch { /* já existe */ }
    try { await runAsync('ALTER TABLE solicitacoes ADD COLUMN pix_code TEXT') } catch { /* já existe */ }

    console.log('✅ Banco de dados inicializado com sucesso')
  } catch (err) {
    console.error('❌ Erro ao inicializar banco:', err)
    throw err
  }
}

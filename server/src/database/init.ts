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
      CREATE TABLE IF NOT EXISTS pagamentos (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        pagamento_id   TEXT UNIQUE NOT NULL,
        kofrinho_id    INTEGER NOT NULL,
        depositante_id INTEGER NOT NULL,
        valor          REAL NOT NULL,
        pago           INTEGER NOT NULL DEFAULT 0,
        pago_em        DATETIME,
        criado_em      DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (kofrinho_id)    REFERENCES kofrinhos(id)    ON DELETE CASCADE,
        FOREIGN KEY (depositante_id) REFERENCES depositantes(id) ON DELETE CASCADE
      )
    `)

    await runAsync(`
      CREATE INDEX IF NOT EXISTS idx_pagamentos_kofrinho_id
      ON pagamentos(kofrinho_id)
    `)

    // Migrations: adiciona colunas em bancos existentes (ignorado se já existirem)
    try { await runAsync('ALTER TABLE pagamentos ADD COLUMN pagamento_id TEXT') } catch { /* já existe */ }
    try { await runAsync('ALTER TABLE pagamentos ADD COLUMN pago INTEGER DEFAULT 0') } catch { /* já existe */ }
    try { await runAsync('ALTER TABLE pagamentos ADD COLUMN pago_em DATETIME') } catch { /* já existe */ }

    console.log('✅ Banco de dados inicializado com sucesso')
  } catch (err) {
    console.error('❌ Erro ao inicializar banco:', err)
    throw err
  }
}

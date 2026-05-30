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
        usuario_id INTEGER NOT NULL,
        nome TEXT NOT NULL,
        saldo DECIMAL(10, 2) DEFAULT 0,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    await runAsync(`
      CREATE INDEX IF NOT EXISTS idx_kofrinhos_usuario_id 
      ON kofrinhos(usuario_id)
    `)

    await runAsync(`
      CREATE INDEX IF NOT EXISTS idx_users_email 
      ON users(email)
    `)

    console.log('✅ Banco de dados inicializado com sucesso')
  } catch (err) {
    console.error('❌ Erro ao inicializar banco:', err)
    throw err
  }
}

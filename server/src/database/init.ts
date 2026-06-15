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
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (kofrinho_id) REFERENCES kofrinhos(id) ON DELETE CASCADE
      )
    `)

    await runAsync(`
      CREATE INDEX IF NOT EXISTS idx_depositantes_kofrinho_id
      ON depositantes(kofrinho_id)
    `)

    console.log('✅ Banco de dados inicializado com sucesso')
  } catch (err) {
    console.error('❌ Erro ao inicializar banco:', err)
    throw err
  }
}

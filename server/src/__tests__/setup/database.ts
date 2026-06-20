import sqlite3 from 'sqlite3'

export function setupTestDb(): Promise<sqlite3.Database> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(':memory:', (err) => {
      if (err) {
        reject(err)
        return
      }

      db.configure('busyTimeout', 10000)
      db.run('PRAGMA foreign_keys = ON')

      const schema = `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nome_completo TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          senha_hash TEXT NOT NULL,
          foto_avatar TEXT,
          reset_token TEXT,
          reset_token_expira_em DATETIME,
          criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);

        CREATE TABLE IF NOT EXISTS kofrinhos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nome TEXT NOT NULL,
          descricao TEXT,
          user_id INTEGER NOT NULL,
          criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_kofrinhos_user_id ON kofrinhos(user_id);

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
        );

        CREATE INDEX IF NOT EXISTS idx_depositantes_kofrinho_id ON depositantes(kofrinho_id);

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
        );

        CREATE INDEX IF NOT EXISTS idx_agendamentos_depositante_id ON agendamentos(depositante_id);
        CREATE INDEX IF NOT EXISTS idx_agendamentos_proxima_execucao ON agendamentos(proxima_execucao);

        CREATE TABLE IF NOT EXISTS solicitacoes (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          solicitacao_id   TEXT UNIQUE NOT NULL,
          kofrinho_id    INTEGER NOT NULL,
          depositante_id INTEGER NOT NULL,
          valor          REAL NOT NULL,
          pago           INTEGER NOT NULL DEFAULT 0,
          pago_em        DATETIME,
          criado_em      DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (kofrinho_id)    REFERENCES kofrinhos(id)    ON DELETE CASCADE,
          FOREIGN KEY (depositante_id) REFERENCES depositantes(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_solicitacoes_kofrinho_id ON solicitacoes(kofrinho_id);
      `

      db.exec(schema, (err) => {
        if (err) {
          reject(err)
        } else {
          console.log('✅ Test database initialized')
          resolve(db)
        }
      })
    })
  })
}

export function runAsync(db: sqlite3.Database, sql: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

export function getAsync<T>(db: sqlite3.Database, sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err)
      else resolve(row as T | undefined)
    })
  })
}

export function allAsync<T>(db: sqlite3.Database, sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err)
      else resolve((rows || []) as T[])
    })
  })
}

export function closeTestDb(db: sqlite3.Database): Promise<void> {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        reject(err)
      } else {
        console.log('✅ Test database closed')
        resolve()
      }
    })
  })
}

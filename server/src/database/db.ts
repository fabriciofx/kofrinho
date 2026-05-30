import sqlite3 from 'sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const currentModuleUrl = import.meta.url
const currentModuleDir = path.dirname(fileURLToPath(currentModuleUrl))
const dbPath = path.join(currentModuleDir, '../../kofrinho.sqlite')

export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Erro ao conectar ao banco:', err)
  } else {
    console.log('✅ Conectado ao SQLite:', dbPath)
  }
})

db.configure('busyTimeout', 10000)

export function runAsync(sql: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

export function getAsync<T>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err)
      else resolve(row as T | undefined)
    })
  })
}

export function allAsync<T>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err)
      else resolve((rows || []) as T[])
    })
  })
}

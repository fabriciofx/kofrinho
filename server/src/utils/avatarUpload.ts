import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const UPLOAD_DIR = path.join(__dirname, '../../uploads/avatars')
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export interface AvatarUploadResult {
  filename: string
  path: string
  url: string
}

export function ensureUploadDirExists(): void {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true })
  }
}

export function validateImageFile(file: Express.Multer.File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'Arquivo não fornecido' }
  }

  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return { valid: false, error: 'Apenas imagens JPEG, PNG e WebP são permitidas' }
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'Arquivo excede o tamanho máximo de 5MB' }
  }

  return { valid: true }
}

export function getAvatarPath(filename: string): string {
  return path.join(UPLOAD_DIR, filename)
}

export function getAvatarUrl(filename: string): string {
  return `/api/avatars/${filename}`
}

export function deleteAvatarFile(filename: string): void {
  if (!filename) return

  const filePath = getAvatarPath(filename)
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}

export function extractFilenameFromPath(filepath: string): string {
  return path.basename(filepath)
}

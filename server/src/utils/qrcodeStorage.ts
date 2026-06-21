import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Mesmo esquema dos avatares: uploads/ fica como irmão de dist/ (em produção,
// /var/www/kofrinho/uploads). uploads/ está no .gitignore.
const QRCODE_DIR = path.join(__dirname, '../../uploads/qrcodes')

export function ensureQrcodeDirExists(): void {
  if (!fs.existsSync(QRCODE_DIR)) {
    fs.mkdirSync(QRCODE_DIR, { recursive: true })
  }
}

// Extrai o base64 cru de um data URL (data:image/png;base64,XXXX) ou base64 puro.
export function extrairBase64(pixUrl: string): string {
  return pixUrl.startsWith('data:') ? (pixUrl.split(',')[1] ?? '') : pixUrl
}

// path.basename impede path traversal caso o id contenha barras/`..`.
export function getQrcodePath(solicitacaoId: string): string {
  return path.join(QRCODE_DIR, `${path.basename(solicitacaoId)}.png`)
}

// Salva um buffer PNG como imagem em disco e devolve o caminho do arquivo.
export function salvarQrcodeBuffer(solicitacaoId: string, buffer: Buffer): string {
  ensureQrcodeDirExists()
  const filePath = getQrcodePath(solicitacaoId)
  fs.writeFileSync(filePath, buffer)
  return filePath
}

// Salva o QR code recebido da Confrapix (data URL ou base64) como arquivo PNG.
export function salvarQrcode(solicitacaoId: string, pixUrl: string): string {
  const buffer = Buffer.from(extrairBase64(pixUrl), 'base64')
  return salvarQrcodeBuffer(solicitacaoId, buffer)
}

export function qrcodeExiste(solicitacaoId: string): boolean {
  return fs.existsSync(getQrcodePath(solicitacaoId))
}

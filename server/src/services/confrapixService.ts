export interface ConfrapixPayload {
  amount: number
  description: string
  expiration_date: string
  callback_url: string
}

export interface ConfrapixPixData {
  pixUrl: string
  pixCode: string
}

export type ConfrapixFn = (payload: ConfrapixPayload) => Promise<ConfrapixPixData>

interface ConfrapixResponse {
  transaction: {
    pix: {
      url: string
      code: string
    }
  }
}

const CONFRAPIX_URL = 'https://api.confrapix.com.br/api/transaction-ec/store'

// Formata data como "YYYY-MM-DD HH:MM:SS" (UTC) com +24h a partir de `agora`
export function formatarDataExpiracao(agora: Date = new Date()): string {
  const expira = new Date(agora.getTime() + 24 * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${expira.getUTCFullYear()}-${pad(expira.getUTCMonth() + 1)}-${pad(expira.getUTCDate())}` +
    ` ${pad(expira.getUTCHours())}:${pad(expira.getUTCMinutes())}:${pad(expira.getUTCSeconds())}`
  )
}

export function construirPayloadConfrapix(
  valor: number,
  descricaoKofrinho: string | null,
  kofrinhoId: number,
  depositanteId: number,
  agora: Date = new Date()
): ConfrapixPayload {
  return {
    amount: valor,
    description: descricaoKofrinho || '',
    expiration_date: formatarDataExpiracao(agora),
    callback_url: `https://mandacaru.org:3333/kofrinho/${kofrinhoId}/depositante/${depositanteId}`,
  }
}

export async function chamarConfrapix(payload: ConfrapixPayload): Promise<ConfrapixPixData> {
  const token = process.env.CONFRAPIX_TOKEN
  if (!token) throw new Error('CONFRAPIX_TOKEN não configurado no .env')

  const response = await fetch(CONFRAPIX_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const texto = await response.text().catch(() => '')
    throw new Error(`Confrapix API: ${response.status} - ${texto}`)
  }

  const data = await response.json() as ConfrapixResponse
  console.log(`💳 Confrapix: transação registrada — ${payload.callback_url}`)

  return {
    pixUrl: data.transaction.pix.url,
    pixCode: data.transaction.pix.code,
  }
}

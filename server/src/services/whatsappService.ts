// Envio de mensagens via WhatsApp Cloud API (Meta Graph API).
//
// Espelha o padrão do emailService: configuração por variáveis de ambiente e
// envio real apenas em produção — em dev/test o envio é apenas logado, evitando
// chamadas externas (ex.: o scheduler tentando notificar depositantes de teste).
//
// Variáveis de ambiente:
//   WHATSAPP_TOKEN            token de acesso da Cloud API (obrigatório)
//   WHATSAPP_PHONE_NUMBER_ID  id do número remetente cadastrado na Meta (obrigatório)
//   WHATSAPP_API_VERSION      versão da Graph API (opcional, default v21.0)

export interface WhatsAppMessage {
  to: string    // telefone do destinatário, em formato livre (será normalizado)
  body: string  // texto puro da mensagem
}

function envioDeWhatsAppHabilitado(): boolean {
  return process.env.NODE_ENV === 'production'
}

// Normaliza um telefone brasileiro para o formato exigido pela Cloud API:
// apenas dígitos, com código do país (55). Aceita entradas como
// "(11) 98765-4321", "11987654321" ou "+55 11 98765-4321".
// Retorna null se não houver dígitos suficientes para um número válido.
export function normalizarTelefoneBr(telefone: string): string | null {
  const digitos = telefone.replace(/\D/g, '')
  if (digitos.length < 10) return null
  // Já inclui o código do país (55 + DDD + número = 12 ou 13 dígitos)
  if (digitos.startsWith('55') && digitos.length >= 12) return digitos
  // Caso contrário, assume número nacional (DDD + número) e prefixa o 55
  return `55${digitos}`
}

export async function sendWhatsApp(message: WhatsAppMessage): Promise<void> {
  const numero = normalizarTelefoneBr(message.to)
  if (!numero) {
    console.warn(`⚠️  WhatsApp: telefone inválido, ignorando: "${message.to}"`)
    return
  }

  if (!envioDeWhatsAppHabilitado()) {
    console.log(`💬 (dev/test) WhatsApp para ${numero} não enviado`)
    return
  }

  const token = process.env.WHATSAPP_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!token || !phoneNumberId) {
    throw new Error('WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID precisam estar configurados no .env')
  }

  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0'
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: numero,
      type: 'text',
      text: { body: message.body },
    }),
  })

  if (!response.ok) {
    const texto = await response.text().catch(() => '')
    throw new Error(`WhatsApp API: ${response.status} - ${texto}`)
  }

  console.log(`💬 WhatsApp: mensagem enviada para ${numero}`)
}

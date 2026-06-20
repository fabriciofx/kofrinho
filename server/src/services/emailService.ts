import nodemailer from 'nodemailer'
import { Resend } from 'resend'

export interface EmailOptions {
  to: string
  subject: string
  html: string
}

// ── Nodemailer (recuperação de senha) ────────────────────────────────────────

let transporter: nodemailer.Transporter | null = null

async function getTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) {
    return transporter
  }

  if (process.env.NODE_ENV === 'test') {
    transporter = nodemailer.createTransport({
      host: 'localhost',
      port: 1025,
      secure: false,
      tls: { rejectUnauthorized: false },
    })
  } else if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      } : undefined,
    })
  } else {
    const testAccount = await nodemailer.createTestAccount()
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    })
  }

  return transporter
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  try {
    const t = await getTransporter()

    const info = await t.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@mandacaru.org',
      to: options.to,
      subject: options.subject,
      html: options.html,
    })

    if (process.env.NODE_ENV !== 'test') {
      console.log('📧 Email sent:', info.messageId)
      if (nodemailer.getTestMessageUrl(info)) {
        console.log('Preview URL:', nodemailer.getTestMessageUrl(info))
      }
    }
  } catch (err) {
    console.error('❌ Erro ao enviar email:', err)
    throw err
  }
}

export async function sendPasswordResetEmail(email: string, resetToken: string, resetUrl: string): Promise<void> {
  const html = `
    <h2>Recuperar Senha - Kofrinho</h2>
    <p>Recebemos uma solicitação para redefinir sua senha.</p>
    <p>Clique no link abaixo para continuar:</p>
    <a href="${resetUrl}?token=${resetToken}" style="
      display: inline-block;
      padding: 10px 20px;
      background-color: #007bff;
      color: white;
      text-decoration: none;
      border-radius: 4px;
    ">Redefinir Senha</a>
    <p>Ou copie e cole este link no seu navegador:</p>
    <p>${resetUrl}?token=${resetToken}</p>
    <p>Este link expira em 1 hora.</p>
    <p>Se você não solicitou esta redefinição, ignore este email.</p>
  `

  await sendEmail({
    to: email,
    subject: 'Redefinir Senha - Kofrinho',
    html,
  })
}

// ── Resend (e-mails de agendamento) ──────────────────────────────────────────

function carregarResendApiKey(): string {
  if (process.env.RESEND_TOKEN) return process.env.RESEND_TOKEN

  throw new Error(
    'Resend API key não encontrado. Configure RESEND_TOKEN no arquivo .env do servidor.'
  )
}

// E-mails só são realmente enviados em produção. Em desenvolvimento e testes
// o envio é pulado, evitando falhas/spam do Resend (ex.: o scheduler tentando
// enviar a cada ciclo para depositantes de teste).
function envioDeEmailHabilitado(): boolean {
  return process.env.NODE_ENV === 'production'
}

export async function sendAgendamentoEmail(
  emailDepositante: string,
  nomeDonoKofrinho: string,
  nomeKofrinho: string,
  descricaoKofrinho: string | null,
  valor: number,
  recorrencia: string,
  pixUrl: string,
  pixCode: string
): Promise<void> {
  if (!envioDeEmailHabilitado()) {
    console.log(`✉️  (dev/test) e-mail de agendamento para ${emailDepositante} não enviado`)
    return
  }

  const valorFormatado = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const referencia = descricaoKofrinho || nomeKofrinho

  // Extrai o raw base64 independente de a API retornar data URL ou base64 puro
  const base64 = pixUrl.startsWith('data:') ? pixUrl.split(',')[1] : pixUrl
  const qrBuffer = Buffer.from(base64, 'base64')

  const subject = `Kofrinho de ${nomeDonoKofrinho}: depositar ${valorFormatado} no cofre ${nomeKofrinho}`
  const html = `
    <p>Olá! Eu sou o Kofrinho! Estou lhe enviando essa mensagem para lembrar-lhe de depositar ${valorFormatado} no Kofrinho de ${nomeDonoKofrinho} referente a ${referencia}</p>
    <h3 style="margin-top:1.5rem;">Pagamento via Pix</h3>
    <p>Escaneie o QR Code abaixo ou use o código Pix para realizar o depósito:</p>
    <img src="cid:qrcode" alt="QR Code Pix" width="200" height="200" style="display:block;margin:1rem 0;" />
    <p><strong>Código Pix (Copia e Cola):</strong></p>
    <pre style="background:#f5f5f5;padding:0.75rem;border-radius:4px;word-break:break-all;font-size:0.85rem;">${pixCode}</pre>
  `

  const resend = new Resend(carregarResendApiKey())
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || 'Kofrinho <noreply@mandacaru.org>',
    to: emailDepositante,
    subject,
    html,
    attachments: [
      {
        filename: 'qrcode.png',
        content: qrBuffer,
        contentType: 'image/png',
        contentId: 'qrcode',
      },
    ],
  })

  if (error) {
    throw new Error(`Resend: ${error.message}`)
  }

  console.log(`📧 Resend: e-mail enviado para ${emailDepositante}`)
}

// ── Confirmação de solicitação para o depositante ─────────────────────────────

export async function sendSolicitacaoConfirmadaEmail(
  emailDepositante: string,
  nomeDepositante: string,
  nomeKofrinho: string,
  descricaoKofrinho: string | null,
  valor: number,
  pago_em: string
): Promise<void> {
  if (!envioDeEmailHabilitado()) return

  const valorFormatado = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  // pago_em vem do SQLite como 'YYYY-MM-DD HH:MM:SS' UTC — adiciona 'Z' para parse correto
  const dataHora = new Date(pago_em.replace(' ', 'T') + 'Z')
    .toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  const referencia = descricaoKofrinho
    ? `${nomeKofrinho} — ${descricaoKofrinho}`
    : nomeKofrinho

  const subject = `Depósito de ${valorFormatado} confirmado no Kofrinho "${nomeKofrinho}"`
  const html = `
    <h2>Depósito confirmado! ✅</h2>
    <p>Olá, <strong>${nomeDepositante}</strong>!</p>
    <p>Seu depósito no Kofrinho foi confirmado com sucesso.</p>
    <table style="border-collapse:collapse;margin:1.5rem 0;">
      <tr>
        <td style="padding:8px 16px 8px 0;color:#666;">Kofrinho</td>
        <td style="padding:8px 0;font-weight:bold;">${referencia}</td>
      </tr>
      <tr>
        <td style="padding:8px 16px 8px 0;color:#666;">Valor</td>
        <td style="padding:8px 0;font-weight:bold;">${valorFormatado}</td>
      </tr>
      <tr>
        <td style="padding:8px 16px 8px 0;color:#666;">Data e hora</td>
        <td style="padding:8px 0;">${dataHora} (horário de Brasília)</td>
      </tr>
    </table>
    <p style="color:#888;font-size:0.85rem;">Este e-mail foi gerado automaticamente pelo Kofrinho.</p>
  `

  const resend = new Resend(carregarResendApiKey())
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || 'Kofrinho <noreply@mandacaru.org>',
    to: emailDepositante,
    subject,
    html,
  })

  if (error) {
    throw new Error(`Resend: ${error.message}`)
  }

  console.log(`📧 Confirmação de solicitação enviada para ${emailDepositante}`)
}

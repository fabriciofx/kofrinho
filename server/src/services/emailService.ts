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

export async function sendAgendamentoEmail(
  emailDepositante: string,
  nomeDonoKofrinho: string,
  nomeKofrinho: string,
  descricaoKofrinho: string | null,
  valor: number,
  recorrencia: string
): Promise<void> {
  const valorFormatado = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const referencia = descricaoKofrinho || nomeKofrinho

  const subject = `Kofrinho de ${nomeDonoKofrinho}: depositar ${valorFormatado} no cofre ${nomeKofrinho}`
  const html = `<p>Olá! Eu sou o Kofrinho! Estou lhe enviando essa mensagem para lembrar-lhe de depositar ${valorFormatado} no Kofrinho de ${nomeDonoKofrinho} referente a ${referencia}</p>`

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

  console.log(`📧 Resend: e-mail enviado para ${emailDepositante}`)
}

import nodemailer from 'nodemailer'

export interface EmailOptions {
  to: string
  subject: string
  html: string
}

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
    const transporter = await getTransporter()

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@kofrinho.com',
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

const RECORRENCIA_LABEL: Record<string, string> = {
  diario: 'Diário',
  semanal: 'Semanal',
  mensal: 'Mensal',
  anual: 'Anual',
}

export async function sendAgendamentoEmail(
  email: string,
  nomeUsuario: string,
  nomeKofrinho: string,
  nomeDepositante: string,
  valor: number,
  recorrencia: string
): Promise<void> {
  const label = RECORRENCIA_LABEL[recorrencia] ?? recorrencia
  const valorFormatado = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const html = `
    <h2>Kofrinho — Lembrete de Depósito ${label}</h2>
    <p>Olá, <strong>${nomeUsuario}</strong>!</p>
    <p>Este é o seu lembrete <strong>${label.toLowerCase()}</strong> de depósito:</p>
    <table cellpadding="8" style="border-collapse:collapse;">
      <tr><td><strong>Kofrinho:</strong></td><td>${nomeKofrinho}</td></tr>
      <tr><td><strong>Depositante:</strong></td><td>${nomeDepositante}</td></tr>
      <tr><td><strong>Valor:</strong></td><td>${valorFormatado}</td></tr>
      <tr><td><strong>Recorrência:</strong></td><td>${label}</td></tr>
    </table>
    <p style="margin-top:1rem;">Não esqueça de realizar o seu depósito! 💰</p>
  `

  await sendEmail({
    to: email,
    subject: `Kofrinho — Lembrete ${label}: ${nomeDepositante} (${valorFormatado})`,
    html,
  })
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

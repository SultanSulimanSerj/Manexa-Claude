import nodemailer from 'nodemailer'

export interface SendMailOptions {
  to: string
  subject: string
  text: string
  html?: string
  attachments?: { filename: string; content: Buffer; contentType?: string }[]
}

function isEmailConfigured(): boolean {
  return Boolean(
    process.env.EMAIL_SERVER_HOST &&
      process.env.EMAIL_SERVER_USER &&
      process.env.EMAIL_SERVER_PASSWORD
  )
}

export function isMailEnabled(): boolean {
  return isEmailConfigured()
}

export async function sendMail(options: SendMailOptions): Promise<boolean> {
  if (!isEmailConfigured()) {
    return false
  }

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: Number(process.env.EMAIL_SERVER_PORT || 587),
    secure: process.env.EMAIL_SERVER_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_SERVER_USER,
      pass: process.env.EMAIL_SERVER_PASSWORD,
    },
  })

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_SERVER_USER,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
    attachments: options.attachments,
  })

  return true
}

export async function sendInviteEmail(params: {
  to: string
  name: string
  tempPassword: string
  invitedBy: string
}): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const subject = 'Приглашение в Manexa'
  const text = [
    `Здравствуйте, ${params.name}!`,
    '',
    `${params.invitedBy} пригласил(а) вас в Manexa.`,
    `Временный пароль: ${params.tempPassword}`,
    '',
    `Войдите: ${appUrl}/auth/signin`,
    'Рекомендуем сменить пароль после первого входа.',
  ].join('\n')

  return sendMail({ to: params.to, subject, text })
}

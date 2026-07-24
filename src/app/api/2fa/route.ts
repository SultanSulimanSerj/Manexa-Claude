import { NextRequest, NextResponse } from 'next/server'
import { authenticator } from 'otplib'
import QRCode from 'qrcode'
import { prisma } from '@/lib/prisma'
import { authenticateUser } from '@/lib/auth-api'
import { blockIfImpersonated } from '@/lib/impersonation-guard'

export const dynamic = 'force-dynamic'

/** Статус 2FA текущего пользователя. */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { totpEnabled: true },
  })
  return NextResponse.json({ enabled: !!dbUser?.totpEnabled })
}

/**
 * Настройка 2FA (TOTP) для пользователя компании:
 * - action=init: генерация секрета + QR (не включает, пока не подтверждён код)
 * - action=verify: проверка кода → включение
 * - action=disable: выключение (требуется действующий код)
 */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Изменение 2FA запрещено под impersonation
  const blocked = await blockIfImpersonated(request)
  if (blocked) return blocked

  const body = await request.json().catch(() => ({}))
  const action = body.action as string

  if (action === 'init') {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { totpEnabled: true },
    })
    if (dbUser?.totpEnabled) {
      return NextResponse.json({ error: '2FA уже включена' }, { status: 400 })
    }

    const secret = authenticator.generateSecret()
    await prisma.user.update({
      where: { id: user.id },
      data: { totpSecret: secret, totpEnabled: false },
    })

    const otpauthUrl = authenticator.keyuri(user.email, 'Manexa', secret)
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { width: 240 })

    return NextResponse.json({ secret, otpauthUrl, qrDataUrl })
  }

  if (action === 'verify') {
    const code = String(body.code || '').replace(/\s/g, '')
    if (!code) {
      return NextResponse.json({ error: 'Введите код' }, { status: 400 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { totpSecret: true },
    })
    if (!dbUser?.totpSecret) {
      return NextResponse.json({ error: 'Сначала инициализируйте настройку' }, { status: 400 })
    }

    const valid = authenticator.verify({ token: code, secret: dbUser.totpSecret })
    if (!valid) {
      return NextResponse.json({ error: 'Неверный код. Проверьте время на устройстве.' }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { totpEnabled: true },
    })

    return NextResponse.json({ success: true })
  }

  if (action === 'disable') {
    const code = String(body.code || '').replace(/\s/g, '')
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { totpSecret: true, totpEnabled: true },
    })
    if (!dbUser?.totpEnabled || !dbUser.totpSecret) {
      return NextResponse.json({ error: '2FA не включена' }, { status: 400 })
    }
    const valid = authenticator.verify({ token: code, secret: dbUser.totpSecret })
    if (!valid) {
      return NextResponse.json({ error: 'Неверный код' }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { totpEnabled: false, totpSecret: null },
    })

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Неизвестное действие. Допустимо: init, verify, disable' }, { status: 400 })
}

import { NextRequest, NextResponse } from 'next/server'
import { authenticator } from 'otplib'
import QRCode from 'qrcode'
import { prisma } from '@/lib/prisma'
import { checkPlatformPermission, logPlatformAction } from '@/lib/platform-auth'

export const dynamic = 'force-dynamic'

/**
 * Настройка 2FA (TOTP) для платформенных ролей:
 * - action=init: генерация секрета + QR (totpEnabled остаётся false до подтверждения)
 * - action=verify: проверка кода → включение 2FA
 */
export async function POST(request: NextRequest) {
  const { allowed, user, error } = await checkPlatformPermission(request)
  if (!allowed || !user) {
    return NextResponse.json({ error: error || 'Не найдено' }, { status: 404 })
  }

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

    const otpauthUrl = authenticator.keyuri(user.email, 'Manexa Platform', secret)
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
      select: { totpSecret: true, totpEnabled: true },
    })
    if (!dbUser?.totpSecret) {
      return NextResponse.json({ error: 'Сначала инициализируйте настройку (action=init)' }, { status: 400 })
    }

    const valid = authenticator.verify({ token: code, secret: dbUser.totpSecret })
    if (!valid) {
      return NextResponse.json({ error: 'Неверный код. Проверьте время на устройстве.' }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { totpEnabled: true },
    })

    await logPlatformAction({
      actorId: user.id,
      actorEmail: user.email,
      action: 'TOTP_ENABLED',
      targetType: 'User',
      targetId: user.id,
      request,
    })

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Неизвестное действие. Допустимо: init, verify' }, { status: 400 })
}

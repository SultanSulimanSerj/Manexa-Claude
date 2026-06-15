import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { checkPlatformPermission, logPlatformAction } from '@/lib/platform-auth'
import { generateTempPassword } from '@/lib/temp-password'

export const dynamic = 'force-dynamic'

/**
 * Действия с пользователями компании из панели платформы:
 * - reset-password: временный пароль + mustChangePassword
 * - deactivate / activate
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { allowed, user, error } = await checkPlatformPermission(request, 'canManagePlatform')
  if (!allowed || !user) {
    return NextResponse.json({ error: error || 'Не найдено' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const { action, userId } = body as { action?: string; userId?: string }

  if (!userId || !action) {
    return NextResponse.json({ error: 'Требуются userId и action' }, { status: 400 })
  }

  const targetUser = await prisma.user.findFirst({
    where: { id: userId, companyId: params.id },
  })
  if (!targetUser) {
    return NextResponse.json({ error: 'Пользователь не найден в этой компании' }, { status: 404 })
  }

  if (action === 'reset-password') {
    const tempPassword = generateTempPassword()
    const hashed = await bcrypt.hash(tempPassword, 10)
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed, mustChangePassword: true },
    })

    await logPlatformAction({
      actorId: user.id,
      actorEmail: user.email,
      action: 'PASSWORD_RESET',
      targetType: 'User',
      targetId: userId,
      metadata: { email: targetUser.email, companyId: params.id },
      request,
    })

    // Пароль показывается менеджеру один раз
    return NextResponse.json({ success: true, tempPassword })
  }

  if (action === 'deactivate' || action === 'activate') {
    const isActive = action === 'activate'
    if (!isActive && targetUser.role === 'OWNER') {
      return NextResponse.json(
        { error: 'Нельзя деактивировать директора компании. Используйте архивирование компании.' },
        { status: 400 }
      )
    }
    await prisma.user.update({ where: { id: userId }, data: { isActive } })

    await logPlatformAction({
      actorId: user.id,
      actorEmail: user.email,
      action: isActive ? 'USER_ACTIVATE' : 'USER_DEACTIVATE',
      targetType: 'User',
      targetId: userId,
      metadata: { email: targetUser.email, companyId: params.id },
      request,
    })

    return NextResponse.json({ success: true, isActive })
  }

  return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 })
}

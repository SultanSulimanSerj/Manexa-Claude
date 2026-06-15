import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { checkPlatformPermission, logPlatformAction } from '@/lib/platform-auth'

export const dynamic = 'force-dynamic'

const TOKEN_TTL_MIN = 30

/** Создание одноразового impersonation-токена (только PLATFORM_ADMIN). */
export async function POST(request: NextRequest) {
  const { allowed, user, error } = await checkPlatformPermission(request, 'canImpersonate')
  if (!allowed || !user) {
    return NextResponse.json({ error: error || 'Не найдено' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const { userId } = body as { userId?: string }
  if (!userId) {
    return NextResponse.json({ error: 'Требуется userId' }, { status: 400 })
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, isActive: true, companyId: true },
  })
  if (!targetUser || !targetUser.isActive) {
    return NextResponse.json({ error: 'Пользователь не найден или деактивирован' }, { status: 404 })
  }
  if (targetUser.role === 'PLATFORM_ADMIN' || targetUser.role === 'PLATFORM_MANAGER') {
    return NextResponse.json({ error: 'Нельзя войти от имени платформенного пользователя' }, { status: 400 })
  }

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MIN * 60 * 1000)

  await prisma.impersonationToken.create({
    data: {
      token,
      targetUserId: targetUser.id,
      issuedById: user.id,
      expiresAt,
    },
  })

  await logPlatformAction({
    actorId: user.id,
    actorEmail: user.email,
    action: 'IMPERSONATE_START',
    targetType: 'User',
    targetId: targetUser.id,
    metadata: { targetEmail: targetUser.email, companyId: targetUser.companyId },
    request,
  })

  return NextResponse.json({ token, expiresAt })
}

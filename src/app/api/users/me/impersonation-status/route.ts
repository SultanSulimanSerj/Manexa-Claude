import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-api'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Если сессия поддержки не завершается штатно (админ просто закрыл вкладку),
// считаем импперсонацию неактивной спустя это время после входа — чтобы у юзера
// не висел баннер вечно.
const ACTIVE_MAX_MS = 6 * 60 * 60 * 1000 // 6 часов

/**
 * Статус для САМОГО пользователя: вошёл ли сейчас админ поддержки под его учёткой.
 * Активно = есть токен с usedAt (админ реально вошёл), без endedAt, вход не старше ACTIVE_MAX_MS.
 * Намеренно не раскрываем, какой именно админ.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const since = new Date(Date.now() - ACTIVE_MAX_MS)
  const active = await prisma.impersonationToken.findFirst({
    where: {
      targetUserId: user.id,
      endedAt: null,
      usedAt: { not: null, gte: since },
    },
    orderBy: { usedAt: 'desc' },
    select: { usedAt: true },
  })

  return NextResponse.json({
    active: !!active,
    since: active?.usedAt ?? null,
  })
}

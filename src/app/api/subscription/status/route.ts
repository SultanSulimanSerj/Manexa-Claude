import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-api'
import { prisma } from '@/lib/prisma'
import { getCompanyAccessStatus } from '@/lib/subscription-guard'

export const dynamic = 'force-dynamic'

/** Статус подписки компании текущего пользователя (для гейта и страницы /suspended). */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Не аутентифицирован' }, { status: 401 })
  }
  if (!user.companyId) {
    return NextResponse.json({ blocked: false, reason: null, subscription: null })
  }

  const access = await getCompanyAccessStatus(user.companyId)
  const subscription = await prisma.subscription.findUnique({
    where: { companyId: user.companyId },
    select: {
      status: true,
      currentPeriodEnd: true,
      plan: { select: { code: true, name: true } },
    },
  })

  return NextResponse.json({
    blocked: access.blocked,
    reason: access.reason,
    subscription,
  })
}

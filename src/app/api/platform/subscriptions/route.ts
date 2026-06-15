import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPlatformPermission } from '@/lib/platform-auth'

export const dynamic = 'force-dynamic'

/** Список подписок (по умолчанию — требующие внимания первыми). */
export async function GET(request: NextRequest) {
  const { allowed, user, error } = await checkPlatformPermission(request, 'canManagePlatform')
  if (!allowed || !user) {
    return NextResponse.json({ error: error || 'Не найдено' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  const subscriptions = await prisma.subscription.findMany({
    where: status ? { status: status as any } : undefined,
    include: {
      company: { select: { id: true, name: true, inn: true, isActive: true } },
      plan: { select: { code: true, name: true, priceMonthly: true } },
      payments: { orderBy: { paidAt: 'desc' }, take: 1 },
    },
    orderBy: { currentPeriodEnd: 'asc' },
  })

  return NextResponse.json({ subscriptions })
}

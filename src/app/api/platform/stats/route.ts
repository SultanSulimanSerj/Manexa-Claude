import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPlatformPermission } from '@/lib/platform-auth'

export const dynamic = 'force-dynamic'

/** Метрики для дашборда платформы. */
export async function GET(request: NextRequest) {
  const { allowed, user, error } = await checkPlatformPermission(request, 'canManagePlatform')
  if (!allowed || !user) {
    return NextResponse.json({ error: error || 'Не найдено' }, { status: 404 })
  }

  const monthAgo = new Date()
  monthAgo.setDate(monthAgo.getDate() - 30)

  const [
    companiesTotal,
    companiesActive,
    companiesArchived,
    subsTrial,
    subsActive,
    subsPastDue,
    subsSuspended,
    usersTotal,
    usersActive,
    companiesNewMonth,
    paymentsMonth,
  ] = await prisma.$transaction([
    prisma.company.count(),
    prisma.company.count({ where: { isActive: true } }),
    prisma.company.count({ where: { isActive: false } }),
    prisma.subscription.count({ where: { status: 'TRIAL' } }),
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    prisma.subscription.count({ where: { status: 'PAST_DUE' } }),
    prisma.subscription.count({ where: { status: 'SUSPENDED' } }),
    prisma.user.count({ where: { role: { notIn: ['PLATFORM_ADMIN', 'PLATFORM_MANAGER'] } } }),
    prisma.user.count({
      where: { isActive: true, role: { notIn: ['PLATFORM_ADMIN', 'PLATFORM_MANAGER'] } },
    }),
    prisma.company.count({ where: { createdAt: { gte: monthAgo } } }),
    prisma.payment.aggregate({
      where: { paidAt: { gte: monthAgo }, status: 'COMPLETED' },
      _sum: { amount: true },
      _count: true,
    }),
  ])

  return NextResponse.json({
    companies: {
      total: companiesTotal,
      active: companiesActive,
      archived: companiesArchived,
      newLast30Days: companiesNewMonth,
    },
    subscriptions: {
      trial: subsTrial,
      active: subsActive,
      pastDue: subsPastDue,
      suspended: subsSuspended,
    },
    users: { total: usersTotal, active: usersActive },
    payments: {
      last30DaysAmount: paymentsMonth._sum.amount?.toString() || '0',
      last30DaysCount: paymentsMonth._count,
    },
  })
}

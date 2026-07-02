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

  const now = new Date()
  const in7Days = new Date()
  in7Days.setDate(in7Days.getDate() + 7)

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
    prisma.subscription.count({ where: { status: 'TRIAL', company: { isActive: true } } }),
    prisma.subscription.count({ where: { status: 'ACTIVE', company: { isActive: true } } }),
    prisma.subscription.count({ where: { status: 'PAST_DUE', company: { isActive: true } } }),
    prisma.subscription.count({ where: { status: 'SUSPENDED', company: { isActive: true } } }),
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

  // Истекают в ближайшие 7 дней (ещё активные)
  const expiringSoon = await prisma.subscription.findMany({
    where: {
      status: { in: ['ACTIVE', 'TRIAL'] },
      company: { isActive: true },
      currentPeriodEnd: { gte: now, lte: in7Days },
    },
    select: {
      id: true,
      currentPeriodEnd: true,
      status: true,
      company: { select: { id: true, name: true } },
      plan: { select: { name: true, priceMonthly: true } },
    },
    orderBy: { currentPeriodEnd: 'asc' },
    take: 20,
  })

  // Просрочены / заблокированы / период в прошлом
  const overdue = await prisma.subscription.findMany({
    where: {
      company: { isActive: true },
      OR: [
        { status: { in: ['PAST_DUE', 'SUSPENDED'] } },
        { status: { in: ['ACTIVE', 'TRIAL'] }, currentPeriodEnd: { lt: now } },
      ],
    },
    select: {
      id: true,
      currentPeriodEnd: true,
      status: true,
      company: { select: { id: true, name: true } },
      plan: { select: { name: true, priceMonthly: true } },
    },
    orderBy: { currentPeriodEnd: 'asc' },
    take: 20,
  })

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
    expiringSoon: expiringSoon.map((s) => ({
      id: s.id,
      companyId: s.company.id,
      companyName: s.company.name,
      planName: s.plan.name,
      currentPeriodEnd: s.currentPeriodEnd,
      status: s.status,
    })),
    overdue: overdue.map((s) => ({
      id: s.id,
      companyId: s.company.id,
      companyName: s.company.name,
      planName: s.plan.name,
      currentPeriodEnd: s.currentPeriodEnd,
      status: s.status,
    })),
  })
}

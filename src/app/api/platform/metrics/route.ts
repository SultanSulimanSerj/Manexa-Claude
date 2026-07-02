import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPlatformPermission } from '@/lib/platform-auth'

export const dynamic = 'force-dynamic'

/**
 * Бизнес-метрики платформы (числами, без графиков):
 * MRR/ARR, ARPU, платящие компании, конверсия в платные, отток, помесячная динамика.
 */
export async function GET(request: NextRequest) {
  const { allowed, user, error } = await checkPlatformPermission(request, 'canManagePlatform')
  if (!allowed || !user) {
    return NextResponse.json({ error: error || 'Не найдено' }, { status: 404 })
  }

  const now = new Date()
  const monthAgo = new Date()
  monthAgo.setDate(monthAgo.getDate() - 30)

  // Начало периода: первый день месяца 5 месяцев назад → 6 месяцев включительно
  const sixStart = new Date(now.getFullYear(), now.getMonth() - 5, 1)

  // Платящие (ACTIVE) подписки активных компаний → paid MRR, ARPU
  const activePaidSubs = await prisma.subscription.findMany({
    where: { status: 'ACTIVE', company: { isActive: true } },
    select: { plan: { select: { priceMonthly: true } } },
  })
  const payingCompanies = activePaidSubs.length
  const paidMrr = activePaidSubs.reduce((s, x) => s + Number(x.plan.priceMonthly), 0)
  const arr = paidMrr * 12
  const arpu = payingCompanies > 0 ? paidMrr / payingCompanies : 0

  // Конверсия в платные: подписки активных компаний, у которых был хотя бы 1 проведённый платёж
  const [companiesWithSub, paidCompanies] = await prisma.$transaction([
    prisma.subscription.count({ where: { company: { isActive: true } } }),
    prisma.subscription.count({
      where: { company: { isActive: true }, payments: { some: { status: 'COMPLETED' } } },
    }),
  ])
  const conversionRate = companiesWithSub > 0 ? (paidCompanies / companiesWithSub) * 100 : 0

  // Отток за 30 дней: отменённые или заблокированные за период (по точным датам)
  const churned30 = await prisma.subscription.count({
    where: {
      OR: [
        { canceledAt: { gte: monthAgo } },
        { suspendedAt: { gte: monthAgo } },
      ],
    },
  })
  const churnBase = payingCompanies + churned30
  const churnRate = churnBase > 0 ? (churned30 / churnBase) * 100 : 0

  // Помесячная динамика (6 месяцев): новые компании, платежи (сумма/кол-во)
  const [companies, payments] = await prisma.$transaction([
    prisma.company.findMany({
      where: { createdAt: { gte: sixStart } },
      select: { createdAt: true },
    }),
    prisma.payment.findMany({
      where: { paidAt: { gte: sixStart }, status: 'COMPLETED' },
      select: { paidAt: true, amount: true },
    }),
  ])

  const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  const months: { key: string; label: string; newCompanies: number; paymentsSum: number; paymentsCount: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({
      key: monthKey(d),
      label: d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }),
      newCompanies: 0,
      paymentsSum: 0,
      paymentsCount: 0,
    })
  }
  const byKey = new Map(months.map((m) => [m.key, m]))
  for (const c of companies) {
    const m = byKey.get(monthKey(c.createdAt))
    if (m) m.newCompanies++
  }
  for (const p of payments) {
    const m = byKey.get(monthKey(p.paidAt))
    if (m) {
      m.paymentsSum += Number(p.amount)
      m.paymentsCount++
    }
  }

  return NextResponse.json({
    mrr: paidMrr.toString(),
    arr: arr.toString(),
    arpu: Math.round(arpu).toString(),
    payingCompanies,
    conversion: { rate: Math.round(conversionRate * 10) / 10, paid: paidCompanies, total: companiesWithSub },
    churn: { rate: Math.round(churnRate * 10) / 10, count: churned30 },
    months: months.map((m) => ({
      label: m.label,
      newCompanies: m.newCompanies,
      paymentsSum: m.paymentsSum.toString(),
      paymentsCount: m.paymentsCount,
    })),
  })
}

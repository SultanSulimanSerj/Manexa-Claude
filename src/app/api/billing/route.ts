import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET — подписка и счета компании (только OWNER/ADMIN компании)
export async function GET(request: NextRequest) {
  const { allowed, user, error } = await checkPermission(request, 'canViewCompanySettings')
  if (!allowed || !user || !user.companyId) {
    return NextResponse.json({ error: error || 'Недостаточно прав' }, { status: 403 })
  }

  const [subscription, invoices] = await Promise.all([
    prisma.subscription.findUnique({
      where: { companyId: user.companyId },
      include: { plan: { select: { name: true, code: true, priceMonthly: true } } },
    }),
    prisma.invoice.findMany({
      where: { companyId: user.companyId },
      orderBy: { issuedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        number: true,
        planName: true,
        months: true,
        amount: true,
        status: true,
        issuedAt: true,
        dueDate: true,
        paidAt: true,
        actNumber: true,
      },
    }),
  ])

  return NextResponse.json({
    subscription: subscription
      ? {
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
          plan: subscription.plan,
        }
      : null,
    invoices,
  })
}

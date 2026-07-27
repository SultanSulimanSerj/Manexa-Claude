import { NextRequest, NextResponse } from 'next/server'
import { checkPlatformPermission, logPlatformAction } from '@/lib/platform-auth'
import { getPlatformSettings, sellerRequisitesComplete, calcInvoiceAmount } from '@/lib/platform-settings'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

async function nextInvoiceNumber(prefix: string): Promise<string> {
  const year = new Date().getFullYear()
  const count = await prisma.invoice.count({
    where: { number: { startsWith: `${prefix}-${year}-` } },
  })
  return `${prefix}-${year}-${String(count + 1).padStart(3, '0')}`
}

// GET — список счетов (опционально по компании)
export async function GET(request: NextRequest) {
  const { allowed, user, error } = await checkPlatformPermission(request, 'canManagePlatform')
  if (!allowed || !user) {
    return NextResponse.json({ error: error || 'Не найдено' }, { status: 404 })
  }

  const companyId = new URL(request.url).searchParams.get('companyId')
  const invoices = await prisma.invoice.findMany({
    where: { ...(companyId && { companyId }) },
    include: { company: { select: { id: true, name: true, inn: true } } },
    orderBy: { issuedAt: 'desc' },
    take: 200,
  })
  return NextResponse.json({ invoices })
}

// POST — выставить счёт: { companyId, planId, months }
export async function POST(request: NextRequest) {
  const { allowed, user, error } = await checkPlatformPermission(request, 'canManagePlatform')
  if (!allowed || !user) {
    return NextResponse.json({ error: error || 'Недостаточно прав' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { companyId, planId } = body as { companyId?: string; planId?: string }
  const months = Math.max(1, Math.min(24, parseInt(String(body.months), 10) || 1))

  if (!companyId || !planId) {
    return NextResponse.json({ error: 'Нужны компания и тариф' }, { status: 400 })
  }

  const settings = await getPlatformSettings()
  if (!sellerRequisitesComplete(settings)) {
    return NextResponse.json(
      { error: 'Заполните реквизиты продавца в настройках (название, ИНН, р/с, БИК)' },
      { status: 400 }
    )
  }

  const [company, plan] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      include: { subscription: true },
    }),
    prisma.plan.findUnique({ where: { id: planId } }),
  ])
  if (!company) return NextResponse.json({ error: 'Компания не найдена' }, { status: 404 })
  if (!plan) return NextResponse.json({ error: 'Тариф не найден' }, { status: 404 })

  const calc = calcInvoiceAmount({
    priceMonthly: Number(plan.priceMonthly),
    months,
    annualDiscountPercent: settings.annualDiscountPercent,
    taxMode: settings.taxMode,
    vatRate: settings.vatRate,
  })

  // Период: от текущего конца подписки (если в будущем) или от сегодня
  const now = new Date()
  const base =
    company.subscription && company.subscription.currentPeriodEnd > now
      ? company.subscription.currentPeriodEnd
      : now
  const periodEnd = new Date(base)
  periodEnd.setMonth(periodEnd.getMonth() + months)

  const dueDate = new Date(now)
  dueDate.setDate(dueDate.getDate() + 7)

  const number = await nextInvoiceNumber(settings.invoicePrefix || 'СЧ')

  const invoice = await prisma.invoice.create({
    data: {
      number,
      companyId,
      planId,
      planName: plan.name,
      months,
      unitPriceMonthly: plan.priceMonthly,
      discountPercent: calc.discountPercent,
      subtotal: calc.subtotal,
      amount: calc.amount,
      vatRate: calc.vatRate,
      vatAmount: calc.vatAmount,
      status: 'ISSUED',
      periodStart: base,
      periodEnd,
      dueDate,
      createdById: user.id,
    },
  })

  await logPlatformAction({
    actorId: user.id,
    actorEmail: user.email,
    action: 'INVOICE_ISSUED',
    targetType: 'Invoice',
    targetId: invoice.id,
    metadata: { company: company.name, number, amount: calc.amount, months },
    request,
  })

  return NextResponse.json({ invoice }, { status: 201 })
}

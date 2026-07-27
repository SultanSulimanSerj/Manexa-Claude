import { NextRequest, NextResponse } from 'next/server'
import { checkPlatformPermission, logPlatformAction } from '@/lib/platform-auth'
import { invalidateCompanyAccessCache } from '@/lib/subscription-guard'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET — детали счёта
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { allowed, user, error } = await checkPlatformPermission(request, 'canManagePlatform')
  if (!allowed || !user) {
    return NextResponse.json({ error: error || 'Не найдено' }, { status: 404 })
  }
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { company: { select: { id: true, name: true, inn: true } } },
  })
  if (!invoice) return NextResponse.json({ error: 'Счёт не найден' }, { status: 404 })
  return NextResponse.json({ invoice })
}

// POST — действия: { action: 'pay' | 'cancel' }
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { allowed, user, error } = await checkPlatformPermission(request, 'canManagePlatform')
  if (!allowed || !user) {
    return NextResponse.json({ error: error || 'Недостаточно прав' }, { status: 403 })
  }

  const { action } = await request.json().catch(() => ({}))
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { company: { include: { subscription: true } } },
  })
  if (!invoice) return NextResponse.json({ error: 'Счёт не найден' }, { status: 404 })

  if (action === 'cancel') {
    if (invoice.status === 'PAID') {
      return NextResponse.json({ error: 'Оплаченный счёт нельзя отменить' }, { status: 400 })
    }
    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: 'CANCELED' },
    })
    await logPlatformAction({
      actorId: user.id,
      actorEmail: user.email,
      action: 'INVOICE_CANCELED',
      targetType: 'Invoice',
      targetId: invoice.id,
      metadata: { number: invoice.number },
      request,
    })
    return NextResponse.json({ invoice: updated })
  }

  if (action === 'pay') {
    if (invoice.status === 'PAID') {
      return NextResponse.json({ error: 'Счёт уже оплачен' }, { status: 400 })
    }
    if (invoice.status === 'CANCELED') {
      return NextResponse.json({ error: 'Счёт отменён' }, { status: 400 })
    }
    const subscription = invoice.company.subscription
    if (!subscription) {
      return NextResponse.json({ error: 'У компании нет подписки' }, { status: 400 })
    }

    // Продлеваем от текущего конца периода (если в будущем) или от сегодня
    const now = new Date()
    const base = subscription.currentPeriodEnd > now ? subscription.currentPeriodEnd : now
    const newEnd = new Date(base)
    newEnd.setMonth(newEnd.getMonth() + invoice.months)

    // Номер акта (закрывающий) — генерим при оплате, если ещё нет
    const year = now.getFullYear()
    const actCount = await prisma.invoice.count({
      where: { actNumber: { startsWith: `АКТ-${year}-` } },
    })
    const actNumber = invoice.actNumber || `АКТ-${year}-${String(actCount + 1).padStart(3, '0')}`

    await prisma.$transaction([
      prisma.payment.create({
        data: {
          subscriptionId: subscription.id,
          amount: invoice.amount,
          method: 'bank_transfer',
          invoiceNumber: invoice.number,
          periodStart: base,
          periodEnd: newEnd,
          recordedById: user.id,
        },
      }),
      prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ACTIVE',
          planId: invoice.planId, // применяем тариф из счёта
          currentPeriodEnd: newEnd,
          ...(subscription.currentPeriodEnd <= now && { currentPeriodStart: now }),
        },
      }),
      prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: 'PAID',
          paidAt: now,
          periodStart: base,
          periodEnd: newEnd,
          actNumber,
          actGeneratedAt: now,
        },
      }),
    ])
    invalidateCompanyAccessCache(subscription.companyId)

    await logPlatformAction({
      actorId: user.id,
      actorEmail: user.email,
      action: 'INVOICE_PAID',
      targetType: 'Invoice',
      targetId: invoice.id,
      metadata: {
        company: invoice.company.name,
        number: invoice.number,
        amount: Number(invoice.amount),
        newPeriodEnd: newEnd.toISOString(),
      },
      request,
    })

    return NextResponse.json({ ok: true, currentPeriodEnd: newEnd })
  }

  return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 })
}

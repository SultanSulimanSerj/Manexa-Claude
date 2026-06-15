import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPlatformPermission, logPlatformAction } from '@/lib/platform-auth'
import { invalidateCompanyAccessCache } from '@/lib/subscription-guard'

export const dynamic = 'force-dynamic'

/**
 * Действия с подпиской:
 * - payment: ручная фиксация оплаты + продление периода
 * - change-plan: смена тарифа
 * - suspend / activate: ручная блокировка / разблокировка
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { allowed, user, error } = await checkPlatformPermission(request, 'canManagePlatform')
  if (!allowed || !user) {
    return NextResponse.json({ error: error || 'Не найдено' }, { status: 404 })
  }

  const subscription = await prisma.subscription.findUnique({
    where: { id: params.id },
    include: { plan: true, company: { select: { id: true, name: true } } },
  })
  if (!subscription) {
    return NextResponse.json({ error: 'Подписка не найдена' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const action = body.action as string

  if (action === 'payment') {
    const { amount, months, method, invoiceNumber, comment } = body
    const monthsCount = Math.max(1, Math.min(24, parseInt(months, 10) || 1))
    const paymentAmount = amount !== undefined ? Number(amount) : Number(subscription.plan.priceMonthly) * monthsCount

    if (!Number.isFinite(paymentAmount) || paymentAmount < 0) {
      return NextResponse.json({ error: 'Некорректная сумма' }, { status: 400 })
    }

    // Продлеваем от текущего конца периода (если он в будущем) или от сегодня
    const now = new Date()
    const base = subscription.currentPeriodEnd > now ? subscription.currentPeriodEnd : now
    const newEnd = new Date(base)
    newEnd.setMonth(newEnd.getMonth() + monthsCount)

    const [payment] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          subscriptionId: subscription.id,
          amount: paymentAmount,
          method: method || 'bank_transfer',
          invoiceNumber: invoiceNumber || null,
          comment: comment || null,
          periodStart: base,
          periodEnd: newEnd,
          recordedById: user.id,
        },
      }),
      prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ACTIVE',
          currentPeriodEnd: newEnd,
          ...(subscription.currentPeriodEnd <= now && { currentPeriodStart: now }),
        },
      }),
    ])
    invalidateCompanyAccessCache(subscription.companyId)

    await logPlatformAction({
      actorId: user.id,
      actorEmail: user.email,
      action: 'SUBSCRIPTION_PAYMENT',
      targetType: 'Subscription',
      targetId: subscription.id,
      metadata: {
        company: subscription.company.name,
        amount: paymentAmount,
        months: monthsCount,
        newPeriodEnd: newEnd.toISOString(),
      },
      request,
    })

    return NextResponse.json({ success: true, paymentId: payment.id, currentPeriodEnd: newEnd })
  }

  if (action === 'change-plan') {
    const { planCode } = body
    const plan = await prisma.plan.findUnique({ where: { code: planCode } })
    if (!plan) {
      return NextResponse.json({ error: `Тариф ${planCode} не найден` }, { status: 400 })
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { planId: plan.id },
    })

    await logPlatformAction({
      actorId: user.id,
      actorEmail: user.email,
      action: 'SUBSCRIPTION_PLAN_CHANGE',
      targetType: 'Subscription',
      targetId: subscription.id,
      metadata: { company: subscription.company.name, from: subscription.plan.code, to: plan.code },
      request,
    })

    return NextResponse.json({ success: true, plan: plan.code })
  }

  if (action === 'suspend' || action === 'activate') {
    const newStatus = action === 'suspend' ? 'SUSPENDED' : 'ACTIVE'
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: newStatus },
    })
    invalidateCompanyAccessCache(subscription.companyId)

    await logPlatformAction({
      actorId: user.id,
      actorEmail: user.email,
      action: action === 'suspend' ? 'SUBSCRIPTION_SUSPEND' : 'SUBSCRIPTION_ACTIVATE',
      targetType: 'Subscription',
      targetId: subscription.id,
      metadata: { company: subscription.company.name },
      request,
    })

    return NextResponse.json({ success: true, status: newStatus })
  }

  return NextResponse.json({ error: 'Неизвестное действие. Допустимо: payment, change-plan, suspend, activate' }, { status: 400 })
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPlatformPermission, logPlatformAction } from '@/lib/platform-auth'

export const dynamic = 'force-dynamic'

/**
 * Действия с платежом:
 * - refund: пометить платёж как возвращённый (период подписки не откатывается автоматически).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  // Возврат — финансовое действие, только PLATFORM_ADMIN
  const { allowed, user, error } = await checkPlatformPermission(request, 'canManagePlatformManagers')
  if (!allowed || !user) {
    return NextResponse.json({ error: error || 'Не найдено' }, { status: 404 })
  }

  const payment = await prisma.payment.findUnique({
    where: { id: params.id },
    include: { subscription: { select: { company: { select: { name: true } } } } },
  })
  if (!payment) {
    return NextResponse.json({ error: 'Платёж не найден' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const action = body.action as string

  if (action === 'refund') {
    if (payment.status === 'REFUNDED') {
      return NextResponse.json({ error: 'Платёж уже возвращён' }, { status: 400 })
    }
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'REFUNDED', comment: body.comment || payment.comment },
    })

    await logPlatformAction({
      actorId: user.id,
      actorEmail: user.email,
      action: 'PAYMENT_REFUND',
      targetType: 'Payment',
      targetId: payment.id,
      metadata: {
        company: payment.subscription?.company?.name,
        amount: payment.amount.toString(),
      },
      request,
    })

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Неизвестное действие. Допустимо: refund' }, { status: 400 })
}

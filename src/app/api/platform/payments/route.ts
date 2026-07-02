import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPlatformPermission } from '@/lib/platform-auth'

export const dynamic = 'force-dynamic'

/**
 * Реестр платежей по подпискам.
 * Фильтры: from, to (по paidAt), status, search (компания / ИНН / номер счёта).
 * ?format=csv — выгрузка для бухгалтерии.
 */
export async function GET(request: NextRequest) {
  const { allowed, user, error } = await checkPlatformPermission(request, 'canManagePlatform')
  if (!allowed || !user) {
    return NextResponse.json({ error: error || 'Не найдено' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const status = searchParams.get('status')
  const search = searchParams.get('search')?.trim()
  const format = searchParams.get('format')
  const rawPage = parseInt(searchParams.get('page') || '1')
  const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage
  const perPage = 100

  const where: any = {}
  if (status) where.status = status
  if (from || to) {
    where.paidAt = {}
    if (from) where.paidAt.gte = new Date(from)
    if (to) {
      const end = new Date(to)
      end.setHours(23, 59, 59, 999)
      where.paidAt.lte = end
    }
  }
  if (search) {
    where.OR = [
      { invoiceNumber: { contains: search, mode: 'insensitive' } },
      { subscription: { company: { name: { contains: search, mode: 'insensitive' } } } },
      { subscription: { company: { inn: { contains: search } } } },
    ]
  }

  const payments = await prisma.payment.findMany({
    where,
    include: {
      subscription: {
        select: {
          company: { select: { id: true, name: true, inn: true } },
          plan: { select: { name: true } },
        },
      },
    },
    orderBy: { paidAt: 'desc' },
    skip: format === 'csv' ? 0 : (page - 1) * perPage,
    take: format === 'csv' ? 10000 : perPage,
  })

  // Итоги по ВСЕМУ фильтру (не по текущей странице)
  const [totalCount, sumByStatus] = await prisma.$transaction([
    prisma.payment.count({ where }),
    prisma.payment.groupBy({ by: ['status'], where, _sum: { amount: true }, orderBy: { status: 'asc' } }),
  ])
  const completed = Number(sumByStatus.find((s) => s.status === 'COMPLETED')?._sum?.amount || 0)
  const refunded = Number(sumByStatus.find((s) => s.status === 'REFUNDED')?._sum?.amount || 0)

  if (format === 'csv') {
    const header = ['Дата', 'Компания', 'ИНН', 'Тариф', 'Сумма', 'Статус', 'Способ', 'Счёт', 'Комментарий']
    const rows = payments.map((p) => [
      new Date(p.paidAt).toLocaleDateString('ru-RU'),
      p.subscription?.company?.name || '',
      p.subscription?.company?.inn || '',
      p.subscription?.plan?.name || '',
      Number(p.amount).toFixed(2),
      p.status,
      p.method || '',
      p.invoiceNumber || '',
      (p.comment || '').replace(/[\r\n";]/g, ' '),
    ])
    // Экранирование + защита от CSV-инъекций (=,+,-,@ в начале ячейки)
    const cell = (c: unknown) => {
      let s = String(c)
      if (/^[=+\-@]/.test(s)) s = "'" + s
      return `"${s.replace(/"/g, '""')}"`
    }
    const csv =
      '﻿' +
      [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n')
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="payments_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  }

  return NextResponse.json({
    payments: payments.map((p) => ({
      id: p.id,
      amount: p.amount.toString(),
      status: p.status,
      method: p.method,
      invoiceNumber: p.invoiceNumber,
      comment: p.comment,
      paidAt: p.paidAt,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      company: p.subscription?.company || null,
      planName: p.subscription?.plan?.name || null,
    })),
    totals: { completed: completed.toString(), refunded: refunded.toString(), net: (completed - refunded).toString(), count: totalCount },
    pagination: { page, perPage, total: totalCount, pages: Math.max(1, Math.ceil(totalCount / perPage)) },
  })
}

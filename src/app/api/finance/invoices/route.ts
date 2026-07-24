import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/auth-middleware'
import { blockIfImpersonated } from '@/lib/impersonation-guard'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canViewFinances')
    
    if (!user) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 401 })
    }
    
    if (!allowed) {
      await logger.security('Unauthorized access attempt to finance invoices API', { userId: user.id })
      return NextResponse.json({ error: error || 'Недостаточно прав' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    // Фильтрация по проекту и компании
    let where: any = {
      project: {
        companyId: user.companyId!
      }
    }

    if (projectId) {
      where.projectId = projectId
    }

    // Получаем данные о финансах (счета и платежи)
    type FinanceRow = {
      id: string
      type: string
      amount: unknown
      date: Date
      description: string | null
      category: string
      invoiceNumber: string | null
      dueDate: Date | null
      counterparty?: string | null
      isPaid: boolean
      paidAt: Date | null
      paidBy: { id: string; name: string } | null
    }

    let finances: FinanceRow[]
    try {
      finances = await prisma.finance.findMany({
        where: {
          ...where,
          type: {
            in: ['INCOME', 'EXPENSE']
          }
        },
        select: {
          id: true,
          type: true,
          amount: true,
          date: true,
          description: true,
          category: true,
          invoiceNumber: true,
          dueDate: true,
          counterparty: true,
          isPaid: true,
          paidAt: true,
          paidBy: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { date: 'desc' }
      }) as FinanceRow[]
    } catch (selectErr) {
      // Если колонка counterparty ещё не создана — запрашиваем без неё
      await logger.error('Error fetching finances (with counterparty), retrying without', { error: selectErr instanceof Error ? selectErr.message : 'Unknown' })
      finances = await prisma.finance.findMany({
        where: {
          ...where,
          type: { in: ['INCOME', 'EXPENSE'] }
        },
        select: {
          id: true,
          type: true,
          amount: true,
          date: true,
          description: true,
          category: true,
          invoiceNumber: true,
          dueDate: true,
          isPaid: true,
          paidAt: true,
          paidBy: { select: { id: true, name: true } }
        },
        orderBy: { date: 'desc' }
      }) as FinanceRow[]
      finances = finances.map((f) => ({ ...f, counterparty: null }))
    }

    const invoicesData = finances.map((finance) => {
      const isIncome = finance.type === 'INCOME'

      const now = new Date()
      // Просрочка только при наличии реального срока оплаты
      const isOverdue = !!finance.dueDate && finance.dueDate < now && !finance.isPaid
      let status: 'paid' | 'pending' | 'overdue'
      if (finance.isPaid) status = 'paid'
      else if (isOverdue) status = 'overdue'
      else status = 'pending'

      return {
        id: finance.id,
        number: finance.invoiceNumber || '—',
        type: isIncome ? ('invoice' as const) : ('payment' as const),
        amount: Number(finance.amount),
        date: finance.date.toISOString().split('T')[0],
        dueDate: finance.dueDate ? finance.dueDate.toISOString().split('T')[0] : null,
        isPaid: finance.isPaid,
        paidAt: finance.paidAt?.toISOString() || null,
        paidBy: finance.paidBy ? { id: finance.paidBy.id, name: finance.paidBy.name } : null,
        status,
        description: finance.description,
        category: finance.category,
        counterparty: finance.counterparty ?? null
      }
    })

    return NextResponse.json(invoicesData)

  } catch (error) {
    await logger.error('Error fetching finance invoices data', { error: error instanceof Error ? error.message : 'Unknown error' })
    return NextResponse.json({ error: 'Ошибка получения данных счетов и платежей' }, { status: 500 })
  }
}

// PATCH - отметить счёт как оплаченный
export async function PATCH(request: NextRequest) {
  try {
    const blocked = await blockIfImpersonated(request)
    if (blocked) return blocked

    const { allowed, user, error } = await checkPermission(request, 'canEditFinances')
    
    if (!user) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 401 })
    }
    
    if (!allowed) {
      await logger.security('Unauthorized access attempt to mark invoice as paid', { userId: user.id })
      return NextResponse.json({ error: error || 'Недостаточно прав' }, { status: 403 })
    }

    const body = await request.json()
    const { financeId, isPaid } = body

    if (!financeId) {
      return NextResponse.json({ error: 'ID записи обязателен' }, { status: 400 })
    }

    // Проверяем, что запись принадлежит компании пользователя
    const finance = await prisma.finance.findFirst({
      where: {
        id: financeId,
        project: {
          companyId: user.companyId!
        }
      }
    })

    if (!finance) {
      return NextResponse.json({ error: 'Запись не найдена' }, { status: 404 })
    }

    // Обновляем статус оплаты
    const updated = await prisma.finance.update({
      where: { id: financeId },
      data: {
        isPaid: isPaid !== undefined ? isPaid : true,
        paidAt: isPaid !== false ? new Date() : null,
        paidById: isPaid !== false ? user.id : null
      },
      select: {
        id: true,
        isPaid: true,
        paidAt: true,
        paidBy: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    await logger.info('Invoice marked as paid', { 
      financeId, 
      isPaid: updated.isPaid,
      userId: user.id 
    })

    return NextResponse.json(updated)

  } catch (error) {
    await logger.error('Error marking invoice as paid', { error: error instanceof Error ? error.message : 'Unknown error' })
    return NextResponse.json({ error: 'Ошибка обновления статуса оплаты' }, { status: 500 })
  }
}
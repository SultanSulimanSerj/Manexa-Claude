import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { checkPermission } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'
import { getCacheKey, getFromCache, setCache } from '@/lib/cache'
import { logger } from '@/lib/logger'
import { performanceMonitor } from '@/lib/monitoring'
import { createErrorAlert } from '@/lib/alerts'
import { notifyFinancialUpdate } from '@/lib/notifications'
import { UserRole } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const requestId = Math.random().toString(36).substring(7)
  
  try {
    const { allowed, user, error } = await checkPermission(request, 'canViewFinances')
    
    if (!user) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 401 })
    }
    
    if (!allowed) {
      await logger.security('Unauthorized access attempt to finance API', { requestId })
      return NextResponse.json({ error: error || 'Недостаточно прав' }, { status: 403 })
    }
    if (!user.id) {
      return NextResponse.json({ error: 'Пользователь не определён' }, { status: 401 })
    }
    if (!user.companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const type = searchParams.get('type')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const rawPage = parseInt(searchParams.get('page') || '1', 10)
    const rawLimit = parseInt(searchParams.get('limit') || '500', 10)
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage
    const limit = isNaN(rawLimit) || rawLimit < 1 ? 500 : Math.min(rawLimit, 5000)

    // Кэширование отключено для актуальности данных
    // const cacheKey = getCacheKey(request)
    // const cached = getFromCache(cacheKey)
    // if (cached) {
    //   return NextResponse.json(cached)
    // }

    // Фильтр по компании: по companyId или по project.companyId для старых записей
    const companyFilter = {
      OR: [
        { companyId: user.companyId! },
        { companyId: null, project: { companyId: user.companyId! } }
      ] as const
    }

    let where: any = {
      AND: [
        companyFilter,
        ...(projectId ? [{ projectId }] : []),
        ...(type ? [{ type: type as 'INCOME' | 'EXPENSE' }] : []),
        ...(startDate && endDate ? [{
          date: {
            gte: new Date(startDate),
            lte: new Date(endDate)
          }
        }] : [])
      ]
    }

    if (user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN) {
      where.AND.push({
        project: {
          OR: [
            { creatorId: user.id },
            { users: { some: { userId: user.id } } }
          ]
        }
      })
    }

    const [finances, total, totals, categoryTotals] = await Promise.all([
      prisma.finance.findMany({
        where,
        include: {
          project: {
            select: { id: true, name: true },
          },
          estimateItem: {
            select: { id: true, name: true },
          },
        },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.finance.count({ where }),
      prisma.finance.groupBy({
        by: ['type'],
        where,
        _sum: { amount: true },
      }),
      prisma.finance.groupBy({
        by: ['category', 'type'],
        where,
        _sum: { amount: true },
      }),
    ])

    const income = totals.find(t => t.type === 'INCOME')?._sum.amount || 0
    const expenses = totals.find(t => t.type === 'EXPENSE')?._sum.amount || 0
    const profit = Number(income) - Number(expenses)

    const expensesByCategory: Record<string, number> = {}
    for (const row of categoryTotals) {
      if (row.type !== 'EXPENSE' || !row.category) continue
      expensesByCategory[row.category] = Number(row._sum.amount || 0)
    }

    const result = {
      finances,
      summary: {
        income: Number(income),
        expenses: Number(expenses),
        profit,
        margin: Number(income) > 0 ? (profit / Number(income)) * 100 : 0,
        expensesByCategory,
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }

    // Кэширование отключено
    // setCache(cacheKey, result, 300)

    const duration = Date.now() - startTime
    performanceMonitor.recordOperation('GET /api/finance', duration, true, user.id, requestId)
    
    await logger.info('Finance data retrieved', { 
      userId: user.id, 
      requestId, 
      duration,
      projectId,
      type,
      recordCount: result.finances.length
    })

    return NextResponse.json(result)
  } catch (error) {
    const duration = Date.now() - startTime
    performanceMonitor.recordOperation('GET /api/finance', duration, false, undefined, requestId, error instanceof Error ? error.message : String(error))
    
    await logger.error('Error fetching finances', { 
      requestId, 
      duration,
      error: error instanceof Error ? error.message : String(error)
    })
    
    await createErrorAlert('Finance API error', { 
      operation: 'GET /api/finance',
      duration,
      error: error instanceof Error ? error.message : String(error)
    })
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canCreateFinances')
    
    if (!user) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 401 })
    }
    
    if (!allowed) {
      return NextResponse.json({ error: error || 'Недостаточно прав' }, { status: 403 })
    }
    if (!user.id) {
      return NextResponse.json({ error: 'Пользователь не определён' }, { status: 401 })
    }

    const body = await request.json()
    const { type, category, description, amount, date, projectId, estimateItemId, invoiceNumber, counterparty, dueDate, purchasedBy, receiptKeys } = body
    
    // projectId обязателен (схема Finance)
    if (!projectId || typeof projectId !== 'string' || projectId.trim() === '') {
      return NextResponse.json({ error: 'Укажите проект' }, { status: 400 })
    }

    // Валидация суммы
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      return NextResponse.json({ error: 'Некорректная сумма' }, { status: 400 })
    }

    if (!category || typeof category !== 'string' || category.trim() === '') {
      return NextResponse.json({ error: 'Укажите категорию' }, { status: 400 })
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId },
      select: { companyId: true }
    })
    if (!project) {
      return NextResponse.json({ error: 'Проект не найден' }, { status: 400 })
    }
    const companyId = project.companyId ?? user.companyId ?? null
    
    const financeType = type === 'EXPENSE' ? 'EXPENSE' : 'INCOME'
    const financeDate = date ? new Date(date) : new Date()
    if (isNaN(financeDate.getTime())) {
      return NextResponse.json({ error: 'Некорректная дата' }, { status: 400 })
    }

    const estItemId = typeof estimateItemId === 'string' && estimateItemId.trim() ? estimateItemId.trim() : null
    const invNumber = typeof invoiceNumber === 'string' && invoiceNumber.trim() ? invoiceNumber.trim() : null
    const counter = typeof counterparty === 'string' && counterparty.trim() ? counterparty.trim() : null
    const dueDateVal =
      typeof dueDate === 'string' && dueDate.trim() && !isNaN(new Date(dueDate).getTime())
        ? new Date(dueDate)
        : null

    // Создаём без counterparty и invoiceNumber — старый Prisma Client их не знает; потом допишем через raw SQL
    const finance = await prisma.finance.create({
      data: {
        type: financeType,
        category: category.trim(),
        description: typeof description === 'string' && description.trim() ? description.trim() : null,
        amount: parsedAmount,
        date: financeDate,
        projectId,
        creatorId: user.id,
        companyId,
        ...(estItemId ? { estimateItemId: estItemId } : {}),
        ...(typeof purchasedBy === 'string' && purchasedBy.trim() ? { purchasedBy: purchasedBy.trim() } : {}),
        ...(Array.isArray(receiptKeys) && receiptKeys.length ? { receiptKeys: receiptKeys.filter((k: unknown) => typeof k === 'string') } : {})
      },
      include: {
        project: {
          select: { id: true, name: true }
        }
      }
    })

    if (invNumber !== null || counter !== null || dueDateVal !== null) {
      try {
        await prisma.$executeRaw(
          Prisma.sql`UPDATE "Finance" SET "invoiceNumber" = ${invNumber}, "counterparty" = ${counter}, "dueDate" = ${dueDateVal} WHERE "id" = ${finance.id}`
        )
      } catch (rawErr) {
        console.error('Finance update invoiceNumber/counterparty/dueDate:', rawErr)
      }
    }

    // Отправляем уведомления участникам проекта
    if (projectId && finance.project) {
      try {
        // Получаем участников проекта
        const projectUsers = await prisma.projectUser.findMany({
          where: { projectId },
          select: { userId: true }
        })

        const participantIds = projectUsers.map(pu => pu.userId)
        
        if (participantIds.length > 0) {
          await notifyFinancialUpdate(
            projectId,
            participantIds,
            type as 'income' | 'expense' | 'budget',
            parsedAmount,
            finance.project.name,
            description
          )
        }
      } catch (notificationError) {
        console.error('Error sending financial update notifications:', notificationError)
        // Не прерываем создание финансовой записи из-за ошибки уведомлений
      }
    }

    return NextResponse.json(finance, { status: 201 })
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error))
    console.error('Error creating finance record:', err.message, err.stack)
    if (err.name === 'PrismaClientKnownRequestError') {
      const prismaErr = error as { code?: string; meta?: unknown }
      console.error('Prisma code:', prismaErr.code, 'meta:', prismaErr.meta)
    }
    return NextResponse.json(
      { error: 'Не удалось сохранить запись. Попробуйте ещё раз или обратитесь к администратору.' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { checkPermission, filterDataByPermissions } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'
import { notifyProjectUpdate } from '@/lib/notifications'
import { UserRole } from '@/lib/permissions'
import { generateId } from '@/lib/id-generator'
import { FinanceType } from '@prisma/client'
import { checkPlanLimit, PLAN_LIMIT_MESSAGES } from '@/lib/subscription-guard'

export async function GET(request: NextRequest) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canViewAllProjects')
    
    if (!allowed || !user) {
      return NextResponse.json({ error: error || 'Недостаточно прав' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const rawPage = parseInt(searchParams.get('page') || '1')
    const rawLimit = parseInt(searchParams.get('limit') || '10')
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage
    const limit = isNaN(rawLimit) || rawLimit < 1 ? 10 : Math.min(rawLimit, 100)
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    // Фильтрация проектов в зависимости от роли пользователя
    let where: any = {
      companyId: user.companyId,
      ...(status && { status })
    }

    // OWNER и ADMIN видят все проекты компании
    if (user.role === UserRole.OWNER || user.role === UserRole.ADMIN) {
      // Никаких дополнительных ограничений
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } }
        ]
      }
    } else {
      // MANAGER и USER видят только проекты, где являются участниками
      const baseFilter = [
        { creatorId: user.id }, // Пользователь создал проект
        { users: { some: { userId: user.id } } } // Пользователь является участником
      ]

      if (search) {
        // Если есть поиск, объединяем фильтры
        where.AND = [
          {
            OR: baseFilter
          },
          {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { description: { contains: search, mode: 'insensitive' as const } }
            ]
          }
        ]
      } else {
        where.OR = baseFilter
      }
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          creator: {
            select: { id: true, name: true, email: true }
          },
          _count: {
            select: { tasks: true, documents: true, users: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.project.count({ where })
    ])

    // Финансовые агрегаты одним запросом (без N+1)
    const projectIds = projects.map((p) => p.id)
    const financeAggregates =
      projectIds.length > 0
        ? await prisma.finance.groupBy({
            by: ['projectId', 'type'],
            where: { projectId: { in: projectIds } },
            _sum: { amount: true },
          })
        : []

    const financeByProject = new Map<
      string,
      { income: number; plannedIncome: number; expenses: number }
    >()
    for (const row of financeAggregates) {
      if (!row.projectId) continue
      const entry = financeByProject.get(row.projectId) || {
        income: 0,
        plannedIncome: 0,
        expenses: 0,
      }
      const amount = Number(row._sum.amount || 0)
      if (row.type === 'INCOME') entry.income += amount
      else if (row.type === 'PLANNED_INCOME') entry.plannedIncome += amount
      else if (row.type === 'EXPENSE') entry.expenses += amount
      financeByProject.set(row.projectId, entry)
    }

    const projectsWithFinance = projects.map((project) => {
      const fin = financeByProject.get(project.id) || {
        income: 0,
        plannedIncome: 0,
        expenses: 0,
      }
      const profit = fin.income - fin.expenses
      const margin = fin.income > 0 ? (profit / fin.income) * 100 : 0

      return {
        ...project,
        financialSummary: {
          income: fin.income,
          plannedIncome: fin.plannedIncome,
          expenses: fin.expenses,
          profit,
          margin: Math.round(margin * 10) / 10,
        },
      }
    })

    return NextResponse.json({
      projects: projectsWithFinance,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching projects:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canCreateProjects')
    
    if (!allowed || !user) {
      console.error('Permission denied for project creation:', { allowed, userId: user?.id, error })
      return NextResponse.json({ error: error || 'Недостаточно прав для создания проекта' }, { status: 403 })
    }

    if (!user.companyId) {
      console.error('User has no companyId:', { userId: user.id, email: user.email })
      return NextResponse.json({ error: 'Пользователь не привязан к компании' }, { status: 400 })
    }

    // Лимит проектов по тарифу
    const planLimit = await checkPlanLimit(user.companyId, 'projects')
    if (!planLimit.allowed) {
      return NextResponse.json(
        { error: `${PLAN_LIMIT_MESSAGES.projects} (${planLimit.current}/${planLimit.limit})` },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { 
      name, 
      description, 
      status, 
      priority, 
      budget, 
      startDate, 
      endDate,
      // Реквизиты клиента
      clientName,
      clientLegalName,
      clientInn,
      clientKpp,
      clientOgrn,
      clientLegalAddress,
      clientActualAddress,
      clientDirectorName,
      clientContactPhone,
      clientContactEmail,
      clientBankAccount,
      clientBankName,
      clientBankBik,
      clientCorrespondentAccount
    } = body

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Название проекта обязательно' }, { status: 400 })
    }

    // Валидация бюджета если он передан
    let parsedBudget: number | null = null
    if (budget !== undefined && budget !== null && budget !== '') {
      parsedBudget = parseFloat(budget)
      if (isNaN(parsedBudget) || parsedBudget < 0) {
        return NextResponse.json({ error: 'Некорректная сумма бюджета' }, { status: 400 })
      }
    }

    console.log('Creating project:', { name, companyId: user.companyId, creatorId: user.id })

    // Создаем проект и финансовую запись в транзакции
    const result = await prisma.$transaction(async (tx) => {
      // Создаем проект
        const project = await tx.project.create({
          data: {
            id: generateId(),
            name,
            description: description || null,
            status: status || 'PLANNING',
            priority: priority || 'MEDIUM',
            budget: parsedBudget,
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate) : null,
            companyId: user.companyId!,
            creatorId: user.id,
            updatedAt: new Date(),
            // Реквизиты клиента
            clientName: clientName || null,
            clientLegalName: clientLegalName || null,
            clientInn: clientInn || null,
            clientKpp: clientKpp || null,
            clientOgrn: clientOgrn || null,
            clientLegalAddress: clientLegalAddress || null,
            clientActualAddress: clientActualAddress || null,
            clientDirectorName: clientDirectorName || null,
            clientContactPhone: clientContactPhone || null,
            clientContactEmail: clientContactEmail || null,
            clientBankAccount: clientBankAccount || null,
            clientBankName: clientBankName || null,
            clientBankBik: clientBankBik || null,
            clientCorrespondentAccount: clientCorrespondentAccount || null
          },
        include: {
          creator: {
            select: { id: true, name: true, email: true }
          },
          _count: {
            select: { tasks: true, documents: true, users: true }
          }
        }
      })

      // Создатель проекта сразу попадает в команду проекта (роль OWNER)
      await tx.projectUser.create({
        data: {
          id: generateId(),
          projectId: project.id,
          userId: user.id,
          role: 'OWNER',
          companyId: user.companyId
        }
      })

      // Если указан бюджет, создаем финансовую запись в зависимости от статуса проекта
      if (parsedBudget && parsedBudget > 0) {
        const projectStatus = status || 'PLANNING'
        
        // Определяем тип финансовой записи в зависимости от статуса
        let financeType: 'PLANNED_INCOME' | 'INCOME' = 'PLANNED_INCOME'
        let financeCategory = 'Планируемый доход'
        
        if (projectStatus === 'ACTIVE' || projectStatus === 'COMPLETED') {
          financeType = 'INCOME'
          financeCategory = 'Доход от проекта'
        }
        
        await tx.finance.create({
          data: {
            id: generateId(),
            type: financeType as any,
            category: financeCategory,
            description: `Бюджет проекта "${name}"`,
            amount: parsedBudget,
            date: new Date(),
            projectId: project.id,
            creatorId: user.id,
            updatedAt: new Date()
          }
        })
      }

      return project
    })

    console.log('Project created successfully:', result.id)
    return NextResponse.json({ project: result }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating project:', error)
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack
    })
    
    // Более информативное сообщение об ошибке
    let errorMessage = 'Внутренняя ошибка сервера при создании проекта'
    if (error?.code === 'P2002') {
      errorMessage = 'Проект с таким названием уже существует'
    } else if (error?.code === 'P2003') {
      errorMessage = 'Ошибка связи с базой данных'
    } else if (error?.message) {
      errorMessage = error.message
    }
    
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
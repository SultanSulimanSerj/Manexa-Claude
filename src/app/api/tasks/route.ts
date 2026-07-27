import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'
import { notifyTaskAssignment } from '@/lib/notifications'
import { UserRole } from '@/lib/permissions'
import { generateId } from '@/lib/id-generator'

export async function GET(request: NextRequest) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canViewAllTasks')
    
    if (!allowed || !user) {
      return NextResponse.json({ error: error || 'Недостаточно прав' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const rawPage = parseInt(searchParams.get('page') || '1')
    const rawLimit = parseInt(searchParams.get('limit') || '10')
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage
    const limit = isNaN(rawLimit) || rawLimit < 1 ? 10 : Math.min(rawLimit, 100)
    const status = searchParams.get('status')
    const projectId = searchParams.get('projectId')
    const search = searchParams.get('search')

    // Фильтрация задач в зависимости от роли пользователя
    let where: any = {
      project: {
        companyId: user.companyId
      },
      ...(status && { status }),
      ...(projectId && { projectId }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } }
        ]
      })
    }

    // OWNER, ADMIN и Руководитель проекта (MANAGER) видят все задачи компании
    if (
      user.role === UserRole.OWNER ||
      user.role === UserRole.ADMIN ||
      user.role === UserRole.MANAGER
    ) {
      // Никаких дополнительных ограничений
    } else {
      // Сотрудник/Подрядчик/Заказчик видят только назначенные или созданные ими задачи
      where.OR = [
        { assignments: { some: { userId: user.id } } }, // Назначенные задачи
        { creatorId: user.id } // Созданные пользователем задачи
      ]
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          project: {
            select: { id: true, name: true }
          },
          creator: {
            select: { id: true, name: true, email: true }
          },
          assignments: {
            include: {
              user: {
                select: { id: true, name: true, email: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.task.count({ where })
    ])

    return NextResponse.json({
      tasks,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching tasks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canCreateTasks')
    
    if (!allowed || !user) {
      return NextResponse.json({ error: error || 'Недостаточно прав' }, { status: 403 })
    }

    const body = await request.json()
    const { title, description, status, priority, dueDate, projectId, assigneeIds } = body

    const task = await prisma.task.create({
      data: {
        id: generateId(),
        title,
        description: description || null,
        status: status || 'TODO',
        priority: priority || 'MEDIUM',
        dueDate: dueDate ? new Date(dueDate) : null,
        projectId: projectId || null,
        creatorId: user.id,
        updatedAt: new Date(),
        assignments: {
          create: assigneeIds?.map((userId: string) => ({
            id: generateId(),
            userId
          })) || []
        }
      },
      include: {
        project: {
          select: { id: true, name: true }
        },
        creator: {
          select: { id: true, name: true, email: true }
        },
        assignments: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    })

    // Отправляем уведомления назначенным пользователям
    if (assigneeIds && assigneeIds.length > 0) {
      try {
        await notifyTaskAssignment(
          task.id,
          assigneeIds,
          title,
          task.project?.name
        )
      } catch (notificationError) {
        console.error('Error sending task assignment notifications:', notificationError)
        // Не прерываем создание задачи из-за ошибки уведомлений
      }
    }

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error('Error creating task:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
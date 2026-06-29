import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/lib/permissions'
import { generateId } from '@/lib/id-generator'
import { FinanceType } from '@prisma/client'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canViewAllProjects')
    
    if (!allowed || !user) {
      return NextResponse.json({ error: error || 'Недостаточно прав' }, { status: 403 })
    }

    // Проверяем доступ к проекту в зависимости от роли
    let where: any = {
      id: params.id,
      companyId: user.companyId
    }

    // OWNER и ADMIN видят все проекты компании
    if (user.role === UserRole.OWNER || user.role === UserRole.ADMIN) {
      // Никаких дополнительных ограничений
    } else {
      // MANAGER и USER видят только проекты, где являются участниками
      where.OR = [
        { creatorId: user.id }, // Пользователь создал проект
        { users: { some: { userId: user.id } } } // Пользователь является участником
      ]
    }

    const project = await prisma.project.findFirst({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        priority: true,
        budget: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        updatedAt: true,
        // Данные клиента
        clientName: true,
        clientLegalName: true,
        clientInn: true,
        clientKpp: true,
        clientOgrn: true,
        clientLegalAddress: true,
        clientActualAddress: true,
        clientDirectorName: true,
        clientContactPhone: true,
        clientContactEmail: true,
        clientBankAccount: true,
        clientBankName: true,
        clientBankBik: true,
        clientCorrespondentAccount: true,
        // Дополнительные поля проекта
        objectAddress: true,
        contractNumber: true,
        contractDate: true,
        creator: {
          select: { id: true, name: true, email: true }
        },
        users: {
          select: {
            user: {
              select: { id: true, name: true, email: true, position: true, phone: true }
            }
          }
        },
        _count: {
          select: { tasks: true, documents: true, users: true }
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Чтобы в графике работ и др. всегда был кого назначить: включаем создателя в список участников, если его ещё нет
    const users = project.users || []
    const creatorInUsers = project.creator && users.some((pu: { user: { id: string } }) => pu.user?.id === project.creator?.id)
    const usersWithCreator = project.creator && !creatorInUsers
      ? [{ user: project.creator }, ...users]
      : users

    return NextResponse.json({ ...project, users: usersWithCreator })
  } catch (error) {
    console.error('Error fetching project:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canEditProjects')
    
    if (!allowed || !user) {
      return NextResponse.json({ error: error || 'Недостаточно прав' }, { status: 403 })
    }

    const body = await request.json()
    const { 
      name, 
      description, 
      startDate, 
      endDate, 
      budget, 
      priority, 
      status,
      // Данные клиента
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
      clientCorrespondentAccount,
      // Дополнительные поля проекта
      objectAddress,
      contractNumber,
      contractDate
    } = body

    // Валидация бюджета если он передан
    let parsedBudget: number | undefined
    if (budget !== undefined && budget !== null && budget !== '') {
      parsedBudget = parseFloat(budget)
      if (isNaN(parsedBudget) || parsedBudget < 0) {
        return NextResponse.json({ error: 'Некорректная сумма бюджета' }, { status: 400 })
      }
    }

    // Обновляем проект и финансовую запись в транзакции
    const result = await prisma.$transaction(async (tx) => {
      // Обновляем проект
      const project = await tx.project.update({
        where: {
          id: params.id,
          companyId: user.companyId
        },
        data: {
          ...(name && { name }),
          ...(description && { description }),
          ...(startDate && { startDate: new Date(startDate) }),
          ...(endDate && { endDate: new Date(endDate) }),
          ...(parsedBudget !== undefined && { budget: parsedBudget }),
          ...(priority && { priority }),
          ...(status && { status }),
          // Данные клиента
          ...(clientName !== undefined && { clientName }),
          ...(clientLegalName !== undefined && { clientLegalName }),
          ...(clientInn !== undefined && { clientInn }),
          ...(clientKpp !== undefined && { clientKpp }),
          ...(clientOgrn !== undefined && { clientOgrn }),
          ...(clientLegalAddress !== undefined && { clientLegalAddress }),
          ...(clientActualAddress !== undefined && { clientActualAddress }),
          ...(clientDirectorName !== undefined && { clientDirectorName }),
          ...(clientContactPhone !== undefined && { clientContactPhone }),
          ...(clientContactEmail !== undefined && { clientContactEmail }),
          ...(clientBankAccount !== undefined && { clientBankAccount }),
          ...(clientBankName !== undefined && { clientBankName }),
          ...(clientBankBik !== undefined && { clientBankBik }),
          ...(clientCorrespondentAccount !== undefined && { clientCorrespondentAccount }),
          // Дополнительные поля проекта
          ...(objectAddress !== undefined && { objectAddress }),
          ...(contractNumber !== undefined && { contractNumber }),
          ...(contractDate !== undefined && { contractDate: contractDate ? new Date(contractDate) : null })
        },
        include: {
          creator: {
            select: { id: true, name: true, email: true }
          },
          users: {
            include: {
              user: {
                select: { id: true, name: true, email: true, position: true, phone: true }
              }
            }
          },
          _count: {
            select: { tasks: true, documents: true, users: true }
          }
        }
      })

      // Получаем старый статус проекта для проверки изменения
      const oldProject = await tx.project.findUnique({
        where: { id: params.id },
        select: { status: true }
      })

      // Бюджет = стоимость договора (project.budget). Доходом не считается —
      // доходы ведутся отдельными счетами в реестре, поэтому авто-запись бюджета убрана.

      return project
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error updating project:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canDeleteProjects')
    
    if (!allowed || !user) {
      return NextResponse.json({ error: error || 'Недостаточно прав' }, { status: 403 })
    }

    // Check if project exists and belongs to user's company
    const project = await prisma.project.findFirst({
      where: {
        id: params.id,
        companyId: user.companyId
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Удаляем все связанные данные перед удалением проекта
    
    // 1. Удаляем назначения задач
    await prisma.taskAssignment.deleteMany({
      where: {
        task: {
          projectId: params.id
        }
      }
    })

    // 2. Удаляем задачи проекта
    await prisma.task.deleteMany({
      where: { projectId: params.id }
    })

    // 3. Удаляем сообщения проекта
    await prisma.chatMessage.deleteMany({
      where: { projectId: params.id }
    })

    // 4. Удаляем смету проекта
    await prisma.estimate.deleteMany({
      where: { projectId: params.id }
    })

    // 5. Удаляем финансы проекта
    await prisma.finance.deleteMany({
      where: { projectId: params.id }
    })

    // 6. Удаляем документы проекта
    await prisma.document.deleteMany({
      where: { projectId: params.id }
    })

    // 7. Удаляем участников проекта
    await prisma.projectUser.deleteMany({
      where: { projectId: params.id }
    })

    // 8. Теперь можем удалить сам проект
    await prisma.project.delete({
      where: {
        id: params.id
      }
    })

    return NextResponse.json({ message: 'Project deleted successfully' })
  } catch (error) {
    console.error('Error deleting project:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

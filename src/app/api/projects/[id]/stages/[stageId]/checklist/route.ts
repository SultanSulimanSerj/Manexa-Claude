import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-api'
import { hasPermission, UserRole } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { generateId } from '@/lib/id-generator'

// Заказчик (view-only) не может изменять чек-лист/этапы
function blockClientWrite(role: string) {
  return !hasPermission(role as UserRole, 'canViewAllTasks')
}

// GET - получить чек-лист этапа
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; stageId: string } }
) {
  try {
    const user = await authenticateUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!user.companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { stageId } = params

    const stage = await prisma.workStage.findFirst({
      where: {
        id: stageId,
        project: {
          companyId: user.companyId
        }
      }
    })

    if (!stage) {
      return NextResponse.json({ error: 'Этап не найден' }, { status: 404 })
    }

    // Получаем пункты чек-листа
    const checklist = await prisma.checklistItem.findMany({
      where: { stageId },
      include: {
        completedBy: {
          select: { id: true, name: true }
        }
      },
      orderBy: { orderIndex: 'asc' }
    })

    return NextResponse.json(checklist)
  } catch (error) {
    console.error('Error fetching checklist:', error)
    return NextResponse.json({ error: 'Ошибка получения чек-листа' }, { status: 500 })
  }
}

// POST - добавить пункт в чек-лист
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; stageId: string } }
) {
  try {
    const user = await authenticateUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!user.companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (blockClientWrite(user.role)) {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
    }

    const { stageId } = params
    const body = await request.json()
    const { title } = body

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Название пункта обязательно' }, { status: 400 })
    }

    // Проверяем доступ к этапу
    const stage = await prisma.workStage.findFirst({
      where: {
        id: stageId,
        project: {
          companyId: user.companyId
        }
      }
    })

    if (!stage) {
      return NextResponse.json({ error: 'Этап не найден' }, { status: 404 })
    }

    // Получаем максимальный orderIndex
    const maxOrder = await prisma.checklistItem.aggregate({
      where: { stageId },
      _max: { orderIndex: true }
    })

    const newOrderIndex = (maxOrder._max.orderIndex ?? -1) + 1

    // Создаём пункт
    const item = await prisma.checklistItem.create({
      data: {
        id: generateId(),
        title: title.trim(),
        orderIndex: newOrderIndex,
        stageId
      },
      include: {
        completedBy: {
          select: { id: true, name: true }
        }
      }
    })

    // Пересчитываем прогресс этапа
    await updateStageProgress(stageId)

    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    console.error('Error creating checklist item:', error)
    return NextResponse.json({ error: 'Ошибка создания пункта' }, { status: 500 })
  }
}

// PATCH - обновить пункт (отметить выполненным / изменить название)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; stageId: string } }
) {
  try {
    const user = await authenticateUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!user.companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (blockClientWrite(user.role)) {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
    }

    const { stageId } = params
    const body = await request.json()
    const { itemId, title, isCompleted } = body

    if (!itemId) {
      return NextResponse.json({ error: 'ID пункта обязателен' }, { status: 400 })
    }

    // Проверяем доступ
    const item = await prisma.checklistItem.findFirst({
      where: {
        id: itemId,
        stageId,
        stage: {
          project: {
            companyId: user.companyId
          }
        }
      }
    })

    if (!item) {
      return NextResponse.json({ error: 'Пункт не найден' }, { status: 404 })
    }

    // Формируем данные для обновления
    const updateData: any = {}
    
    if (title !== undefined) {
      updateData.title = title.trim()
    }
    
    if (isCompleted !== undefined) {
      updateData.isCompleted = isCompleted
      if (isCompleted) {
        updateData.completedAt = new Date()
        updateData.completedById = user.id
      } else {
        updateData.completedAt = null
        updateData.completedById = null
      }
    }

    // Обновляем пункт
    const updated = await prisma.checklistItem.update({
      where: { id: itemId },
      data: updateData,
      include: {
        completedBy: {
          select: { id: true, name: true }
        }
      }
    })

    // Пересчитываем прогресс этапа
    await updateStageProgress(stageId)

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating checklist item:', error)
    return NextResponse.json({ error: 'Ошибка обновления пункта' }, { status: 500 })
  }
}

// DELETE - удалить пункт
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; stageId: string } }
) {
  try {
    const user = await authenticateUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!user.companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (blockClientWrite(user.role)) {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
    }

    const { stageId } = params
    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('itemId')

    if (!itemId) {
      return NextResponse.json({ error: 'ID пункта обязателен' }, { status: 400 })
    }

    // Проверяем доступ
    const item = await prisma.checklistItem.findFirst({
      where: {
        id: itemId,
        stageId,
        stage: {
          project: {
            companyId: user.companyId
          }
        }
      }
    })

    if (!item) {
      return NextResponse.json({ error: 'Пункт не найден' }, { status: 404 })
    }

    // Удаляем пункт
    await prisma.checklistItem.delete({
      where: { id: itemId }
    })

    // Пересчитываем прогресс этапа
    await updateStageProgress(stageId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting checklist item:', error)
    return NextResponse.json({ error: 'Ошибка удаления пункта' }, { status: 500 })
  }
}

// Функция пересчёта прогресса этапа
async function updateStageProgress(stageId: string) {
  const items = await prisma.checklistItem.findMany({
    where: { stageId }
  })

  if (items.length === 0) {
    return
  }

  const completedCount = items.filter(item => item.isCompleted).length
  const progress = Math.round((completedCount / items.length) * 100)

  // Определяем статус
  let status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' = 'NOT_STARTED'
  if (progress === 100) {
    status = 'COMPLETED'
  } else if (progress > 0) {
    status = 'IN_PROGRESS'
  }

  await prisma.workStage.update({
    where: { id: stageId },
    data: {
      progress,
      status,
      ...(progress === 100 && { actualEnd: new Date() }),
      ...(progress > 0 && progress < 100 && { actualStart: new Date() })
    }
  })
}

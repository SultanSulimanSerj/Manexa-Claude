import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-api'
import { verifyTaskCompanyAccess } from '@/lib/access-control'
import { prisma } from '@/lib/prisma'
import { generateId } from '@/lib/id-generator'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasAccess = await verifyTaskCompanyAccess(user, params.id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const task = await prisma.task.findUnique({
      where: { id: params.id },
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

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Загружаем подзадачи отдельно, чтобы не ломать запрос, если таблица еще не создана
    let subtasks: Awaited<ReturnType<typeof prisma.taskSubtask.findMany>> = []
    try {
      subtasks = await prisma.taskSubtask.findMany({
        where: { taskId: params.id },
        orderBy: { orderIndex: 'asc' }
      })
    } catch (subtaskError) {
      console.error('Error fetching subtasks (non-critical):', subtaskError)
      // Игнорируем ошибку подзадач, продолжаем работу
    }

    return NextResponse.json({ ...task, subtasks })
  } catch (error) {
    console.error('Error fetching task:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasAccess = await verifyTaskCompanyAccess(user, params.id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const body = await request.json()
    const { title, description, status, priority, dueDate, projectId, assigneeIds } = body

    // If assigneeIds provided, update assignments
    if (assigneeIds) {
      // Delete existing assignments
      await prisma.taskAssignment.deleteMany({
        where: { taskId: params.id }
      })
      
      // Create new assignments
      if (assigneeIds.length > 0) {
        await prisma.taskAssignment.createMany({
          data: assigneeIds.map((userId: string) => ({
            id: generateId(),
            taskId: params.id,
            userId
          }))
        })
      }
    }

    const task = await prisma.task.update({
      where: { id: params.id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description: description || null }),
        ...(status && { status }),
        ...(priority && { priority }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(projectId !== undefined && { projectId: projectId || null }),
        ...(status === 'COMPLETED' && { completedAt: new Date() }),
        updatedAt: new Date()
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

    return NextResponse.json(task)
  } catch (error) {
    console.error('Error updating task:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasAccess = await verifyTaskCompanyAccess(user, params.id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Сначала удаляем все назначения задачи
    await prisma.taskAssignment.deleteMany({
      where: { taskId: params.id }
    })

    // Затем удаляем саму задачу
    await prisma.task.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting task:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

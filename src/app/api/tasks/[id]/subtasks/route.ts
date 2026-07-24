import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-api'
import { verifyTaskCompanyAccess, userCanEditTask } from '@/lib/access-control'
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

    const subtasks = await prisma.taskSubtask.findMany({
      where: { taskId: params.id },
      orderBy: { orderIndex: 'asc' }
    })

    return NextResponse.json({ subtasks })
  } catch (error) {
    console.error('Error fetching subtasks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title } = body

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const hasAccess = await verifyTaskCompanyAccess(user, params.id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    if (!(await userCanEditTask(user, params.id))) {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
    }

    const task = await prisma.task.findUnique({
      where: { id: params.id },
      select: { id: true, companyId: true },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Получаем максимальный orderIndex для этой задачи
    const maxOrder = await prisma.taskSubtask.findFirst({
      where: { taskId: params.id },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true }
    })

    const subtask = await prisma.taskSubtask.create({
      data: {
        id: generateId(),
        title: title.trim(),
        taskId: params.id,
        companyId: task.companyId || user.companyId || null,
        orderIndex: (maxOrder?.orderIndex ?? -1) + 1
      }
    })

    return NextResponse.json({ subtask }, { status: 201 })
  } catch (error) {
    console.error('Error creating subtask:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

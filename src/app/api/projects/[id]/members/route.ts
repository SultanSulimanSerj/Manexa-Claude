import { NextRequest, NextResponse } from 'next/server'
import { checkPermission, canUserAccessProject } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/lib/permissions'
import { generateId } from '@/lib/id-generator'

// Получить участников проекта
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canViewAllProjects')
    
    if (!allowed || !user) {
      return NextResponse.json({ error: error || 'Недостаточно прав' }, { status: 403 })
    }

    // Внешние/Сотрудник видят участников только своих проектов
    if (!user.companyId || !(await canUserAccessProject(user.id, params.id, user.companyId, user.role as UserRole))) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const project = await prisma.project.findFirst({
      where: {
        id: params.id,
        companyId: user.companyId
      },
      include: {
        users: {
          include: {
            user: {
              select: { id: true, name: true, email: true, position: true }
            }
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json(project.users)
  } catch (error) {
    console.error('Error fetching project members:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Добавить участника к проекту
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canManageProjectMembers')
    
    if (!allowed || !user) {
      return NextResponse.json({ error: error || 'Недостаточно прав' }, { status: 403 })
    }

    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Проверяем, что проект существует и принадлежит компании пользователя
    const project = await prisma.project.findFirst({
      where: {
        id: params.id,
        companyId: user.companyId
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Проверяем, что пользователь существует и принадлежит той же компании
    const targetUser = await prisma.user.findFirst({
      where: {
        id: userId,
        companyId: user.companyId
      }
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found or not in your company' }, { status: 404 })
    }

    // Проверяем, что пользователь еще не является участником проекта
    const existingMember = await prisma.projectUser.findFirst({
      where: {
        projectId: params.id,
        userId: userId
      }
    })

    if (existingMember) {
      return NextResponse.json({ error: 'User is already a member of this project' }, { status: 400 })
    }

    // Добавляем участника
    const projectUser = await prisma.projectUser.create({
      data: {
        id: generateId(),
        projectId: params.id,
        userId: userId
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, position: true }
        }
      }
    })

    return NextResponse.json(projectUser)
  } catch (error) {
    console.error('Error adding project member:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Удалить участника из проекта
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canManageProjectMembers')
    
    if (!allowed || !user) {
      return NextResponse.json({ error: error || 'Недостаточно прав' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Проверяем, что проект существует и принадлежит компании пользователя
    const project = await prisma.project.findFirst({
      where: {
        id: params.id,
        companyId: user.companyId
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Удаляем участника
    await prisma.projectUser.deleteMany({
      where: {
        projectId: params.id,
        userId: userId
      }
    })

    return NextResponse.json({ message: 'Member removed successfully' })
  } catch (error) {
    console.error('Error removing project member:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

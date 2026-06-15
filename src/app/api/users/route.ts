import { NextRequest, NextResponse } from 'next/server'
import { checkPermission, filterDataByPermissions } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/lib/permissions'
import { checkPlanLimit, PLAN_LIMIT_MESSAGES } from '@/lib/subscription-guard'

export async function GET(request: NextRequest) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canManageUsers')
    
    if (!allowed || !user) {
      return NextResponse.json({ error: error || 'Недостаточно прав' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const rawPage = parseInt(searchParams.get('page') || '1')
    const rawLimit = parseInt(searchParams.get('limit') || '10')
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage
    const limit = isNaN(rawLimit) || rawLimit < 1 ? 10 : Math.min(rawLimit, 100)
    const role = searchParams.get('role')

    const where = {
      companyId: user.companyId,
      ...(role && { role: role as any })
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          position: true,
          createdAt: true,
          _count: {
            select: {
              createdProjects: true,
              createdTasks: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.user.count({ where })
    ])


    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canCreateUsers')
    
    if (!allowed || !user) {
      return NextResponse.json({ error: error || 'Недостаточно прав' }, { status: 403 })
    }

    const body = await request.json()
    const { name, email, password, role, position } = body

    // Проверяем права на создание пользователей с определенной ролью
    if (role === UserRole.OWNER && user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Недостаточно прав для создания владельца' }, { status: 403 })
    }

    // Лимит пользователей по тарифу
    const planLimit = await checkPlanLimit(user.companyId, 'users')
    if (!planLimit.allowed) {
      return NextResponse.json(
        { error: `${PLAN_LIMIT_MESSAGES.users} (${planLimit.current}/${planLimit.limit})` },
        { status: 403 }
      )
    }

    // Hash password
    const bcrypt = require('bcryptjs')
    const hashedPassword = await bcrypt.hash(password, 10)

    try {
      const newUser = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role,
          position,
          companyId: user.companyId
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          position: true,
          createdAt: true
        }
      })

      return NextResponse.json(newUser, { status: 201 })
    } catch (error: any) {
      if (error.code === 'P2002') {
        return NextResponse.json({ error: 'Email уже используется' }, { status: 400 })
      }
      throw error
    }
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
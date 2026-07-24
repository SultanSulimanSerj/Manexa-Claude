import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { checkPermission } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'
import { UserRole, ProjectRole } from '@/lib/permissions'
import { generateId } from '@/lib/id-generator'
import { generateTempPassword } from '@/lib/temp-password'
import { checkPlanLimit, PLAN_LIMIT_MESSAGES } from '@/lib/subscription-guard'

const INVITABLE: string[] = [UserRole.CONTRACTOR, UserRole.CLIENT]

/**
 * Пригласить нового внешнего участника (Подрядчик/Заказчик):
 * создаёт учётную запись + сразу привязывает к проекту.
 * Доступно тем, кто управляет участниками проекта (Владелец/Админ/РП).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canManageProjectMembers')
    if (!allowed || !user || !user.companyId) {
      return NextResponse.json({ error: error || 'Недостаточно прав' }, { status: 403 })
    }

    const body = await request.json()
    const name = (body.name || '').trim()
    const email = (body.email || '').trim().toLowerCase()
    const role = body.role as string

    if (!name || !email) {
      return NextResponse.json({ error: 'Укажите имя и email' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Некорректный email' }, { status: 400 })
    }
    if (!INVITABLE.includes(role)) {
      return NextResponse.json({ error: 'Можно пригласить только подрядчика или заказчика' }, { status: 400 })
    }

    // Проект должен принадлежать компании
    const project = await prisma.project.findFirst({
      where: { id: params.id, companyId: user.companyId },
      select: { id: true },
    })
    if (!project) {
      return NextResponse.json({ error: 'Проект не найден' }, { status: 404 })
    }

    // Email не занят
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (existing) {
      return NextResponse.json({ error: 'Пользователь с таким email уже существует' }, { status: 400 })
    }

    // Лимит пользователей по тарифу
    const planLimit = await checkPlanLimit(user.companyId, 'users')
    if (!planLimit.allowed) {
      return NextResponse.json(
        { error: `${PLAN_LIMIT_MESSAGES.users} (${planLimit.current}/${planLimit.limit})` },
        { status: 403 }
      )
    }

    const tempPassword = generateTempPassword()
    const hashed = await bcrypt.hash(tempPassword, 10)

    // Создаём пользователя + привязываем к проекту одной транзакцией.
    // Заказчик — VIEWER (просмотр), Подрядчик — MEMBER (участник).
    const projectRole = role === UserRole.CLIENT ? ProjectRole.VIEWER : ProjectRole.MEMBER

    const created = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name,
          email,
          password: hashed,
          role: role as UserRole,
          companyId: user.companyId,
          mustChangePassword: true,
        },
        select: { id: true, name: true, email: true, role: true },
      })

      await tx.projectUser.create({
        data: {
          id: generateId(),
          projectId: params.id,
          userId: newUser.id,
          role: projectRole,
          companyId: user.companyId,
        },
      })

      return newUser
    })

    return NextResponse.json({ user: created, tempPassword }, { status: 201 })
  } catch (error) {
    console.error('Error inviting external member:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

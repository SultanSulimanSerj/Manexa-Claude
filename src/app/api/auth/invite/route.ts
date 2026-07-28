import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { generateId } from '@/lib/id-generator'
import { isDebugRouteAllowed } from '@/lib/prod-guard'
import { UserRole } from '@/lib/permissions'
import { sendInviteEmail } from '@/lib/mail'

const OWNER_INVITE_ROLES = [UserRole.ADMIN, UserRole.MANAGER, UserRole.USER] as const
const ADMIN_INVITE_ROLES = [UserRole.MANAGER, UserRole.USER] as const

export async function POST(request: NextRequest) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canCreateUsers')
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!allowed) {
      return NextResponse.json({ error: error || 'Недостаточно прав' }, { status: 403 })
    }

    const body = await request.json()
    const { email: emailRaw, name, role, position } = body
    // Email нормализуем к нижнему регистру — вход нечувствителен к регистру
    const email = String(emailRaw || '').trim().toLowerCase()

    if (!email || !name || !role) {
      return NextResponse.json({ error: 'Email, имя и роль обязательны' }, { status: 400 })
    }

    const allowedRoles =
      user.role === UserRole.OWNER ? OWNER_INVITE_ROLES : ADMIN_INVITE_ROLES

    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ error: 'Недопустимая роль для приглашения' }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json({ error: 'Пользователь с таким email уже существует' }, { status: 400 })
    }

    const tempPassword = Math.random().toString(36).slice(-8)
    const hashedPassword = await bcrypt.hash(tempPassword, 10)

    const newUser = await prisma.user.create({
      data: {
        id: generateId(),
        name,
        email,
        password: hashedPassword,
        role,
        position: position || 'Сотрудник',
        companyId: user.companyId!,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        position: true,
        createdAt: true,
      },
    })

    const emailSent = await sendInviteEmail({
      to: email,
      name,
      tempPassword,
      invitedBy: user.email || 'Администратор',
    })

    if (process.env.NODE_ENV === 'production' && !emailSent) {
      await prisma.user.delete({ where: { id: newUser.id } })
      return NextResponse.json(
        {
          error:
            'Не удалось отправить email с паролем. Настройте SMTP (EMAIL_SERVER_* в .env) и повторите приглашение.',
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      {
        message: emailSent
          ? 'Пользователь приглашён, письмо отправлено на email'
          : 'Пользователь приглашён',
        user: newUser,
        emailSent,
        ...(isDebugRouteAllowed() && !emailSent ? { tempPassword } : {}),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Invite error:', error)
    return NextResponse.json({ error: 'Ошибка приглашения пользователя' }, { status: 500 })
  }
}

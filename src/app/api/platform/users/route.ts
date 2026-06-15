import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { checkPlatformPermission, logPlatformAction } from '@/lib/platform-auth'
import { generateTempPassword } from '@/lib/temp-password'

export const dynamic = 'force-dynamic'

/**
 * GET ?search= — сквозной поиск пользователей по email/имени (поддержка).
 * GET ?managers=1 — список платформенных пользователей.
 */
export async function GET(request: NextRequest) {
  const { allowed, user, error } = await checkPlatformPermission(request, 'canManagePlatform')
  if (!allowed || !user) {
    return NextResponse.json({ error: error || 'Не найдено' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.trim()
  const managersOnly = searchParams.get('managers') === '1'

  if (managersOnly) {
    const managers = await prisma.user.findMany({
      where: { role: { in: ['PLATFORM_ADMIN', 'PLATFORM_MANAGER'] } },
      select: {
        id: true, name: true, email: true, role: true,
        isActive: true, totpEnabled: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json({ users: managers })
  }

  if (!search || search.length < 3) {
    return NextResponse.json({ users: [], hint: 'Введите минимум 3 символа email или имени' })
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      company: { select: { id: true, name: true, isActive: true } },
    },
    take: 20,
  })

  return NextResponse.json({ users })
}

/** Создание платформенного менеджера (только PLATFORM_ADMIN). */
export async function POST(request: NextRequest) {
  const { allowed, user, error } = await checkPlatformPermission(request, 'canManagePlatformManagers')
  if (!allowed || !user) {
    return NextResponse.json({ error: error || 'Не найдено' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const { name, email, role } = body as { name?: string; email?: string; role?: string }

  if (!name || !email) {
    return NextResponse.json({ error: 'Требуются имя и email' }, { status: 400 })
  }
  const newRole = role === 'PLATFORM_ADMIN' ? 'PLATFORM_ADMIN' : 'PLATFORM_MANAGER'

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: `Пользователь ${email} уже существует` }, { status: 409 })
  }

  const tempPassword = generateTempPassword()
  const hashed = await bcrypt.hash(tempPassword, 10)

  const created = await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      role: newRole,
      companyId: null,
      mustChangePassword: true,
    },
  })

  await logPlatformAction({
    actorId: user.id,
    actorEmail: user.email,
    action: 'PLATFORM_MANAGER_CREATE',
    targetType: 'User',
    targetId: created.id,
    metadata: { email, role: newRole },
    request,
  })

  return NextResponse.json({
    user: { id: created.id, email: created.email, role: created.role },
    tempPassword,
  })
}

/** Управление платформенным пользователем: деактивация / сброс пароля (только PLATFORM_ADMIN). */
export async function PATCH(request: NextRequest) {
  const { allowed, user, error } = await checkPlatformPermission(request, 'canManagePlatformManagers')
  if (!allowed || !user) {
    return NextResponse.json({ error: error || 'Не найдено' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const { userId, action } = body as { userId?: string; action?: string }

  if (!userId || !action) {
    return NextResponse.json({ error: 'Требуются userId и action' }, { status: 400 })
  }
  if (userId === user.id && action === 'deactivate') {
    return NextResponse.json({ error: 'Нельзя деактивировать самого себя' }, { status: 400 })
  }

  const target = await prisma.user.findFirst({
    where: { id: userId, role: { in: ['PLATFORM_ADMIN', 'PLATFORM_MANAGER'] } },
  })
  if (!target) {
    return NextResponse.json({ error: 'Платформенный пользователь не найден' }, { status: 404 })
  }

  if (action === 'deactivate' || action === 'activate') {
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: action === 'activate' },
    })
    await logPlatformAction({
      actorId: user.id,
      actorEmail: user.email,
      action: action === 'activate' ? 'PLATFORM_MANAGER_ACTIVATE' : 'PLATFORM_MANAGER_DEACTIVATE',
      targetType: 'User',
      targetId: userId,
      metadata: { email: target.email },
      request,
    })
    return NextResponse.json({ success: true })
  }

  if (action === 'reset-password') {
    const tempPassword = generateTempPassword()
    const hashed = await bcrypt.hash(tempPassword, 10)
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed, mustChangePassword: true, totpEnabled: false, totpSecret: null },
    })
    await logPlatformAction({
      actorId: user.id,
      actorEmail: user.email,
      action: 'PLATFORM_MANAGER_PASSWORD_RESET',
      targetType: 'User',
      targetId: userId,
      metadata: { email: target.email },
      request,
    })
    return NextResponse.json({ success: true, tempPassword })
  }

  return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 })
}

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { authenticateUser } from '@/lib/auth-api'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

/** Смена пароля текущим пользователем (в т.ч. обязательная при первом входе). */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Не аутентифицирован' }, { status: 401 })
  }

  const rateLimit = await checkRateLimit(`change-password:${user.id}`, 5, 15 * 60 * 1000)
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Слишком много попыток. Попробуйте позже.' }, { status: 429 })
  }

  const body = await request.json().catch(() => ({}))
  const { currentPassword, newPassword } = body as { currentPassword?: string; newPassword?: string }

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Укажите текущий и новый пароль' }, { status: 400 })
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Новый пароль должен содержать минимум 8 символов' }, { status: 400 })
  }
  if (!/[a-zA-Zа-яА-Я]/.test(newPassword) || !/\d/.test(newPassword)) {
    return NextResponse.json({ error: 'Пароль должен содержать буквы и цифры' }, { status: 400 })
  }
  if (newPassword === currentPassword) {
    return NextResponse.json({ error: 'Новый пароль должен отличаться от текущего' }, { status: 400 })
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { password: true },
  })
  if (!dbUser?.password) {
    return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
  }

  const valid = await bcrypt.compare(currentPassword, dbUser.password)
  if (!valid) {
    return NextResponse.json({ error: 'Неверный текущий пароль' }, { status: 400 })
  }

  const hashed = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed, mustChangePassword: false },
  })

  return NextResponse.json({ success: true })
}

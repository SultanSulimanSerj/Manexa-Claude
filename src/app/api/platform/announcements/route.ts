import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPlatformPermission, logPlatformAction } from '@/lib/platform-auth'

export const dynamic = 'force-dynamic'

const LEVELS = ['INFO', 'WARNING', 'CRITICAL']

/** Список анонсов. */
export async function GET(request: NextRequest) {
  const { allowed, user, error } = await checkPlatformPermission(request, 'canManagePlatform')
  if (!allowed || !user) {
    return NextResponse.json({ error: error || 'Не найдено' }, { status: 404 })
  }

  const announcements = await prisma.announcement.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { dismissals: true } } },
  })
  return NextResponse.json({ announcements })
}

/** Создать анонс (рассылка всем компаниям — только PLATFORM_ADMIN). */
export async function POST(request: NextRequest) {
  const { allowed, user, error } = await checkPlatformPermission(request, 'canManagePlatformManagers')
  if (!allowed || !user) {
    return NextResponse.json({ error: error || 'Не найдено' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const title = (body.title as string)?.trim()
  const text = (body.body as string)?.trim()
  const level = LEVELS.includes(body.level) ? body.level : 'INFO'

  if (!title || !text) {
    return NextResponse.json({ error: 'Требуются заголовок и текст' }, { status: 400 })
  }

  const announcement = await prisma.announcement.create({
    data: {
      title,
      body: text,
      level,
      isActive: body.isActive ?? true,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
      createdById: user.id,
      createdByEmail: user.email,
    },
  })

  await logPlatformAction({
    actorId: user.id,
    actorEmail: user.email,
    action: 'ANNOUNCEMENT_CREATE',
    targetType: 'Announcement',
    targetId: announcement.id,
    metadata: { title, level },
    request,
  })

  return NextResponse.json({ announcement })
}

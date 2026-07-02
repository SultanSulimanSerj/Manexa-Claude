import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPlatformPermission, logPlatformAction } from '@/lib/platform-auth'

export const dynamic = 'force-dynamic'

const LEVELS = ['INFO', 'WARNING', 'CRITICAL']

/** Изменить анонс (вкл/выкл, текст, даты). */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { allowed, user, error } = await checkPlatformPermission(request, 'canManagePlatformManagers')
  if (!allowed || !user) {
    return NextResponse.json({ error: error || 'Не найдено' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if (typeof body.title === 'string') data.title = body.title.trim()
  if (typeof body.body === 'string') data.body = body.body.trim()
  if (LEVELS.includes(body.level)) data.level = body.level
  if (typeof body.isActive === 'boolean') data.isActive = body.isActive
  if ('startsAt' in body) data.startsAt = body.startsAt ? new Date(body.startsAt) : null
  if ('endsAt' in body) data.endsAt = body.endsAt ? new Date(body.endsAt) : null

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Нет полей для обновления' }, { status: 400 })
  }

  const announcement = await prisma.announcement.update({ where: { id: params.id }, data })

  await logPlatformAction({
    actorId: user.id,
    actorEmail: user.email,
    action: 'ANNOUNCEMENT_UPDATE',
    targetType: 'Announcement',
    targetId: params.id,
    metadata: { fields: Object.keys(data) },
    request,
  })

  return NextResponse.json({ announcement })
}

/** Удалить анонс. */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const { allowed, user, error } = await checkPlatformPermission(request, 'canManagePlatformManagers')
  if (!allowed || !user) {
    return NextResponse.json({ error: error || 'Не найдено' }, { status: 404 })
  }

  await prisma.announcement.delete({ where: { id: params.id } })

  await logPlatformAction({
    actorId: user.id,
    actorEmail: user.email,
    action: 'ANNOUNCEMENT_DELETE',
    targetType: 'Announcement',
    targetId: params.id,
    request,
  })

  return NextResponse.json({ success: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-api'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/** Скрыть анонс для текущего пользователя. */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const id = body.id as string
  if (!id) {
    return NextResponse.json({ error: 'Требуется id' }, { status: 400 })
  }

  await prisma.announcementDismissal.upsert({
    where: { announcementId_userId: { announcementId: id, userId: user.id } },
    create: { announcementId: id, userId: user.id },
    update: {},
  })

  return NextResponse.json({ success: true })
}

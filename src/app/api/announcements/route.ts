import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-api'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/** Активные анонсы для текущего пользователя (не скрытые им). */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const announcements = await prisma.announcement.findMany({
    where: {
      isActive: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
      dismissals: { none: { userId: user.id } },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, body: true, level: true, createdAt: true },
    take: 5,
  })

  return NextResponse.json({ announcements })
}

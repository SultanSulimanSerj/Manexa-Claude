import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPlatformPermission } from '@/lib/platform-auth'

export const dynamic = 'force-dynamic'

/** Журнал действий платформенных пользователей. */
export async function GET(request: NextRequest) {
  const { allowed, user, error } = await checkPlatformPermission(request, 'canManagePlatform')
  if (!allowed || !user) {
    return NextResponse.json({ error: error || 'Не найдено' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
  const action = searchParams.get('action')
  const targetId = searchParams.get('targetId')

  const where: any = {
    ...(action && { action }),
    ...(targetId && { targetId }),
  }

  const [entries, total] = await Promise.all([
    prisma.platformAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.platformAuditLog.count({ where }),
  ])

  return NextResponse.json({
    entries,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  })
}

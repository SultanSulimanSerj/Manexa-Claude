import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPlatformPermission, logPlatformAction } from '@/lib/platform-auth'

export const dynamic = 'force-dynamic'

/** Справочник тарифов. */
export async function GET(request: NextRequest) {
  const { allowed, user, error } = await checkPlatformPermission(request, 'canManagePlatform')
  if (!allowed || !user) {
    return NextResponse.json({ error: error || 'Не найдено' }, { status: 404 })
  }

  const plans = await prisma.plan.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { subscriptions: true } } },
  })
  return NextResponse.json({ plans })
}

/** Создание/обновление тарифа (только PLATFORM_ADMIN). */
export async function POST(request: NextRequest) {
  const { allowed, user, error } = await checkPlatformPermission(request, 'canManagePlatformManagers')
  if (!allowed || !user) {
    return NextResponse.json({ error: error || 'Не найдено' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const { code, name, description, priceMonthly, maxUsers, maxProjects, maxStorageMb, isActive, sortOrder } = body

  if (!code || !name || priceMonthly === undefined) {
    return NextResponse.json({ error: 'Требуются code, name, priceMonthly' }, { status: 400 })
  }

  const plan = await prisma.plan.upsert({
    where: { code },
    update: {
      name,
      description: description ?? null,
      priceMonthly,
      maxUsers: maxUsers ?? null,
      maxProjects: maxProjects ?? null,
      maxStorageMb: maxStorageMb ?? null,
      ...(isActive !== undefined && { isActive }),
      ...(sortOrder !== undefined && { sortOrder }),
    },
    create: {
      code,
      name,
      description: description ?? null,
      priceMonthly,
      maxUsers: maxUsers ?? null,
      maxProjects: maxProjects ?? null,
      maxStorageMb: maxStorageMb ?? null,
      isActive: isActive ?? true,
      sortOrder: sortOrder ?? 0,
    },
  })

  await logPlatformAction({
    actorId: user.id,
    actorEmail: user.email,
    action: 'PLAN_UPSERT',
    targetType: 'Plan',
    targetId: plan.id,
    metadata: { code, priceMonthly },
    request,
  })

  return NextResponse.json({ plan })
}

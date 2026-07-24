import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-api'
import { hasPermission, UserRole } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

/** Считает остаток материала из движений: приход − расход + корректировки. */
function computeBalance(
  rows: { type: string; _sum: { quantity: unknown } }[]
): number {
  let balance = 0
  for (const r of rows) {
    const q = Number(r._sum.quantity ?? 0)
    if (r.type === 'RECEIPT') balance += q
    else if (r.type === 'ISSUE') balance -= q
    else balance += q // ADJUSTMENT — знаковая величина
  }
  return balance
}

export async function GET(request: NextRequest) {
  const user = await authenticateUser(request)
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!user.companyId) return NextResponse.json({ error: 'Нет компании' }, { status: 403 })
  // Материалы содержат цены — только роли с доступом к финансам
  if (!hasPermission(user.role as UserRole, 'canViewFinances')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.trim()

  const materials = await prisma.material.findMany({
    where: {
      companyId: user.companyId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { name: 'asc' },
  })

  // Остатки одним запросом по всем материалам компании
  const grouped = await prisma.stockMovement.groupBy({
    by: ['materialId', 'type'],
    where: { companyId: user.companyId },
    _sum: { quantity: true },
  })
  const byMaterial = new Map<string, { type: string; _sum: { quantity: unknown } }[]>()
  for (const g of grouped) {
    const arr = byMaterial.get(g.materialId) || []
    arr.push({ type: g.type, _sum: g._sum })
    byMaterial.set(g.materialId, arr)
  }

  const result = materials.map((m) => {
    const balance = computeBalance(byMaterial.get(m.id) || [])
    return {
      ...m,
      minStock: m.minStock != null ? Number(m.minStock) : null,
      price: m.price != null ? Number(m.price) : null,
      balance,
      lowStock: m.minStock != null && balance < Number(m.minStock),
    }
  })

  return NextResponse.json({ materials: result })
}

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request)
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!user.companyId) return NextResponse.json({ error: 'Нет компании' }, { status: 403 })
  if (!hasPermission(user.role as UserRole, 'canCreateFinances')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const name = (body.name || '').trim()
  if (!name) return NextResponse.json({ error: 'Укажите наименование' }, { status: 400 })

  const material = await prisma.material.create({
    data: {
      name,
      unit: (body.unit || 'шт').trim() || 'шт',
      sku: body.sku?.trim() || null,
      category: body.category?.trim() || null,
      minStock: body.minStock != null && body.minStock !== '' ? Number(body.minStock) : null,
      price: body.price != null && body.price !== '' ? Number(body.price) : null,
      companyId: user.companyId,
      creatorId: user.id,
    },
  })

  return NextResponse.json({ material }, { status: 201 })
}

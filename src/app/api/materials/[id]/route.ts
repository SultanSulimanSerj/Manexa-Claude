import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-api'
import { prisma } from '@/lib/prisma'

async function getOwnedMaterial(id: string, companyId: string) {
  const material = await prisma.material.findFirst({ where: { id, companyId } })
  return material
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await authenticateUser(request)
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!user.companyId) return NextResponse.json({ error: 'Нет компании' }, { status: 403 })

  const material = await getOwnedMaterial(params.id, user.companyId)
  if (!material) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  const movements = await prisma.stockMovement.findMany({
    where: { materialId: material.id },
    orderBy: { date: 'desc' },
    include: {
      project: { select: { id: true, name: true } },
      creator: { select: { name: true } },
    },
  })

  let balance = 0
  for (const m of movements) {
    const q = Number(m.quantity)
    if (m.type === 'RECEIPT') balance += q
    else if (m.type === 'ISSUE') balance -= q
    else balance += q
  }

  return NextResponse.json({
    material: {
      ...material,
      minStock: material.minStock != null ? Number(material.minStock) : null,
      price: material.price != null ? Number(material.price) : null,
      balance,
    },
    movements: movements.map((m) => ({
      ...m,
      quantity: Number(m.quantity),
      price: m.price != null ? Number(m.price) : null,
    })),
  })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await authenticateUser(request)
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!user.companyId) return NextResponse.json({ error: 'Нет компании' }, { status: 403 })

  const material = await getOwnedMaterial(params.id, user.companyId)
  if (!material) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const updated = await prisma.material.update({
    where: { id: material.id },
    data: {
      name: body.name?.trim() || material.name,
      unit: body.unit?.trim() || material.unit,
      sku: body.sku !== undefined ? body.sku?.trim() || null : material.sku,
      category: body.category !== undefined ? body.category?.trim() || null : material.category,
      minStock:
        body.minStock !== undefined
          ? body.minStock === '' || body.minStock == null
            ? null
            : Number(body.minStock)
          : material.minStock,
      price:
        body.price !== undefined
          ? body.price === '' || body.price == null
            ? null
            : Number(body.price)
          : material.price,
    },
  })

  return NextResponse.json({ material: updated })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await authenticateUser(request)
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!user.companyId) return NextResponse.json({ error: 'Нет компании' }, { status: 403 })

  const material = await getOwnedMaterial(params.id, user.companyId)
  if (!material) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  await prisma.material.delete({ where: { id: material.id } })
  return NextResponse.json({ ok: true })
}

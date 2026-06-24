import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-api'
import { prisma } from '@/lib/prisma'

const TYPES = ['RECEIPT', 'ISSUE', 'ADJUSTMENT'] as const

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await authenticateUser(request)
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!user.companyId) return NextResponse.json({ error: 'Нет компании' }, { status: 403 })

  const material = await prisma.material.findFirst({
    where: { id: params.id, companyId: user.companyId },
  })
  if (!material) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const type = body.type as (typeof TYPES)[number]
  if (!TYPES.includes(type)) {
    return NextResponse.json({ error: 'Неверный тип движения' }, { status: 400 })
  }
  const quantity = Number(body.quantity)
  if (!Number.isFinite(quantity) || quantity === 0) {
    return NextResponse.json({ error: 'Укажите количество' }, { status: 400 })
  }

  // Привязка к проекту (необязательно), проверяем что проект той же компании
  let projectId: string | null = null
  if (body.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: body.projectId, companyId: user.companyId },
      select: { id: true },
    })
    if (!project) return NextResponse.json({ error: 'Проект не найден' }, { status: 400 })
    projectId = project.id
  }

  const movement = await prisma.stockMovement.create({
    data: {
      type,
      quantity,
      price: body.price != null && body.price !== '' ? Number(body.price) : null,
      note: body.note?.trim() || null,
      date: body.date ? new Date(body.date) : new Date(),
      materialId: material.id,
      companyId: user.companyId,
      projectId,
      creatorId: user.id,
    },
  })

  // Обновляем ориентировочную цену материала по последнему приходу
  if (type === 'RECEIPT' && movement.price != null) {
    await prisma.material.update({
      where: { id: material.id },
      data: { price: movement.price },
    })
  }

  return NextResponse.json({ movement }, { status: 201 })
}

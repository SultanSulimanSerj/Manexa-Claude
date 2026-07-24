import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-api'
import { hasPermission, UserRole } from '@/lib/permissions'
import { blockIfImpersonated } from '@/lib/impersonation-guard'
import { prisma } from '@/lib/prisma'

// POST — создать запись дохода в реестре оплат на основе документа-Счёта.
// Идемпотентно: если запись по этому документу уже есть — вернёт её.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await authenticateUser(request)
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!user.companyId) return NextResponse.json({ error: 'Нет компании' }, { status: 403 })
  // Создание финзаписи — финансовое право + запрет под impersonation
  if (!hasPermission(user.role as UserRole, 'canCreateFinances')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }
  const blocked = await blockIfImpersonated(request)
  if (blocked) return blocked

  const doc = await prisma.document.findFirst({
    where: { id: params.id, companyId: user.companyId },
    select: {
      id: true,
      title: true,
      documentNumber: true,
      category: true,
      contentJson: true,
      projectId: true,
    },
  })
  if (!doc) return NextResponse.json({ error: 'Документ не найден' }, { status: 404 })
  if (!doc.projectId) {
    return NextResponse.json({ error: 'Документ не привязан к проекту' }, { status: 400 })
  }
  if (doc.category !== 'INVOICE') {
    return NextResponse.json({ error: 'В реестр можно внести только Счёт' }, { status: 400 })
  }

  // Уже внесён?
  const existing = await prisma.finance.findFirst({
    where: { documentId: doc.id },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json({ already: true, financeId: existing.id })
  }

  // Достаём сумму и контрагента из содержимого Счёта
  const content = (doc.contentJson as any)?.data ?? {}
  const amount = Number(content?.totals?.totalWithVat ?? 0)
  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'Не удалось определить сумму счёта' }, { status: 400 })
  }
  const counterparty: string | null = content?.buyer?.name?.trim?.() || null
  const number: string = content?.documentNumber || doc.documentNumber || doc.title
  const docDate = content?.documentDate ? new Date(content.documentDate) : new Date()
  const date = isNaN(docDate.getTime()) ? new Date() : docDate

  const finance = await prisma.finance.create({
    data: {
      type: 'INCOME',
      category: 'Оплата по счёту',
      description: `Счёт ${number}`,
      amount,
      date,
      invoiceNumber: number,
      counterparty,
      projectId: doc.projectId,
      companyId: user.companyId,
      creatorId: user.id,
      documentId: doc.id,
    },
  })

  return NextResponse.json({ ok: true, financeId: finance.id })
}

// GET — есть ли уже запись в реестре по этому документу.
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await authenticateUser(request)
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!user.companyId) return NextResponse.json({ error: 'Нет компании' }, { status: 403 })
  if (!hasPermission(user.role as UserRole, 'canViewFinances')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const existing = await prisma.finance.findFirst({
    where: { documentId: params.id, companyId: user.companyId },
    select: { id: true },
  })
  return NextResponse.json({ inRegistry: !!existing, financeId: existing?.id ?? null })
}

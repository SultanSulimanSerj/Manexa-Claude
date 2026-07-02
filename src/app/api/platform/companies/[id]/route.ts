import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPlatformPermission, logPlatformAction } from '@/lib/platform-auth'
import { invalidateCompanyAccessCache } from '@/lib/subscription-guard'

export const dynamic = 'force-dynamic'

/** Карточка компании: реквизиты, подписка, использование. */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { allowed, user, error } = await checkPlatformPermission(request, 'canManagePlatform')
  if (!allowed || !user) {
    return NextResponse.json({ error: error || 'Не найдено' }, { status: 404 })
  }

  const company = await prisma.company.findUnique({
    where: { id: params.id },
    include: {
      assignedManager: { select: { id: true, name: true, email: true } },
      notes: { orderBy: { createdAt: 'desc' }, take: 100 },
      subscription: {
        include: {
          plan: true,
          payments: { orderBy: { paidAt: 'desc' }, take: 20 },
        },
      },
      users: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          position: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true,
        },
        orderBy: { createdAt: 'asc' },
      },
      _count: {
        select: {
          projects: true,
          documents: true,
          tasks: true,
          estimates: true,
          finances: true,
        },
      },
    },
  })

  if (!company) {
    return NextResponse.json({ error: 'Компания не найдена' }, { status: 404 })
  }

  // Использование хранилища: документы + версии + фото этапов + вложения согласований
  const [docs, versions, photos, approvalFiles] = await prisma.$transaction([
    prisma.document.aggregate({
      where: { companyId: params.id },
      _sum: { fileSize: true, pdfFileSize: true, edoXmlFileSize: true },
    }),
    prisma.documentVersion.aggregate({
      where: { companyId: params.id },
      _sum: { fileSize: true, pdfFileSize: true },
    }),
    prisma.stagePhoto.aggregate({
      where: { stage: { project: { companyId: params.id } } },
      _sum: { size: true },
    }),
    prisma.approvalAttachment.aggregate({
      where: { approval: { companyId: params.id } },
      _sum: { fileSize: true },
    }),
  ])
  const storageBytes =
    Number(docs._sum.fileSize || 0) +
    Number(docs._sum.pdfFileSize || 0) +
    Number(docs._sum.edoXmlFileSize || 0) +
    Number(versions._sum.fileSize || 0) +
    Number(versions._sum.pdfFileSize || 0) +
    Number(photos._sum.size || 0) +
    Number(approvalFiles._sum.fileSize || 0)

  // Последний вход по компании = максимум среди пользователей
  const lastLoginAt = company.users.reduce<Date | null>((max, u) => {
    if (!u.lastLoginAt) return max
    return !max || u.lastLoginAt > max ? u.lastLoginAt : max
  }, null)

  const maxStorageMb = company.subscription?.plan?.maxStorageMb ?? null

  return NextResponse.json({
    company,
    usage: {
      storageBytes,
      storageMb: Math.round((storageBytes / (1024 * 1024)) * 10) / 10,
      maxStorageMb,
      lastLoginAt,
    },
  })
}

/** Обновление реквизитов компании. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { allowed, user, error } = await checkPlatformPermission(request, 'canManagePlatform')
  if (!allowed || !user) {
    return NextResponse.json({ error: error || 'Не найдено' }, { status: 404 })
  }

  const body = await request.json()
  const ALLOWED_FIELDS = [
    'name', 'legalName', 'description', 'inn', 'kpp', 'ogrn',
    'legalAddress', 'actualAddress', 'city', 'directorName', 'directorPosition',
    'contactPhone', 'contactEmail', 'phone', 'website',
    'bankAccount', 'bankName', 'bankBik', 'correspondentAccount',
    'assignedManagerId', 'tags',
  ] as const

  const data: Record<string, unknown> = {}
  for (const field of ALLOWED_FIELDS) {
    if (!(field in body)) continue
    const value = body[field]
    // Строковые поля: пустая строка → null (не храним пустышки)
    if (typeof value === 'string' && field !== 'name') {
      const trimmed = value.trim()
      data[field] = trimmed === '' ? null : trimmed
    } else {
      data[field] = value
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Нет полей для обновления' }, { status: 400 })
  }

  const company = await prisma.company.update({ where: { id: params.id }, data })

  await logPlatformAction({
    actorId: user.id,
    actorEmail: user.email,
    action: 'COMPANY_UPDATE',
    targetType: 'Company',
    targetId: params.id,
    metadata: { fields: Object.keys(data) },
    request,
  })

  return NextResponse.json({ company: { id: company.id, name: company.name } })
}

/** Архивирование / разархивирование компании (вход блокируется, данные сохраняются). */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { allowed, user, error } = await checkPlatformPermission(request, 'canManagePlatform')
  if (!allowed || !user) {
    return NextResponse.json({ error: error || 'Не найдено' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const action = body.action as string

  if (action !== 'archive' && action !== 'unarchive') {
    return NextResponse.json({ error: 'Неизвестное действие. Допустимо: archive, unarchive' }, { status: 400 })
  }

  const isActive = action === 'unarchive'
  const company = await prisma.company.update({
    where: { id: params.id },
    data: { isActive },
  })
  invalidateCompanyAccessCache(params.id)

  await logPlatformAction({
    actorId: user.id,
    actorEmail: user.email,
    action: isActive ? 'COMPANY_UNARCHIVE' : 'COMPANY_ARCHIVE',
    targetType: 'Company',
    targetId: params.id,
    metadata: { name: company.name },
    request,
  })

  return NextResponse.json({ success: true, isActive })
}

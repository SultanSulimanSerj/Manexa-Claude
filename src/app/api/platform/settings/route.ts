import { NextRequest, NextResponse } from 'next/server'
import { checkPlatformPermission, logPlatformAction } from '@/lib/platform-auth'
import { getPlatformSettings } from '@/lib/platform-settings'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Поля, которые можно обновлять через PUT (реквизиты продавца + биллинг)
const EDITABLE = [
  'sellerName', 'sellerLegalName', 'sellerInn', 'sellerKpp', 'sellerOgrn',
  'sellerLegalAddress', 'sellerDirectorName', 'sellerDirectorPosition',
  'sellerBankAccount', 'sellerBankName', 'sellerBankBik', 'sellerCorrespondentAccount',
  'sellerContactPhone', 'sellerContactEmail',
  'taxMode', 'vatRate', 'annualDiscountPercent', 'invoicePrefix',
] as const

// GET — читать могут обе платформенные роли
export async function GET(request: NextRequest) {
  const { allowed, user, error } = await checkPlatformPermission(request, 'canManagePlatform')
  if (!allowed || !user) {
    return NextResponse.json({ error: error || 'Не найдено' }, { status: 404 })
  }
  const settings = await getPlatformSettings()
  return NextResponse.json({ settings })
}

// PUT — менять реквизиты продавца может только PLATFORM_ADMIN
export async function PUT(request: NextRequest) {
  const { allowed, user, error } = await checkPlatformPermission(request, 'canManagePlatformManagers')
  if (!allowed || !user) {
    return NextResponse.json({ error: error || 'Недостаточно прав' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  for (const key of EDITABLE) {
    if (key in body) data[key] = body[key]
  }

  // Нормализация числовых полей
  if ('vatRate' in data) data.vatRate = Math.max(0, Math.min(100, Number(data.vatRate) || 0))
  if ('annualDiscountPercent' in data) {
    data.annualDiscountPercent = Math.max(0, Math.min(100, Number(data.annualDiscountPercent) || 0))
  }
  if ('taxMode' in data && data.taxMode !== 'OSN') data.taxMode = 'USN'

  await getPlatformSettings() // гарантируем существование строки
  const settings = await prisma.platformSettings.update({
    where: { id: 'platform' },
    data,
  })

  await logPlatformAction({
    actorId: user.id,
    actorEmail: user.email,
    action: 'PLATFORM_SETTINGS_UPDATE',
    targetType: 'PlatformSettings',
    targetId: 'platform',
    request,
  })

  return NextResponse.json({ settings })
}

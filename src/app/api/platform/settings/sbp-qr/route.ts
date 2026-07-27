import { NextRequest, NextResponse } from 'next/server'
import { checkPlatformPermission } from '@/lib/platform-auth'
import { getPlatformSettings } from '@/lib/platform-settings'
import { uploadFile, getFileStream } from '@/lib/storage'
import { buildFileHeaders, isUploadMimeBlocked } from '@/lib/safe-file-response'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET — отдать загруженный QR (обе платформенные роли)
export async function GET(request: NextRequest) {
  const { allowed } = await checkPlatformPermission(request, 'canManagePlatform')
  if (!allowed) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  const settings = await getPlatformSettings()
  if (!settings.sbpQrPath) {
    return NextResponse.json({ error: 'QR не загружен' }, { status: 404 })
  }
  const { stream, contentLength } = await getFileStream(settings.sbpQrPath)
  const headers = buildFileHeaders({ mimeType: 'image/png', fileName: 'sbp-qr.png' })
  if (contentLength != null) headers['Content-Length'] = String(contentLength)
  return new NextResponse(stream as unknown as BodyInit, { headers })
}

// POST — загрузить статический СБП QR (только PLATFORM_ADMIN)
export async function POST(request: NextRequest) {
  const { allowed, user, error } = await checkPlatformPermission(request, 'canManagePlatformManagers')
  if (!allowed || !user) {
    return NextResponse.json({ error: error || 'Недостаточно прав' }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Файл не передан' }, { status: 400 })
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Файл больше 5 МБ' }, { status: 400 })
  }
  if (!file.type.startsWith('image/') || isUploadMimeBlocked(file.type)) {
    return NextResponse.json({ error: 'Нужно изображение (PNG/JPG)' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const key = `platform/sbp-qr-${Date.now()}.png`
  await uploadFile(key, buffer, file.type || 'image/png')

  await getPlatformSettings()
  await prisma.platformSettings.update({ where: { id: 'platform' }, data: { sbpQrPath: key } })

  return NextResponse.json({ ok: true })
}

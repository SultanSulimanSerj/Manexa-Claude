import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { randomUUID } from 'crypto'
import { authenticateUser } from '@/lib/auth-api'
import { uploadFile, getFileStream } from '@/lib/storage'
import { buildFileHeaders, isUploadMimeBlocked } from '@/lib/safe-file-response'
import { blockIfImpersonated } from '@/lib/impersonation-guard'

export const dynamic = 'force-dynamic'

// POST — загрузка фото-чека. Возвращает ключ в хранилище + временную ссылку.
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request)
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!user.companyId) return NextResponse.json({ error: 'Нет компании' }, { status: 403 })

  const blocked = await blockIfImpersonated(request)
  if (blocked) return blocked

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Файл не передан' }, { status: 400 })
  if (file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: 'Файл больше 15 МБ' }, { status: 400 })
  }
  if (isUploadMimeBlocked(file.type)) {
    return NextResponse.json({ error: 'Недопустимый тип файла' }, { status: 400 })
  }

  const ext = path.extname(file.name) || '.jpg'
  const key = `receipts/${user.companyId}/${randomUUID()}${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  await uploadFile(key, buffer, file.type || 'image/jpeg')

  // Ссылка через само приложение (storage-эндпоинт внутренний)
  const url = `/api/finance/receipts?key=${encodeURIComponent(key)}`
  return NextResponse.json({ key, url }, { status: 201 })
}

// GET ?key=...[&dl=1] — отдаёт файл чека стримом через приложение
// (storage-эндпоинт внутренний и недоступен из браузера напрямую).
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request)
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!user.companyId) return NextResponse.json({ error: 'Нет компании' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')
  const download = searchParams.get('dl') === '1'
  if (!key || !key.startsWith(`receipts/${user.companyId}/`)) {
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })
  }

  try {
    const { stream, contentLength } = await getFileStream(key)
    const ext = (key.split('.').pop() || 'jpg').toLowerCase()
    const mime =
      ext === 'png' ? 'image/png'
        : ext === 'webp' ? 'image/webp'
        : ext === 'pdf' ? 'application/pdf'
        : ext === 'heic' ? 'image/heic'
        : 'image/jpeg'
    const filename = `cheque.${ext}`
    const headers = buildFileHeaders({ mimeType: mime, fileName: filename, forceDownload: download })
    if (contentLength != null) headers['Content-Length'] = String(contentLength)
    return new NextResponse(stream as unknown as BodyInit, { headers })
  } catch {
    return NextResponse.json({ error: 'Файл не найден' }, { status: 404 })
  }
}

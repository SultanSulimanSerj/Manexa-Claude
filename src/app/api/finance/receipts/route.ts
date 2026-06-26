import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { randomUUID } from 'crypto'
import { authenticateUser } from '@/lib/auth-api'
import { uploadFile, getSignedUrl } from '@/lib/storage'

export const dynamic = 'force-dynamic'

// POST — загрузка фото-чека. Возвращает ключ в хранилище + временную ссылку.
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request)
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!user.companyId) return NextResponse.json({ error: 'Нет компании' }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Файл не передан' }, { status: 400 })
  if (file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: 'Файл больше 15 МБ' }, { status: 400 })
  }

  const ext = path.extname(file.name) || '.jpg'
  const key = `receipts/${user.companyId}/${randomUUID()}${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  await uploadFile(key, buffer, file.type || 'image/jpeg')

  const url = await getSignedUrl(key, 3600)
  return NextResponse.json({ key, url }, { status: 201 })
}

// GET ?key=... — отдаёт временную ссылку (редирект) на чек. Только в рамках своей компании.
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request)
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!user.companyId) return NextResponse.json({ error: 'Нет компании' }, { status: 403 })

  const key = new URL(request.url).searchParams.get('key')
  if (!key || !key.startsWith(`receipts/${user.companyId}/`)) {
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })
  }
  const url = await getSignedUrl(key, 3600)
  return NextResponse.redirect(url)
}

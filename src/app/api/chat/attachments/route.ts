import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-api'
import { uploadFile } from '@/lib/storage'
import { isUploadMimeBlocked } from '@/lib/safe-file-response'
import { generateId } from '@/lib/id-generator'

export const dynamic = 'force-dynamic'

const MAX_SIZE = 25 * 1024 * 1024 // 25 МБ

/** Загрузка файла для вложения в сообщение чата. Возвращает метаданные (без записи в БД). */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const form = await request.formData()
  const file = form.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'Файл не передан' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Файл больше 25 МБ' }, { status: 400 })
  }
  if (isUploadMimeBlocked(file.type)) {
    return NextResponse.json({ error: 'Недопустимый тип файла' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const safeName = (file.name || 'file').replace(/[^\w.\-А-Яа-яЁё ]/g, '_').slice(0, 120)
  const key = `chat/${user.companyId || 'nocompany'}/${generateId()}-${safeName}`

  await uploadFile(key, buffer, file.type || 'application/octet-stream')

  return NextResponse.json({
    fileName: safeName,
    filePath: key,
    fileSize: file.size,
    mimeType: file.type || 'application/octet-stream',
  })
}

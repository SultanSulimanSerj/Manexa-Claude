import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPlatformPermission, logPlatformAction } from '@/lib/platform-auth'

export const dynamic = 'force-dynamic'

/** Добавить CRM-заметку к компании. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { allowed, user, error } = await checkPlatformPermission(request, 'canManagePlatform')
  if (!allowed || !user) {
    return NextResponse.json({ error: error || 'Не найдено' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const text = (body.text as string)?.trim()
  if (!text) {
    return NextResponse.json({ error: 'Текст заметки обязателен' }, { status: 400 })
  }

  const note = await prisma.companyNote.create({
    data: { companyId: params.id, authorId: user.id, authorEmail: user.email, text },
  })

  await logPlatformAction({
    actorId: user.id,
    actorEmail: user.email,
    action: 'COMPANY_NOTE_ADD',
    targetType: 'Company',
    targetId: params.id,
    request,
  })

  return NextResponse.json({ note })
}

/** Удалить заметку (?noteId=). Автор или PLATFORM_ADMIN. */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const { allowed, user, error } = await checkPlatformPermission(request, 'canManagePlatform')
  if (!allowed || !user) {
    return NextResponse.json({ error: error || 'Не найдено' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const noteId = searchParams.get('noteId')
  if (!noteId) {
    return NextResponse.json({ error: 'Требуется noteId' }, { status: 400 })
  }

  const note = await prisma.companyNote.findUnique({ where: { id: noteId } })
  if (!note || note.companyId !== params.id) {
    return NextResponse.json({ error: 'Заметка не найдена' }, { status: 404 })
  }
  if (note.authorId !== user.id && user.role !== 'PLATFORM_ADMIN') {
    return NextResponse.json({ error: 'Можно удалять только свои заметки' }, { status: 403 })
  }

  await prisma.companyNote.delete({ where: { id: noteId } })
  return NextResponse.json({ success: true })
}

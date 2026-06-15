import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'
import { getFileBuffer } from '@/lib/storage'
import { scanDocxTags } from '@/lib/template-scan'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canViewAllDocuments')

    if (!allowed || !user) {
      return NextResponse.json({ error: error || 'Недостаточно прав' }, { status: 403 })
    }

    const template = await prisma.documentTemplate.findUnique({
      where: { id: params.id },
    })

    if (!template) {
      return NextResponse.json({ error: 'Шаблон не найден' }, { status: 404 })
    }

    if (template.companyId !== user.companyId) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    if (!template.filePath) {
      return NextResponse.json({ tags: [], unknown: [] })
    }

    const buffer = await getFileBuffer(template.filePath)
    let tags
    try {
      tags = scanDocxTags(buffer)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Ошибка чтения DOCX'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    return NextResponse.json({
      tags,
      known: tags.filter((t) => t.known),
      unknown: tags.filter((t) => !t.known),
    })
  } catch (error) {
    console.error('Error scanning template tags:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

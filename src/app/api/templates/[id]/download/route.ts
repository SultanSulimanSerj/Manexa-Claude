import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'
import { getFileStream } from '@/lib/storage'

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
      return NextResponse.json({ error: 'Файл шаблона не найден' }, { status: 404 })
    }

    const { stream, contentLength } = await getFileStream(template.filePath)
    const fileName = `${template.name.replace(/[^\wа-яА-ЯёЁ\s.-]/g, '_')}.docx`

    const headers: Record<string, string> = {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    }
    if (contentLength != null) headers['Content-Length'] = String(contentLength)
    return new NextResponse(stream as unknown as BodyInit, { headers })
  } catch (error) {
    console.error('Error downloading template:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'
import { getFileBuffer } from '@/lib/storage'

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

    const buffer = await getFileBuffer(template.filePath)
    const fileName = `${template.name.replace(/[^\wа-яА-ЯёЁ\s.-]/g, '_')}.docx`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    })
  } catch (error) {
    console.error('Error downloading template:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'
import { getFileBuffer } from '@/lib/storage'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await checkPermission(request, 'canViewAllDocuments')
    if (!user?.companyId || user.companyId !== params.id) {
      return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
    }

    const type = request.nextUrl.searchParams.get('type')
    if (type !== 'stamp' && type !== 'signature') {
      return NextResponse.json({ error: 'Некорректный type' }, { status: 400 })
    }

    const company = await prisma.company.findUnique({
      where: { id: params.id },
      select: {
        stampFilePath: true,
        stampMimeType: true,
        signatureFilePath: true,
        signatureMimeType: true,
      },
    })

    if (!company) {
      return NextResponse.json({ error: 'Компания не найдена' }, { status: 404 })
    }

    const filePath = type === 'stamp' ? company.stampFilePath : company.signatureFilePath
    const mimeType =
      (type === 'stamp' ? company.stampMimeType : company.signatureMimeType) || 'image/png'

    if (!filePath) {
      return NextResponse.json({ error: 'Файл не найден' }, { status: 404 })
    }

    const buffer = await getFileBuffer(filePath)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (err) {
    console.error('Branding file GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

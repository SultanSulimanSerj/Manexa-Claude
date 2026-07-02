import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-api'
import { verifyProjectCompanyAccess } from '@/lib/access-control'
import { getFileBuffer } from '@/lib/storage'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/** Скачать вложение сообщения чата (с проверкой доступа). */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await authenticateUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const attachment = await prisma.chatAttachment.findUnique({
    where: { id: params.id },
    include: {
      message: { select: { projectId: true, companyId: true, user: { select: { companyId: true } } } },
    },
  })
  if (!attachment) {
    return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
  }

  // Проверка доступа: проектный чат — доступ к проекту; общий чат — та же компания
  const msg = attachment.message
  let allowed = false
  if (msg.projectId) {
    allowed = await verifyProjectCompanyAccess(user, msg.projectId)
  } else {
    const companyId = msg.companyId || msg.user?.companyId
    allowed = !!companyId && companyId === user.companyId
  }
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const buffer = await getFileBuffer(attachment.filePath)
  const dl = new URL(request.url).searchParams.get('dl') === '1'
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': attachment.mimeType || 'application/octet-stream',
      'Content-Disposition': `${dl ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
    },
  })
}

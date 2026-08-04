import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-api'
import { verifyTaskCompanyAccess } from '@/lib/access-control'
import { prisma } from '@/lib/prisma'
import { getFileStream } from '@/lib/storage'

// GET /api/tasks/[id]/attachments/[attachmentId]/download — скачать/просмотреть файл
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; attachmentId: string } }
) {
  try {
    const user = await authenticateUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: taskId, attachmentId } = params

    if (!(await verifyTaskCompanyAccess(user, taskId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const attachment = await prisma.taskAttachment.findFirst({
      where: { id: attachmentId, taskId }
    })

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    const inline = new URL(request.url).searchParams.get('inline') === '1'

    try {
      const { stream, contentLength } = await getFileStream(attachment.filePath)
      const headers: Record<string, string> = {
        'Content-Type': attachment.mimeType || 'application/octet-stream',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(attachment.fileName || 'attachment')}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
        Pragma: 'no-cache',
      }
      if (contentLength != null) headers['Content-Length'] = String(contentLength)
      return new NextResponse(stream as unknown as BodyInit, { status: 200, headers })
    } catch (storageError) {
      console.error('Error reading task attachment file:', storageError)
      return NextResponse.json({ error: 'Failed to download file' }, { status: 500 })
    }
  } catch (error) {
    console.error('Error downloading task attachment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

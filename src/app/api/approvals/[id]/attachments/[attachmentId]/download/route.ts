import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-api'
import { verifyApprovalCompanyAccess } from '@/lib/access-control'
import { prisma } from '@/lib/prisma'
import { getFileStream } from '@/lib/storage'

// GET /api/approvals/[id]/attachments/[attachmentId]/download - Скачать файл
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; attachmentId: string } }
) {
  try {
    const user = await authenticateUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: approvalId, attachmentId } = params

    if (!(await verifyApprovalCompanyAccess(user, approvalId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const approval = await prisma.approval.findUnique({
      where: { id: approvalId },
      include: {
        assignments: { select: { userId: true } }
      }
    })

    if (!approval) {
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 })
    }

    const isCreator = approval.creatorId === user.id
    const isAssignee = approval.assignments.some(a => a.userId === user.id)
    if (!isCreator && !isAssignee) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Получаем информацию о файле
    const attachment = await prisma.approvalAttachment.findFirst({
      where: {
        id: attachmentId,
        approvalId: approvalId
      }
    })

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    try {
      const { stream, contentLength } = await getFileStream(attachment.filePath)
      const headers: Record<string, string> = {
        'Content-Type': attachment.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(attachment.fileName || 'attachment')}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
        Pragma: 'no-cache',
      }
      if (contentLength != null) headers['Content-Length'] = String(contentLength)
      return new NextResponse(stream as unknown as BodyInit, { status: 200, headers })
    } catch (storageError) {
      console.error('Error reading attachment file:', storageError)
      return NextResponse.json({ error: 'Failed to download file' }, { status: 500 })
    }

  } catch (error) {
    console.error('Error downloading attachment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

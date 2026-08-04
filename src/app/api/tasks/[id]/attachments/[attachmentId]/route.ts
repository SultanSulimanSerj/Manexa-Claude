import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-api'
import { verifyTaskCompanyAccess, userCanEditTask } from '@/lib/access-control'
import { prisma } from '@/lib/prisma'
import { deleteFile } from '@/lib/storage'

// DELETE /api/tasks/[id]/attachments/[attachmentId] — удалить вложение
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; attachmentId: string } }
) {
  try {
    const user = await authenticateUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await verifyTaskCompanyAccess(user, params.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!(await userCanEditTask(user, params.id))) {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
    }

    const attachment = await prisma.taskAttachment.findFirst({
      where: { id: params.attachmentId, taskId: params.id }
    })

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    try {
      await deleteFile(attachment.filePath)
    } catch (storageError) {
      console.error('Error deleting file from storage:', storageError)
      // Продолжаем удаление из БД даже если файл не найден в хранилище
    }

    await prisma.taskAttachment.delete({
      where: { id: params.attachmentId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting task attachment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

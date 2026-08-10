import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-api'
import { verifyTaskCompanyAccess, userCanEditTask } from '@/lib/access-control'
import { prisma } from '@/lib/prisma'
import { uploadFile } from '@/lib/storage'
import { generateId } from '@/lib/id-generator'
import { validateUploadFile } from '@/lib/upload-validation'

// GET /api/tasks/[id]/attachments — список вложений задачи
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await verifyTaskCompanyAccess(user, params.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const attachments = await prisma.taskAttachment.findMany({
      where: { taskId: params.id },
      include: {
        uploadedBy: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ attachments })
  } catch (error) {
    console.error('Error fetching task attachments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/tasks/[id]/attachments — загрузить вложение
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const formData = await request.formData()
    const file = formData.get('file') as File

    const validationError = validateUploadFile(file)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const filePath = `tasks/${params.id}/${Date.now()}-${file.name}`

    await uploadFile(filePath, buffer, file.type)

    const attachment = await prisma.taskAttachment.create({
      data: {
        id: generateId(),
        fileName: file.name,
        filePath,
        fileSize: file.size,
        mimeType: file.type,
        taskId: params.id,
        uploadedById: user.id
      },
      include: {
        uploadedBy: { select: { id: true, name: true } }
      }
    })

    return NextResponse.json(attachment, { status: 201 })
  } catch (error) {
    console.error('Error uploading task attachment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

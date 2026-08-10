import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'
import { generateId } from '@/lib/id-generator'
import { uploadFile } from '@/lib/storage'
import { verifyProjectCompanyAccess } from '@/lib/access-control'
import { validateUploadFile } from '@/lib/upload-validation'

export async function POST(request: NextRequest) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canCreateDocuments')
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!allowed) {
      return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const projectId = formData.get('projectId') as string
    const category = formData.get('category') as string

    const validationError = validateUploadFile(file)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    if (projectId) {
      const hasProjectAccess = await verifyProjectCompanyAccess(user, projectId)
      if (!hasProjectAccess) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
    }

    const docId = generateId()
    const fileExtension = file.name.split('.').pop() || 'bin'
    const uniqueFilename = `${docId}.${fileExtension}`
    const storageKey = `documents/${user.companyId}/${uniqueFilename}`

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await uploadFile(storageKey, buffer, file.type)

    const documentCount = await prisma.document.count()
    const documentNumber = `DOC-${String(documentCount + 1).padStart(6, '0')}`

    const document = await prisma.document.create({
      data: {
        id: docId,
        title,
        description: description || null,
        fileName: file.name,
        filePath: storageKey,
        fileSize: file.size,
        mimeType: file.type,
        version: 1,
        documentNumber,
        creatorId: user.id,
        companyId: user.companyId || null,
        projectId: projectId || null,
        updatedAt: new Date(),
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
        project: {
          select: { id: true, name: true },
        },
      },
    })

    return NextResponse.json(document, { status: 201 })
  } catch (error) {
    console.error('Error uploading document:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

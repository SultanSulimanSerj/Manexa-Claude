import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'
import { deleteFile, uploadFile } from '@/lib/storage'
import { buildTemplateStorageKey } from '@/lib/template-scan'
import { setTemplateAsDefault } from '@/lib/template-default'
import { assertValidDocxBuffer } from '@/lib/docx-buffer'
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

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
      include: { _count: { select: { documents: true } } },
    })

    if (!template) {
      return NextResponse.json({ error: 'Шаблон не найден' }, { status: 404 })
    }

    if (template.companyId !== user.companyId) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    return NextResponse.json({
      ...template,
      hasFile: Boolean(template.filePath),
      isSystem: false,
      type:
        template.category === 'COMMERCIAL_OFFER'
          ? 'commercial-offer'
          : template.category === 'INVOICE'
            ? 'invoice'
            : 'contract',
    })
  } catch (error) {
    console.error('Error fetching template:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canEditDocuments')

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

    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const name = formData.get('name')
      const description = formData.get('description')
      const isActive = formData.get('isActive')
      const file = formData.get('file')

      const data: {
        name?: string
        description?: string | null
        isActive?: boolean
        filePath?: string
        fileType?: 'DOCX'
        updatedAt: Date
      } = { updatedAt: new Date() }

      if (typeof name === 'string' && name.trim()) data.name = name.trim()
      if (description !== null && description !== undefined) {
        data.description = typeof description === 'string' ? description.trim() || null : null
      }
      if (isActive === 'true' || isActive === 'false') {
        data.isActive = isActive === 'true'
      }

      if (file instanceof File && file.size > 0) {
        if (!file.name.toLowerCase().endsWith('.docx')) {
          return NextResponse.json({ error: 'Допустим только формат .docx' }, { status: 400 })
        }
        const storageKey = template.filePath || buildTemplateStorageKey(user.companyId!, template.id)
        const buffer = Buffer.from(await file.arrayBuffer())
        try {
          assertValidDocxBuffer(buffer, 'Загружаемый файл')
        } catch (e) {
          return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Некорректный DOCX' },
            { status: 400 }
          )
        }
        await uploadFile(storageKey, buffer, DOCX_MIME)
        data.filePath = storageKey
        data.fileType = 'DOCX'
      }

      const updated = await prisma.documentTemplate.update({
        where: { id: params.id },
        data,
        include: { _count: { select: { documents: true } } },
      })

      return NextResponse.json({ ...updated, hasFile: Boolean(updated.filePath) })
    }

    const body = await request.json()
    const { name, description, isActive, isDefault } = body

    if (isDefault === true) {
      await setTemplateAsDefault(params.id, user.companyId!, template.category)
    }

    const updatedTemplate = await prisma.documentTemplate.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
        updatedAt: new Date(),
      },
      include: { _count: { select: { documents: true } } },
    })

    return NextResponse.json({ ...updatedTemplate, hasFile: Boolean(updatedTemplate.filePath) })
  } catch (error) {
    console.error('Error updating template:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canDeleteDocuments')

    if (!allowed || !user) {
      return NextResponse.json({ error: error || 'Недостаточно прав' }, { status: 403 })
    }

    const template = await prisma.documentTemplate.findUnique({
      where: { id: params.id },
      include: { _count: { select: { documents: true } } },
    })

    if (!template) {
      return NextResponse.json({ error: 'Шаблон не найден' }, { status: 404 })
    }

    if (template.companyId !== user.companyId) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    if (template._count.documents > 0) {
      return NextResponse.json(
        { error: `Невозможно удалить шаблон. Из него создано документов: ${template._count.documents}` },
        { status: 400 }
      )
    }

    if (template.filePath?.startsWith('templates/')) {
      try {
        await deleteFile(template.filePath)
      } catch (err) {
        console.error('Error deleting template file from storage:', err)
      }
    }

    await prisma.documentTemplate.delete({ where: { id: params.id } })

    return NextResponse.json({ message: 'Шаблон удален' })
  } catch (error) {
    console.error('Error deleting template:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

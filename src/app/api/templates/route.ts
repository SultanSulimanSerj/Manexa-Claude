/**
 * API для работы с шаблонами документов
 * GET /api/templates - шаблоны компании
 * POST /api/templates - загрузка DOCX-шаблона
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'
import { uploadFile } from '@/lib/storage'
import { buildTemplateStorageKey } from '@/lib/template-scan'
import { ensureDefaultIfFirst, setTemplateAsDefault } from '@/lib/template-default'
import { isTemplateDocCategory } from '@/lib/template-tags'
import { assertValidDocxBuffer } from '@/lib/docx-buffer'
import { generateId } from '@/lib/id-generator'
import type { TemplateCategory } from '@prisma/client'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

function formatDbTemplate(template: {
  id: string
  name: string
  description: string | null
  category: TemplateCategory
  fileType: string
  filePath: string | null
  content: string | null
  variables: unknown
  isActive: boolean
  isDefault: boolean
  companyId: string
  creatorId: string | null
  createdAt: Date
  updatedAt: Date
  _count: { documents: number }
}) {
  return {
    id: template.id,
    name: template.name,
    description: template.description || '',
    category: template.category,
    type:
      template.category === 'COMMERCIAL_OFFER'
        ? 'commercial-offer'
        : template.category === 'INVOICE'
          ? 'invoice'
          : 'contract',
    fileType: template.fileType,
    filePath: template.filePath,
    hasFile: Boolean(template.filePath),
    content: template.content,
    variables: template.variables,
    autoNumber: false,
    numberFormat: '',
    autoFillSources: null,
    isActive: template.isActive,
    isDefault: template.isDefault,
    isPublic: false,
    isSystem: false,
    companyId: template.companyId,
    creatorId: template.creatorId,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
    requiresApproval: false,
    _count: { documents: template._count.documents },
  }
}

export async function GET(request: NextRequest) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canViewAllDocuments')

    if (!allowed || !user) {
      return NextResponse.json({ error: error || 'Недостаточно прав' }, { status: 403 })
    }

    if (!user.companyId) {
      return NextResponse.json({ templates: [] })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') as TemplateCategory | null
    const docxOnly = searchParams.get('docxOnly') === 'true'

    const where: {
      companyId: string
      isActive?: boolean
      category?: TemplateCategory
      fileType?: 'DOCX'
      filePath?: { not: null }
    } = {
      companyId: user.companyId,
    }
    if (category && isTemplateDocCategory(category)) {
      where.category = category
    }
    if (docxOnly) {
      where.isActive = true
      where.fileType = 'DOCX'
      where.filePath = { not: null }
    }

    const dbTemplates = await prisma.documentTemplate.findMany({
      where,
      include: { _count: { select: { documents: true } } },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json(
      { templates: dbTemplates.map(formatDbTemplate) },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canEditDocuments')

    if (!allowed || !user) {
      return NextResponse.json({ error: error || 'Недостаточно прав' }, { status: 403 })
    }
    if (!user.companyId) {
      return NextResponse.json({ error: 'Компания не найдена' }, { status: 400 })
    }

    const formData = await request.formData()
    const name = formData.get('name')
    const description = formData.get('description')
    const category = formData.get('category')
    const file = formData.get('file')

    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Укажите название шаблона' }, { status: 400 })
    }

    if (typeof category !== 'string' || !isTemplateDocCategory(category)) {
      return NextResponse.json(
        { error: 'Укажите категорию: CONTRACT, COMMERCIAL_OFFER или INVOICE' },
        { status: 400 }
      )
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Загрузите файл DOCX' }, { status: 400 })
    }

    if (!file.name.toLowerCase().endsWith('.docx')) {
      return NextResponse.json({ error: 'Допустим только формат .docx' }, { status: 400 })
    }

    const templateId = generateId()
    const storageKey = buildTemplateStorageKey(user.companyId, templateId)
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

    const template = await prisma.documentTemplate.create({
      data: {
        id: templateId,
        name: name.trim(),
        description: typeof description === 'string' ? description.trim() || null : null,
        category,
        fileType: 'DOCX',
        filePath: storageKey,
        isActive: true,
        companyId: user.companyId,
        creatorId: user.id,
      },
      include: { _count: { select: { documents: true } } },
    })

    const setAsDefault = formData.get('setAsDefault') !== 'false'
    if (setAsDefault) {
      await setTemplateAsDefault(template.id, user.companyId, category)
    } else {
      await ensureDefaultIfFirst(template.id, user.companyId, category)
    }

    const refreshed = await prisma.documentTemplate.findUniqueOrThrow({
      where: { id: template.id },
      include: { _count: { select: { documents: true } } },
    })

    return NextResponse.json(formatDbTemplate(refreshed), { status: 201 })
  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

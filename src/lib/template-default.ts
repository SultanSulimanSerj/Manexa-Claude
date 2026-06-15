import { prisma } from '@/lib/prisma'
import type { TemplateCategory } from '@prisma/client'
import type { DocumentContentType } from '@/lib/document-editor/types'

export function documentTypeToTemplateCategory(
  type: DocumentContentType
): TemplateCategory | null {
  switch (type) {
    case 'CONTRACT':
      return 'CONTRACT'
    case 'COMMERCIAL_OFFER':
      return 'COMMERCIAL_OFFER'
    case 'INVOICE':
      return 'INVOICE'
    default:
      return null
  }
}

export async function findDefaultTemplateId(
  companyId: string,
  category: TemplateCategory
): Promise<string | undefined> {
  const template = await prisma.documentTemplate.findFirst({
    where: {
      companyId,
      category,
      isDefault: true,
      isActive: true,
      fileType: 'DOCX',
      filePath: { not: null },
    },
    select: { id: true },
  })

  return template?.id
}

export async function setTemplateAsDefault(
  templateId: string,
  companyId: string,
  category: TemplateCategory
): Promise<void> {
  await prisma.$transaction([
    prisma.documentTemplate.updateMany({
      where: { companyId, category, isDefault: true },
      data: { isDefault: false },
    }),
    prisma.documentTemplate.update({
      where: { id: templateId },
      data: { isDefault: true, isActive: true, updatedAt: new Date() },
    }),
  ])
}

export async function ensureDefaultIfFirst(
  templateId: string,
  companyId: string,
  category: TemplateCategory
): Promise<void> {
  const existing = await prisma.documentTemplate.findFirst({
    where: {
      companyId,
      category,
      isDefault: true,
      isActive: true,
      filePath: { not: null },
    },
    select: { id: true },
  })

  if (!existing) {
    await prisma.documentTemplate.update({
      where: { id: templateId },
      data: { isDefault: true, isActive: true },
    })
  }
}

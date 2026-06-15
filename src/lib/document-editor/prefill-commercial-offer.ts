import { prisma } from '@/lib/prisma'
import { buildSpecificationFromEstimate } from '@/lib/commercial-offer-generator'
import type { CommercialOfferDocumentContent } from './types'
import { DOCUMENT_CONTENT_SCHEMA_VERSION, buildSourceMeta } from './types'

export interface CreateCommercialOfferDraftParams {
  projectId: string
  companyId: string
  estimateIds: string[]
  documentNumber: string
  documentDate?: Date
}

export async function buildCommercialOfferDraftContent(
  params: CreateCommercialOfferDraftParams
): Promise<{
  content: CommercialOfferDocumentContent
  sourceMeta: ReturnType<typeof buildSourceMeta>
  documentNumber: string
}> {
  const { projectId, companyId, estimateIds, documentNumber, documentDate = new Date() } = params

  if (!estimateIds.length) {
    throw new Error('Для КП необходимо выбрать смету')
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      company: true,
      estimates: {
        where: { id: { in: estimateIds } },
        include: { items: { orderBy: { createdAt: 'asc' } } },
      },
    },
  })

  if (!project) throw new Error('Проект не найден')
  if (project.companyId !== companyId) throw new Error('Недостаточно прав')
  if (!project.estimates?.length || project.estimates.length !== estimateIds.length) {
    throw new Error('Смета не найдена в этом проекте')
  }

  const estimate = project.estimates[0]
  const dateStr = documentDate.toLocaleDateString('ru-RU')
  const workAddress = project.clientActualAddress || project.clientLegalAddress || ''
  const startDate = project.startDate
    ? new Date(project.startDate).toLocaleDateString('ru-RU')
    : ''
  const endDate = project.endDate ? new Date(project.endDate).toLocaleDateString('ru-RU') : ''

  const spec = buildSpecificationFromEstimate(
    estimate,
    documentNumber,
    dateStr,
    project.name,
    workAddress,
    startDate,
    endDate
  )

  const validUntil = new Date(documentDate)
  validUntil.setDate(validUntil.getDate() + 14)

  const content: CommercialOfferDocumentContent = {
    type: 'COMMERCIAL_OFFER',
    schemaVersion: DOCUMENT_CONTENT_SCHEMA_VERSION,
    data: {
      offerNumber: documentNumber,
      offerDate: dateStr,
      city: project.company?.city || 'Екатеринбург',
      executorName: project.company?.name || '',
      executorLegalName: project.company?.legalName || project.company?.name || '',
      executorInn: project.company?.inn || '',
      executorKpp: project.company?.kpp || '',
      executorPhone: project.company?.phone || project.company?.contactPhone || '',
      executorEmail: project.company?.contactEmail || '',
      executorDirector: project.company?.directorName || '',
      clientName: project.clientName || '',
      clientLegalName: project.clientLegalName || project.clientName || '',
      projectName: project.name,
      workAddress,
      estimateName: estimate.name,
      items: spec.items,
      total: spec.total,
      vatEnabled: spec.vatEnabled,
      vatRate: spec.vatRate,
      vatAmount: spec.vatAmount,
      totalWithVat: spec.totalWithVat,
      validUntil: validUntil.toLocaleDateString('ru-RU'),
    },
  }

  return {
    content,
    sourceMeta: buildSourceMeta(projectId, { estimateIds }),
    documentNumber,
  }
}

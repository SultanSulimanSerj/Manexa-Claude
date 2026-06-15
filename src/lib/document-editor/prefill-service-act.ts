import { prisma } from '@/lib/prisma'
import type { ServiceActDocumentData } from '@/lib/document-renderer/fns-form-types'
import type { ServiceActDocumentContent } from './types'
import { DOCUMENT_CONTENT_SCHEMA_VERSION, buildSourceMeta, isInvoiceContent } from './types'
import {
  buildPartiesFromProject,
  formatContractBasis,
  loadProjectForFnsPrefill,
  mergeEstimatesOrEmpty,
  mergedToLineItems,
} from './prefill-fns-common'

export interface CreateServiceActDraftParams {
  projectId: string
  companyId: string
  creatorId: string
  estimateIds?: string[]
  invoiceDocumentId?: string
  documentNumber?: string | null
  documentDate?: Date
  parentDocumentId?: string
}

async function buildBasisText(
  projectId: string,
  companyId: string,
  projectBasis: string,
  invoiceDocumentId?: string
): Promise<string> {
  const parts: string[] = []
  if (projectBasis) parts.push(projectBasis)

  if (invoiceDocumentId) {
    const invoice = await prisma.document.findFirst({
      where: {
        id: invoiceDocumentId,
        projectId,
        category: 'INVOICE',
        OR: [{ companyId }, { companyId: null, creator: { companyId } }],
      },
    })
    if (invoice?.contentJson && isInvoiceContent(invoice.contentJson)) {
      const inv = invoice.contentJson.data
      parts.push(`Счёт на оплату № ${inv.documentNumber} от ${inv.documentDate}`)
    }
  }

  return parts.join(', ')
}

export async function buildServiceActDraftContent(
  params: CreateServiceActDraftParams
): Promise<{
  content: ServiceActDocumentContent
  sourceMeta: ReturnType<typeof buildSourceMeta>
  documentNumber: string
}> {
  const {
    projectId,
    companyId,
    estimateIds = [],
    invoiceDocumentId,
    documentNumber,
    documentDate = new Date(),
  } = params

  if (!documentNumber?.trim()) {
    throw new Error('Номер документа обязателен')
  }

  const project = await loadProjectForFnsPrefill(projectId, companyId, estimateIds)
  const merged = mergeEstimatesOrEmpty(project, estimateIds)
  if (!merged.items.length) {
    throw new Error('Выберите смету с позициями для акта')
  }

  const dateStr = documentDate.toLocaleDateString('ru-RU')
  const { seller, buyer } = buildPartiesFromProject(project)
  const contractBasis = formatContractBasis(project)
  const basisText = await buildBasisText(projectId, companyId, contractBasis, invoiceDocumentId)

  const data: ServiceActDocumentData = {
    documentNumber: documentNumber.trim(),
    documentDate: dateStr,
    projectName: project.name,
    contractNumber: project.contractNumber || undefined,
    contractDate: project.contractDate
      ? new Date(project.contractDate).toLocaleDateString('ru-RU')
      : undefined,
    seller,
    buyer,
    basisText,
    items: mergedToLineItems(merged),
    totals: {
      totalWithoutVat: merged.totalWithoutVat,
      totalVat: merged.totalVat,
      totalWithVat: merged.totalWithVat,
      hasVat: merged.hasVat,
    },
  }

  const content: ServiceActDocumentContent = {
    type: 'SERVICE_ACT',
    schemaVersion: DOCUMENT_CONTENT_SCHEMA_VERSION,
    data,
  }

  const sourceMeta = buildSourceMeta(projectId, {
    estimateIds,
    invoiceDocumentId,
  })

  return { content, sourceMeta, documentNumber: documentNumber.trim() }
}

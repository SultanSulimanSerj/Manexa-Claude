import { prisma } from '@/lib/prisma'
import { buildSpecificationFromEstimate } from '@/lib/commercial-offer-generator'
import type { ContractData } from '@/lib/document-generator'
import type { ContractDocumentContent } from './types'
import { DOCUMENT_CONTENT_SCHEMA_VERSION, buildSourceMeta } from './types'

export interface CreateContractDraftParams {
  projectId: string
  companyId: string
  estimateIds?: string[]
  documentNumber: string
  documentDate?: Date
}

function buildContractDataFromProject(
  project: {
    name: string
    description?: string | null
    startDate?: Date | string | null
    endDate?: Date | string | null
    budget?: unknown
    clientName?: string | null
    clientLegalName?: string | null
    clientDirectorName?: string | null
    clientInn?: string | null
    clientKpp?: string | null
    clientOgrn?: string | null
    clientLegalAddress?: string | null
    clientActualAddress?: string | null
    clientContactPhone?: string | null
    clientContactEmail?: string | null
    clientBankAccount?: string | null
    clientBankName?: string | null
    clientBankBik?: string | null
    clientCorrespondentAccount?: string | null
    company?: {
      name?: string | null
      legalName?: string | null
      city?: string | null
      directorName?: string | null
      directorPosition?: string | null
      inn?: string | null
      kpp?: string | null
      ogrn?: string | null
      legalAddress?: string | null
      address?: string | null
      phone?: string | null
      contactPhone?: string | null
      contactEmail?: string | null
      bankAccount?: string | null
      bankName?: string | null
      bankBik?: string | null
      correspondentAccount?: string | null
    } | null
  },
  contractNumber: string,
  contractDate: string,
  estimate: { name: string; total: unknown; totalWithVat?: unknown; vatEnabled: boolean; items?: unknown[] } | null
): ContractData {
  const workAddress = project.clientActualAddress || project.clientLegalAddress || ''
  const startDate = project.startDate
    ? new Date(project.startDate).toLocaleDateString('ru-RU')
    : ''
  const endDate = project.endDate ? new Date(project.endDate).toLocaleDateString('ru-RU') : ''
  const totalAmount = estimate
    ? Number(estimate.totalWithVat || estimate.total).toLocaleString('ru-RU')
    : project.budget
      ? Number(project.budget).toLocaleString('ru-RU')
      : ''

  return {
    contractNumber,
    contractDate,
    city: project.company?.city || 'Екатеринбург',
    executorName: project.company?.name || '',
    executorLegalName: project.company?.legalName || project.company?.name || '',
    executorDirector: project.company?.directorName || '',
    executorDirectorPosition: project.company?.directorPosition || 'Генеральный директор',
    executorInn: project.company?.inn || '',
    executorKpp: project.company?.kpp || '',
    executorOgrn: project.company?.ogrn || '',
    executorAddress: project.company?.legalAddress || project.company?.address || '',
    executorPhone: project.company?.phone || project.company?.contactPhone || '',
    executorEmail: project.company?.contactEmail || '',
    executorBankAccount: project.company?.bankAccount || '',
    executorBankName: project.company?.bankName || '',
    executorBankBik: project.company?.bankBik || '',
    executorCorrespondentAccount: project.company?.correspondentAccount || '',
    clientName: project.clientName || '',
    clientLegalName: project.clientLegalName || project.clientName || '',
    clientDirector: project.clientDirectorName || '',
    clientInn: project.clientInn || '',
    clientKpp: project.clientKpp || '',
    clientOgrn: project.clientOgrn || '',
    clientLegalAddress: project.clientLegalAddress || '',
    clientPhone: project.clientContactPhone || '',
    clientEmail: project.clientContactEmail || '',
    clientBankAccount: project.clientBankAccount || '',
    clientBankName: project.clientBankName || '',
    clientBankBik: project.clientBankBik || '',
    clientCorrespondentAccount: project.clientCorrespondentAccount || '',
    projectName: project.name,
    projectDescription: project.description || '',
    workAddress,
    startDate,
    endDate,
    totalAmount,
    vatEnabled: estimate ? estimate.vatEnabled : false,
    specification:
      estimate && (estimate as { items?: unknown[] }).items?.length
        ? buildSpecificationFromEstimate(
            estimate as Parameters<typeof buildSpecificationFromEstimate>[0],
            contractNumber,
            contractDate,
            project.name,
            workAddress,
            startDate,
            endDate
          )
        : undefined,
  }
}

export async function buildContractDraftContent(
  params: CreateContractDraftParams
): Promise<{
  content: ContractDocumentContent
  sourceMeta: ReturnType<typeof buildSourceMeta>
  documentNumber: string
}> {
  const { projectId, companyId, estimateIds = [], documentNumber, documentDate = new Date() } = params
  const dateStr = documentDate.toLocaleDateString('ru-RU')

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      company: true,
      estimates:
        estimateIds.length > 0
          ? {
              where: { id: { in: estimateIds } },
              include: { items: { orderBy: { createdAt: 'asc' } } },
            }
          : undefined,
    },
  })

  if (!project) throw new Error('Проект не найден')
  if (project.companyId !== companyId) throw new Error('Недостаточно прав')

  const estimate =
    estimateIds.length > 0 && project.estimates?.length ? project.estimates[0] : null

  const content: ContractDocumentContent = {
    type: 'CONTRACT',
    schemaVersion: DOCUMENT_CONTENT_SCHEMA_VERSION,
    data: buildContractDataFromProject(project, documentNumber, dateStr, estimate),
  }

  return {
    content,
    sourceMeta: buildSourceMeta(projectId, { estimateIds }),
    documentNumber,
  }
}

import { prisma } from '@/lib/prisma'
import { generateId } from '@/lib/id-generator'
import type { DocumentContent, DocumentSourceMeta } from './types'
import {
  isUpdContent,
  isCommercialOfferContent,
  isContractContent,
  parseDocumentContent,
  getDocumentContentType,
} from './types'
import { recalculateCommercialOfferData } from './commercial-offer-calculations'
import { type CreateUpdDraftParams } from './prefill-upd'
import { type CreateInvoiceDraftParams } from './prefill-invoice'
import { createEditableDocumentDraft, type CreateEditableDraftParams } from './create-draft'
import { applyCalculationsToUpdData } from './upd-calculations'
import {
  exportDocumentContent,
  uploadExportedFile,
  type ExportFormat,
} from './document-export-router'
import { getDocumentTypeDefinition } from './registry'
import { computeHasUnpublishedChangesAfterExport } from '@/lib/document-export/format-utils'
import { computeDocumentExportHash } from '@/lib/document-export/content-hash'
import { allocateDocumentNumber, isDocumentNumberTaken } from '@/lib/document-numbering'
import { deleteFile } from '@/lib/storage'
import type { DocumentEditorStatus } from '@prisma/client'

const PLACEHOLDER_FILE = 'draft-placeholder.txt'

function isMinIOKey(filePath: string): boolean {
  return (
    filePath.startsWith('documents/') ||
    filePath.startsWith('stages/') ||
    filePath.startsWith('approvals/')
  )
}

async function deleteStoredExportFile(filePath: string | null | undefined): Promise<void> {
  if (!filePath || filePath === PLACEHOLDER_FILE || !isMinIOKey(filePath)) return
  try {
    await deleteFile(filePath)
  } catch (err) {
    console.error('Error deleting previous export file:', filePath, err)
  }
}

export async function createUpdDraft(params: CreateUpdDraftParams) {
  return createEditableDocumentDraft({
    type: 'UPD',
    projectId: params.projectId,
    companyId: params.companyId,
    creatorId: params.creatorId,
    invoiceDocumentId: params.invoiceDocumentId,
    contractDocumentId: params.contractDocumentId,
    parentDocumentId: params.parentDocumentId,
    documentNumber: params.documentNumber,
    updStatus: params.updStatus,
    documentDate: params.documentDate,
  })
}

export async function createInvoiceDraft(params: CreateInvoiceDraftParams) {
  return createEditableDocumentDraft({ type: 'INVOICE', ...params })
}

export async function createCommercialOfferDraft(
  params: Omit<CreateEditableDraftParams, 'type'>
) {
  return createEditableDocumentDraft({ type: 'COMMERCIAL_OFFER', ...params })
}

export async function createContractDraft(params: Omit<CreateEditableDraftParams, 'type'>) {
  return createEditableDocumentDraft({ type: 'CONTRACT', ...params })
}

export async function createKs2Draft(params: Omit<CreateEditableDraftParams, 'type'>) {
  return createEditableDocumentDraft({ type: 'KS2', ...params })
}

export async function createKs3Draft(params: Omit<CreateEditableDraftParams, 'type'>) {
  return createEditableDocumentDraft({ type: 'KS3', ...params })
}

export async function createServiceActDraft(params: Omit<CreateEditableDraftParams, 'type'>) {
  return createEditableDocumentDraft({ type: 'SERVICE_ACT', ...params })
}

export async function getDocumentForCompany(documentId: string, companyId: string) {
  return prisma.document.findFirst({
    where: {
      id: documentId,
      OR: [{ companyId }, { companyId: null, creator: { companyId } }],
    },
    include: {
      project: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true, email: true } },
    },
  })
}

async function ensureDocumentNumberAllocated<T extends DocumentContent>(
  document: {
    id: string
    numberAllocated: boolean
    documentNumber: string | null
    contentJson: unknown
    companyId: string | null
    category: string | null
  },
  content: T
): Promise<T> {
  if (!document.companyId) {
    throw new Error('Компания не найдена')
  }

  if (document.numberAllocated) {
    return content
  }

  const { number: currentNumber } = getDocumentNumberAndDate(content)
  const category = document.category ?? getDocumentContentType(content)
  const allocated = await allocateDocumentNumber(
    document.companyId,
    category,
    currentNumber || document.documentNumber,
    { excludeDocumentId: document.id }
  )

  const updatedData = { ...content.data } as Record<string, unknown>
  if (isCommercialOfferContent(content)) {
    updatedData.offerNumber = allocated
  } else if (isContractContent(content)) {
    updatedData.contractNumber = allocated
  } else {
    updatedData.documentNumber = allocated
  }

  const updated = { ...content, data: updatedData } as T

  await prisma.document.update({
    where: { id: document.id },
    data: {
      documentNumber: allocated,
      numberAllocated: true,
      contentJson: updated as object,
    },
  })

  return updated
}

function getDocumentNumberAndDate(content: DocumentContent): { number: string; date: string } {
  const data = content.data as unknown as Record<string, unknown>
  if (isCommercialOfferContent(content)) {
    return {
      number: String(data.offerNumber || ''),
      date: String(data.offerDate || ''),
    }
  }
  if (isContractContent(content)) {
    return {
      number: String(data.contractNumber || ''),
      date: String(data.contractDate || ''),
    }
  }
  return {
    number: String(data.documentNumber || ''),
    date: String(data.documentDate || ''),
  }
}

function buildDocumentTitle(content: DocumentContent): string {
  const typeDef = getDocumentTypeDefinition(getDocumentContentType(content))
  const { number, date } = getDocumentNumberAndDate(content)
  return `${typeDef.label} № ${number} от ${date}`
}

function normalizeSavedContent(content: DocumentContent): DocumentContent {
  if (isUpdContent(content)) {
    return { ...content, data: applyCalculationsToUpdData(content.data) }
  }
  if (isCommercialOfferContent(content)) {
    return { ...content, data: recalculateCommercialOfferData(content.data) }
  }
  return content
}

export async function saveDocumentContent(
  documentId: string,
  companyId: string,
  content: DocumentContent
) {
  const document = await getDocumentForCompany(documentId, companyId)
  if (!document) {
    throw new Error('Документ не найден')
  }
  const parsed = parseDocumentContent(content)
  if (!parsed) {
    throw new Error('Неподдерживаемый тип содержимого')
  }

  const updatedContent = normalizeSavedContent(parsed)
  const { number: documentNumber } = getDocumentNumberAndDate(updatedContent)
  const category = document.category ?? getDocumentContentType(updatedContent)

  if (documentNumber.trim() && document.companyId) {
    const taken = await isDocumentNumberTaken(
      document.companyId,
      category,
      documentNumber,
      documentId
    )
    if (taken) {
      throw new Error(`Номер ${documentNumber} уже используется для этого типа документа`)
    }
  }

  const title = buildDocumentTitle(updatedContent)

  const hasExported = Boolean(document.lastExportedAt)

  return prisma.document.update({
    where: { id: documentId },
    data: {
      contentJson: updatedContent as object,
      title,
      documentNumber: documentNumber || document.documentNumber,
      hasUnpublishedChanges: hasExported ? true : document.hasUnpublishedChanges,
      updatedAt: new Date(),
    },
    include: {
      project: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true, email: true } },
    },
  })
}

export async function executeDocumentExport(
  documentId: string,
  companyId: string,
  options?: {
    publish?: boolean
    comment?: string
    format?: ExportFormat
    contentHash?: string
    includeStamp?: boolean
    includeSignature?: boolean
  }
) {
  const document = await getDocumentForCompany(documentId, companyId)
  if (!document) {
    throw new Error('Документ не найден')
  }

  let content = parseDocumentContent(document.contentJson)
  if (!content) {
    throw new Error('Документ не содержит редактируемых данных')
  }

  content = await ensureDocumentNumberAllocated(document, content)

  const format = options?.format ?? 'both'
  const includeStamp = options?.includeStamp ?? document.includeStampOnExport
  const includeSignature = options?.includeSignature ?? document.includeSignatureOnExport

  if (
    options?.includeStamp !== undefined ||
    options?.includeSignature !== undefined
  ) {
    await prisma.document.update({
      where: { id: documentId },
      data: {
        includeStampOnExport: includeStamp,
        includeSignatureOnExport: includeSignature,
      },
    })
  }

  const companyBrandingMeta = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      stampFilePath: true,
      stampMimeType: true,
      signatureFilePath: true,
      signatureMimeType: true,
    },
  })

  const exportContentHash =
    options?.contentHash ??
    computeDocumentExportHash(content, {
      includeStamp,
      includeSignature,
      stampFilePath: companyBrandingMeta?.stampFilePath,
      signatureFilePath: companyBrandingMeta?.signatureFilePath,
    })

  let templateFilePath: string | null = null
  if (document.templateId) {
    const template = await prisma.documentTemplate.findFirst({
      where: { id: document.templateId, companyId },
    })
    if (template?.filePath && template.fileType === 'DOCX') {
      templateFilePath = template.filePath
    }
  }

  let exportResult = await exportDocumentContent(content, format, templateFilePath)

  if (includeStamp || includeSignature) {
    if (companyBrandingMeta) {
      const { loadCompanyBrandingAssets } = await import('@/lib/document-branding/apply-branding')
      const { finalizeExportWithBranding } = await import('@/lib/document-branding/finalize-export')
      const branding = await loadCompanyBrandingAssets(companyBrandingMeta)
      exportResult = await finalizeExportWithBranding(exportResult, {
        documentCategory: document.category,
        branding,
        includeStamp,
        includeSignature,
        format,
      })
    }
  }

  let xlsxPath = document.filePath
  let xlsxFileName = document.fileName
  let xlsxFileSize = document.fileSize
  let pdfPath = document.pdfFilePath
  let pdfFileName = document.pdfFileName
  let pdfFileSize = document.pdfFileSize
  let primaryMimeType = document.mimeType

  if (exportResult.xlsx) {
    const previousXlsxPath =
      document.filePath !== PLACEHOLDER_FILE ? document.filePath : null
    xlsxPath = await uploadExportedFile(
      companyId,
      exportResult.xlsx.fileName,
      exportResult.xlsx.buffer,
      exportResult.xlsx.mimeType
    )
    xlsxFileName = exportResult.xlsx.fileName
    xlsxFileSize = exportResult.xlsx.fileSize
    primaryMimeType = exportResult.xlsx.mimeType
    if (previousXlsxPath && previousXlsxPath !== xlsxPath) {
      await deleteStoredExportFile(previousXlsxPath)
    }
  }

  if (exportResult.docx) {
    const previousPath = document.filePath !== PLACEHOLDER_FILE ? document.filePath : null
    xlsxPath = await uploadExportedFile(
      companyId,
      exportResult.docx.fileName,
      exportResult.docx.buffer,
      exportResult.docx.mimeType
    )
    xlsxFileName = exportResult.docx.fileName
    xlsxFileSize = exportResult.docx.fileSize
    primaryMimeType = exportResult.docx.mimeType
    if (previousPath && previousPath !== xlsxPath) {
      await deleteStoredExportFile(previousPath)
    }
  }

  if (exportResult.pdf) {
    const previousPdfPath = document.pdfFilePath
    pdfPath = await uploadExportedFile(
      companyId,
      exportResult.pdf.fileName,
      exportResult.pdf.buffer,
      exportResult.pdf.mimeType
    )
    pdfFileName = exportResult.pdf.fileName
    pdfFileSize = exportResult.pdf.fileSize
    if (previousPdfPath && previousPdfPath !== pdfPath) {
      await deleteStoredExportFile(previousPdfPath)
    }
  }

  const newVersion = document.version + 1

  const updated = await prisma.$transaction(async (tx) => {
    if (document.filePath && document.filePath !== PLACEHOLDER_FILE && document.version >= 1) {
      await tx.documentVersion.create({
        data: {
          id: generateId(),
          version: document.version,
          fileName: document.fileName,
          filePath: document.filePath,
          fileSize: document.fileSize,
          mimeType: document.mimeType,
          pdfFileName: document.pdfFileName,
          pdfFilePath: document.pdfFilePath,
          pdfFileSize: document.pdfFileSize,
          contentJson: document.contentJson ?? undefined,
          comment: options?.comment || `Версия ${document.version}`,
          documentId: document.id,
          companyId,
        },
      })
    }

    const savedContent = normalizeSavedContent({
      ...content,
      data: exportResult.data,
    } as DocumentContent)
    const { number: exportedNumber } = getDocumentNumberAndDate(savedContent)

    return tx.document.update({
      where: { id: documentId },
      data: {
        fileName: xlsxFileName,
        filePath: xlsxPath,
        fileSize: xlsxFileSize,
        mimeType: primaryMimeType,
        pdfFileName,
        pdfFilePath: pdfPath,
        pdfFileSize,
        version: newVersion,
        title: exportResult.title,
        documentNumber: exportedNumber || document.documentNumber,
        lastExportedAt: new Date(),
        hasUnpublishedChanges: computeHasUnpublishedChangesAfterExport(format, document),
        exportContentHash,
        includeStampOnExport: includeStamp,
        includeSignatureOnExport: includeSignature,
        numberAllocated: true,
        editorStatus: options?.publish ? 'PUBLISHED' : document.editorStatus,
        isPublished: options?.publish ? true : document.isPublished,
        publishedAt: options?.publish ? new Date() : document.publishedAt,
        contentJson: savedContent as object,
        updatedAt: new Date(),
      },
      include: {
        project: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true, email: true } },
      },
    })
  })

  return { document: updated, exportResult }
}

export async function publishDocument(documentId: string, companyId: string) {
  const document = await getDocumentForCompany(documentId, companyId)
  if (!document) {
    throw new Error('Документ не найден')
  }

  return prisma.document.update({
    where: { id: documentId },
    data: {
      editorStatus: 'PUBLISHED',
      isPublished: true,
      publishedAt: new Date(),
      hasUnpublishedChanges: false,
    },
    include: {
      project: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true, email: true } },
    },
  })
}

export async function listDocumentVersions(documentId: string, companyId: string) {
  const document = await getDocumentForCompany(documentId, companyId)
  if (!document) {
    throw new Error('Документ не найден')
  }

  const versions = await prisma.documentVersion.findMany({
    where: { documentId },
    orderBy: { version: 'desc' },
  })

  const current =
    document.filePath !== PLACEHOLDER_FILE
      ? {
          version: document.version,
          fileName: document.fileName,
          filePath: document.filePath,
          fileSize: document.fileSize,
          mimeType: document.mimeType,
          pdfFileName: document.pdfFileName,
          pdfFilePath: document.pdfFilePath,
          pdfFileSize: document.pdfFileSize,
          contentJson: document.contentJson,
          createdAt: document.lastExportedAt || document.updatedAt,
          isCurrent: true,
        }
      : null

  return {
    current,
    versions: versions.map((v) => ({
      id: v.id,
      version: v.version,
      fileName: v.fileName,
      filePath: v.filePath,
      fileSize: v.fileSize,
      mimeType: v.mimeType,
      pdfFileName: v.pdfFileName,
      pdfFilePath: v.pdfFilePath,
      pdfFileSize: v.pdfFileSize,
      contentJson: v.contentJson,
      comment: v.comment,
      createdAt: v.createdAt,
      isCurrent: false,
    })),
  }
}

export async function restoreDocumentVersion(
  documentId: string,
  companyId: string,
  versionId: string
) {
  const document = await getDocumentForCompany(documentId, companyId)
  if (!document) {
    throw new Error('Документ не найден')
  }

  const version = await prisma.documentVersion.findFirst({
    where: { id: versionId, documentId },
  })
  if (!version?.contentJson) {
    throw new Error('Версия не найдена или не содержит данных')
  }

  const content = parseDocumentContent(version.contentJson)
  if (!content) {
    throw new Error('Некорректные данные версии')
  }

  return saveDocumentContent(documentId, companyId, content)
}

export async function exportDocumentXml(documentId: string, companyId: string): Promise<never> {
  const document = await getDocumentForCompany(documentId, companyId)
  if (!document) {
    throw new Error('Документ не найден')
  }

  const content = parseDocumentContent(document.contentJson)
  if (!content) {
    throw new Error('Документ не содержит данных для XML-экспорта')
  }

  const typeDef = getDocumentTypeDefinition(getDocumentContentType(content))
  if (!typeDef.edoXmlFormatId) {
    throw new Error(`XML-экспорт недоступен для типа «${typeDef.label}»`)
  }

  const { EdoXmlRendererNotImplementedError } = await import(
    '@/lib/document-renderer/edo/xml-renderer-stub'
  )
  throw new EdoXmlRendererNotImplementedError(typeDef.edoXmlFormatId)
}

export function parseSourceMeta(raw: unknown): DocumentSourceMeta | null {
  if (!raw || typeof raw !== 'object') return null
  const meta = raw as DocumentSourceMeta
  if (!meta.projectId) return null
  return meta
}

export type { DocumentEditorStatus }

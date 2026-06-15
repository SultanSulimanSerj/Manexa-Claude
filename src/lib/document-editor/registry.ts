import type { DocumentContentType, ValidationResult } from './types'
import { validateUpdDocument } from './upd-validator'
import { validateFnsFormDocument } from './fns-validator'
import type { PrintRendererKind } from '@/lib/document-renderer/types'
import { UPD_EDO_FORMAT_ID } from '@/lib/document-renderer/edo/xml-renderer-stub'

export interface DocumentTypeDefinition {
  type: DocumentContentType
  category: string
  label: string
  mimeType: string
  fileExtension: string
  printRenderer: PrintRendererKind
  edoXmlFormatId?: string
  supportsEditor: boolean
  validate?: (content: unknown) => ValidationResult
}

export const DOCUMENT_TYPE_REGISTRY: Record<DocumentContentType, DocumentTypeDefinition> = {
  UPD: {
    type: 'UPD',
    category: 'UPD',
    label: 'УПД',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileExtension: 'xlsx',
    printRenderer: 'xlsx',
    edoXmlFormatId: UPD_EDO_FORMAT_ID,
    supportsEditor: true,
    validate: (content) => {
      const data = (content as { data?: unknown })?.data
      return validateUpdDocument(data as Parameters<typeof validateUpdDocument>[0])
    },
  },
  KS2: {
    type: 'KS2',
    category: 'KS2',
    label: 'КС-2',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileExtension: 'xlsx',
    printRenderer: 'xlsx',
    supportsEditor: true,
    validate: (content) => {
      const data = (content as { data?: unknown })?.data as Parameters<
        typeof validateFnsFormDocument
      >[0]
      return validateFnsFormDocument(data, 'КС-2', 3)
    },
  },
  KS3: {
    type: 'KS3',
    category: 'KS3',
    label: 'КС-3',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileExtension: 'xlsx',
    printRenderer: 'xlsx',
    supportsEditor: true,
    validate: (content) => {
      const data = (content as { data?: unknown })?.data as Parameters<
        typeof validateFnsFormDocument
      >[0]
      return validateFnsFormDocument(data, 'КС-3', 3)
    },
  },
  INVOICE: {
    type: 'INVOICE',
    category: 'INVOICE',
    label: 'Счёт на оплату',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileExtension: 'docx',
    printRenderer: 'docx',
    supportsEditor: true,
    validate: (content) => {
      const data = (content as { data?: unknown })?.data as Parameters<
        typeof validateFnsFormDocument
      >[0]
      return validateFnsFormDocument(data, 'Счёт')
    },
  },
  SERVICE_ACT: {
    type: 'SERVICE_ACT',
    category: 'SERVICE_ACT',
    label: 'Акт приёмки услуг',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileExtension: 'docx',
    printRenderer: 'docx',
    supportsEditor: true,
    validate: (content) => {
      const data = (content as { data?: unknown })?.data as Parameters<
        typeof validateFnsFormDocument
      >[0]
      return validateFnsFormDocument(data, 'Акт')
    },
  },
  CONTRACT: {
    type: 'CONTRACT',
    category: 'CONTRACT',
    label: 'Договор подряда',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileExtension: 'docx',
    printRenderer: 'docx',
    supportsEditor: true,
  },
  COMMERCIAL_OFFER: {
    type: 'COMMERCIAL_OFFER',
    category: 'COMMERCIAL',
    label: 'Коммерческое предложение',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileExtension: 'docx',
    printRenderer: 'docx',
    supportsEditor: true,
  },
}

export function getDocumentTypeDefinition(type: DocumentContentType): DocumentTypeDefinition {
  return DOCUMENT_TYPE_REGISTRY[type]
}

export function isDocxEditorType(type: DocumentContentType): boolean {
  return getDocumentTypeDefinition(type).printRenderer === 'docx'
}

export function listEditableDocumentTypes(): DocumentTypeDefinition[] {
  return Object.values(DOCUMENT_TYPE_REGISTRY).filter((d) => d.supportsEditor)
}

const LEGACY_CATEGORY_MAP: Record<string, DocumentContentType> = {
  UPD: 'UPD',
  KS2: 'KS2',
  KS3: 'KS3',
  INVOICE: 'INVOICE',
  SERVICE_ACT: 'SERVICE_ACT',
  CONTRACT: 'CONTRACT',
  COMMERCIAL: 'COMMERCIAL_OFFER',
}

const API_TYPE_MAP: Record<string, DocumentContentType | null> = {
  upd: 'UPD',
  ks2: 'KS2',
  ks3: 'KS3',
  invoice: 'INVOICE',
  'service-act': 'SERVICE_ACT',
  contract: 'CONTRACT',
  'commercial-offer': 'COMMERCIAL_OFFER',
}

export function categoryToContentType(category: string | null | undefined): DocumentContentType | null {
  if (!category) return null
  return LEGACY_CATEGORY_MAP[category] ?? null
}

export function apiDocumentTypeToContentType(apiType: string): DocumentContentType | null {
  return API_TYPE_MAP[apiType] ?? null
}

export function contentTypeToApiDocumentType(type: DocumentContentType): string {
  const entry = Object.entries(API_TYPE_MAP).find(([, v]) => v === type)
  return entry?.[0] ?? type.toLowerCase()
}

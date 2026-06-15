import type { UpdDocumentData } from '@/lib/upd-generator'
import type { Ks2DocumentData, Ks3DocumentData, InvoiceDocumentData, ServiceActDocumentData } from '@/lib/document-renderer/fns-form-types'
import type { CommercialOfferData } from '@/lib/commercial-offer-generator'
import type { ContractData } from '@/lib/document-generator'

export const DOCUMENT_CONTENT_SCHEMA_VERSION = 1

export type DocumentContentType =
  | 'UPD'
  | 'KS2'
  | 'KS3'
  | 'INVOICE'
  | 'SERVICE_ACT'
  | 'CONTRACT'
  | 'COMMERCIAL_OFFER'

export interface DocumentSourceMeta {
  projectId: string
  prefillAt: string
  estimateIds?: string[]
  stageIds?: string[]
  commercialOfferId?: string
  invoiceDocumentId?: string
  contractDocumentId?: string
}

/** @deprecated используйте DocumentSourceMeta */
export type UpdSourceMeta = DocumentSourceMeta

export interface UpdDocumentContent {
  type: 'UPD'
  schemaVersion: number
  data: UpdDocumentData
}

export interface Ks2DocumentContent {
  type: 'KS2'
  schemaVersion: number
  data: Ks2DocumentData
}

export interface Ks3DocumentContent {
  type: 'KS3'
  schemaVersion: number
  data: Ks3DocumentData
}

export interface InvoiceDocumentContent {
  type: 'INVOICE'
  schemaVersion: number
  data: InvoiceDocumentData
}

export interface ServiceActDocumentContent {
  type: 'SERVICE_ACT'
  schemaVersion: number
  data: ServiceActDocumentData
}

export interface CommercialOfferDocumentContent {
  type: 'COMMERCIAL_OFFER'
  schemaVersion: number
  data: CommercialOfferData
}

export interface ContractDocumentContent {
  type: 'CONTRACT'
  schemaVersion: number
  data: ContractData
}

export type DocumentContent =
  | UpdDocumentContent
  | Ks2DocumentContent
  | Ks3DocumentContent
  | InvoiceDocumentContent
  | ServiceActDocumentContent
  | CommercialOfferDocumentContent
  | ContractDocumentContent

export interface UpdEditableLineItem {
  id: string
  lineNumber: number
  name: string
  description?: string | null
  quantity: number
  unit: string
  unitPriceWithoutVat: number
  totalWithoutVat: number
  vatRate: number
  vatAmount: number
  totalWithVat: number
  estimateId?: string
  estimateName?: string
  category?: string
}

export interface ValidationIssue {
  field: string
  message: string
  severity: 'error' | 'warning'
}

export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
}

export function isUpdContent(content: unknown): content is UpdDocumentContent {
  return (
    typeof content === 'object' &&
    content !== null &&
    (content as UpdDocumentContent).type === 'UPD' &&
    typeof (content as UpdDocumentContent).data === 'object'
  )
}

export function isKs2Content(content: unknown): content is Ks2DocumentContent {
  return (
    typeof content === 'object' &&
    content !== null &&
    (content as Ks2DocumentContent).type === 'KS2' &&
    typeof (content as Ks2DocumentContent).data === 'object'
  )
}

export function isKs3Content(content: unknown): content is Ks3DocumentContent {
  return (
    typeof content === 'object' &&
    content !== null &&
    (content as Ks3DocumentContent).type === 'KS3' &&
    typeof (content as Ks3DocumentContent).data === 'object'
  )
}

export function isInvoiceContent(content: unknown): content is InvoiceDocumentContent {
  return (
    typeof content === 'object' &&
    content !== null &&
    (content as InvoiceDocumentContent).type === 'INVOICE' &&
    typeof (content as InvoiceDocumentContent).data === 'object'
  )
}

export function isServiceActContent(content: unknown): content is ServiceActDocumentContent {
  return (
    typeof content === 'object' &&
    content !== null &&
    (content as ServiceActDocumentContent).type === 'SERVICE_ACT' &&
    typeof (content as ServiceActDocumentContent).data === 'object'
  )
}

export function isCommercialOfferContent(
  content: unknown
): content is CommercialOfferDocumentContent {
  return (
    typeof content === 'object' &&
    content !== null &&
    (content as CommercialOfferDocumentContent).type === 'COMMERCIAL_OFFER' &&
    typeof (content as CommercialOfferDocumentContent).data === 'object'
  )
}

export function isContractContent(content: unknown): content is ContractDocumentContent {
  return (
    typeof content === 'object' &&
    content !== null &&
    (content as ContractDocumentContent).type === 'CONTRACT' &&
    typeof (content as ContractDocumentContent).data === 'object'
  )
}

export function getDocumentContentType(content: DocumentContent): DocumentContentType {
  return content.type
}

export function parseDocumentContent(raw: unknown): DocumentContent | null {
  if (!raw || typeof raw !== 'object') return null
  if (isUpdContent(raw)) return raw
  if (isKs2Content(raw)) return raw
  if (isKs3Content(raw)) return raw
  if (isInvoiceContent(raw)) return raw
  if (isServiceActContent(raw)) return raw
  if (isCommercialOfferContent(raw)) return raw
  if (isContractContent(raw)) return raw
  return null
}

export function isEditableDocumentContent(content: unknown): content is DocumentContent {
  return (
    isUpdContent(content) ||
    isKs2Content(content) ||
    isKs3Content(content) ||
    isInvoiceContent(content) ||
    isServiceActContent(content) ||
    isCommercialOfferContent(content) ||
    isContractContent(content)
  )
}

export function buildSourceMeta(
  projectId: string,
  extra?: Partial<Omit<DocumentSourceMeta, 'projectId' | 'prefillAt'>>
): DocumentSourceMeta {
  return {
    projectId,
    prefillAt: new Date().toISOString(),
    estimateIds: extra?.estimateIds ?? [],
    stageIds: extra?.stageIds ?? [],
    commercialOfferId: extra?.commercialOfferId,
    invoiceDocumentId: extra?.invoiceDocumentId,
    contractDocumentId: extra?.contractDocumentId,
  }
}

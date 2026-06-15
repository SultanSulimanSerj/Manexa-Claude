import type { DocumentLineItem, DocumentMeta, DocumentParty } from '@/lib/document-editor/common'

/** Базовые данные для форм ФНС (УПД, КС-2, КС-3) */
export interface FnsFormDocumentData extends DocumentMeta {
  seller: DocumentParty
  buyer: DocumentParty
  items: DocumentLineItem[]
  totals: {
    totalWithoutVat: number
    totalVat: number
    totalWithVat: number
    hasVat: boolean
  }
  basisText?: string
  periodFrom?: string
  periodTo?: string
}

export interface Ks2DocumentData extends FnsFormDocumentData {
  objectName: string
  contractBasis: string
}

export interface Ks3DocumentData extends FnsFormDocumentData {
  objectName: string
  contractBasis: string
  ks2DocumentNumbers?: string[]
}

export interface InvoiceDocumentData extends DocumentMeta {
  seller: DocumentParty
  buyer: DocumentParty
  items: DocumentLineItem[]
  totals: {
    totalWithoutVat: number
    totalVat: number
    totalWithVat: number
    hasVat: boolean
  }
  paymentPurpose?: string
  dueDate?: string
}

export interface ServiceActDocumentData extends DocumentMeta {
  seller: DocumentParty
  buyer: DocumentParty
  items: DocumentLineItem[]
  totals: {
    totalWithoutVat: number
    totalVat: number
    totalWithVat: number
    hasVat: boolean
  }
  basisText?: string
}

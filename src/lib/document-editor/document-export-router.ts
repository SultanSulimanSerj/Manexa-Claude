import type { DocumentContent } from './types'
import {
  isUpdContent,
  isKs2Content,
  isKs3Content,
  isInvoiceContent,
  isServiceActContent,
  isCommercialOfferContent,
  isContractContent,
} from './types'
import {
  exportCommercialOfferContent,
  exportContractContent,
} from './export-docx'
import { exportUpdContent, type ExportFormat, uploadUpdFile } from './export-upd'
import {
  exportKs2Content,
  exportKs3Content,
  exportInvoiceContent,
  exportServiceActContent,
  uploadDocumentFile,
} from './export-fns'

export type { ExportFormat }

export interface RoutedExportResult {
  primaryMimeType: string
  primaryFileName: string
  title: string
  xlsx?: { buffer: Buffer; fileName: string; fileSize: number; mimeType: string }
  pdf?: { buffer: Buffer; fileName: string; fileSize: number; mimeType: string }
  docx?: { buffer: Buffer; fileName: string; fileSize: number; mimeType: string }
  data: unknown
}

export async function exportDocumentContent(
  content: DocumentContent,
  format: ExportFormat = 'both',
  templateFilePath?: string | null
): Promise<RoutedExportResult> {
  if (isUpdContent(content)) {
    const result = await exportUpdContent(content, format)
    return {
      primaryMimeType: result.xlsx?.mimeType ?? 'application/pdf',
      primaryFileName: result.xlsx?.fileName ?? result.pdf?.fileName ?? '',
      title: `УПД № ${result.data.documentNumber} от ${result.data.documentDate}`,
      xlsx: result.xlsx,
      pdf: result.pdf,
      data: result.data,
    }
  }

  if (isKs2Content(content)) {
    const result = await exportKs2Content(content, format)
    return {
      primaryMimeType: result.xlsx?.mimeType ?? 'application/pdf',
      primaryFileName: result.xlsx?.fileName ?? result.pdf?.fileName ?? '',
      title: `КС-2 № ${result.data.documentNumber} от ${result.data.documentDate}`,
      xlsx: result.xlsx,
      pdf: result.pdf,
      data: result.data,
    }
  }

  if (isKs3Content(content)) {
    const result = await exportKs3Content(content, format)
    return {
      primaryMimeType: result.xlsx?.mimeType ?? 'application/pdf',
      primaryFileName: result.xlsx?.fileName ?? result.pdf?.fileName ?? '',
      title: `КС-3 № ${result.data.documentNumber} от ${result.data.documentDate}`,
      xlsx: result.xlsx,
      pdf: result.pdf,
      data: result.data,
    }
  }

  if (isInvoiceContent(content)) {
    const result = await exportInvoiceContent(content, format, templateFilePath)
    return {
      primaryMimeType: result.docx?.mimeType ?? result.pdf?.mimeType ?? '',
      primaryFileName: result.docx?.fileName ?? result.pdf?.fileName ?? '',
      title: `Счёт № ${result.data.documentNumber} от ${result.data.documentDate}`,
      docx: result.docx,
      pdf: result.pdf,
      data: result.data,
    }
  }

  if (isServiceActContent(content)) {
    const result = await exportServiceActContent(content, format, templateFilePath)
    return {
      primaryMimeType: result.docx?.mimeType ?? result.pdf?.mimeType ?? '',
      primaryFileName: result.docx?.fileName ?? result.pdf?.fileName ?? '',
      title: `Акт № ${result.data.documentNumber} от ${result.data.documentDate}`,
      docx: result.docx,
      pdf: result.pdf,
      data: result.data,
    }
  }

  if (isCommercialOfferContent(content)) {
    const result = await exportCommercialOfferContent(content, format, templateFilePath)
    return {
      primaryMimeType: result.docx?.mimeType ?? result.pdf?.mimeType ?? '',
      primaryFileName: result.docx?.fileName ?? result.pdf?.fileName ?? '',
      title: `КП № ${result.data.offerNumber} от ${result.data.offerDate}`,
      docx: result.docx,
      pdf: result.pdf,
      data: result.data,
    }
  }

  if (isContractContent(content)) {
    const result = await exportContractContent(content, format, templateFilePath)
    return {
      primaryMimeType: result.docx?.mimeType ?? result.pdf?.mimeType ?? '',
      primaryFileName: result.docx?.fileName ?? result.pdf?.fileName ?? '',
      title: `Договор № ${result.data.contractNumber} от ${result.data.contractDate}`,
      docx: result.docx,
      pdf: result.pdf,
      data: result.data,
    }
  }

  throw new Error('Неподдерживаемый тип документа для экспорта')
}

export async function uploadExportedFile(
  companyId: string,
  fileName: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  return uploadDocumentFile(companyId, fileName, buffer, mimeType)
}

/** @deprecated используйте uploadExportedFile */
export { uploadUpdFile }

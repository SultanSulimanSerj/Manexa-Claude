import { uploadFile } from '@/lib/storage'
import { generateId } from '@/lib/id-generator'
import { XLSX_MIME, PDF_MIME } from '@/lib/upd-generator'
import { renderKs2Xlsx } from '@/lib/document-renderer/ks2/ks2-xlsx-renderer'
import { renderKs3Xlsx } from '@/lib/document-renderer/ks3/ks3-xlsx-renderer'
import { renderInvoiceDocx } from '@/lib/document-renderer/invoice/invoice-docx-renderer'
import { renderServiceActDocx } from '@/lib/document-renderer/service-act/service-act-docx-renderer'
import type {
  Ks2DocumentContent,
  Ks3DocumentContent,
  InvoiceDocumentContent,
  ServiceActDocumentContent,
} from './types'
import { validateFnsFormDocument } from './fns-validator'
import { convertDocxBufferToPdf, convertXlsxBufferToPdf } from './xlsx-to-pdf'
import type { ExportFormat } from './export-upd'

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export interface FileExport {
  buffer: Buffer
  fileName: string
  fileSize: number
  mimeType: string
}

export interface FnsExportResult {
  xlsx?: FileExport
  pdf?: FileExport
  docx?: FileExport
}

function assertValid(data: unknown, label: string) {
  const validation = validateFnsFormDocument(
    data as Parameters<typeof validateFnsFormDocument>[0],
    label
  )
  if (!validation.valid) {
    const messages = validation.issues
      .filter((i) => i.severity === 'error')
      .map((i) => i.message)
      .join('; ')
    throw new Error(messages || 'Документ не прошёл валидацию')
  }
}

export function buildKs2FileName(documentNumber: string, documentDate: string): string {
  return `КС-2 № ${documentNumber} от ${documentDate}.xlsx`
}

export function buildKs3FileName(documentNumber: string, documentDate: string): string {
  return `КС-3 № ${documentNumber} от ${documentDate}.xlsx`
}

export function buildInvoiceFileName(documentNumber: string, documentDate: string): string {
  return `Исходящий счет на оплату № ${documentNumber} от ${documentDate}.docx`
}

export async function exportKs2Content(
  content: Ks2DocumentContent,
  format: ExportFormat = 'both'
): Promise<FnsExportResult & { data: Ks2DocumentContent['data'] }> {
  const data = content.data
  assertValid(data, 'КС-2')
  const result: FnsExportResult = {}
  const xlsxFileName = buildKs2FileName(data.documentNumber, data.documentDate)

  if (format === 'xlsx' || format === 'both') {
    const buffer = await renderKs2Xlsx(data)
    result.xlsx = { buffer, fileName: xlsxFileName, fileSize: buffer.length, mimeType: XLSX_MIME }
  }

  if (format === 'pdf' || format === 'both') {
    const xlsxBuffer = result.xlsx?.buffer ?? (await renderKs2Xlsx(data))
    const pdfBuffer = await convertXlsxBufferToPdf(xlsxBuffer, xlsxFileName)
    result.pdf = {
      buffer: pdfBuffer,
      fileName: xlsxFileName.replace('.xlsx', '.pdf'),
      fileSize: pdfBuffer.length,
      mimeType: PDF_MIME,
    }
    if (format === 'pdf' && !result.xlsx) {
      result.xlsx = {
        buffer: xlsxBuffer,
        fileName: xlsxFileName,
        fileSize: xlsxBuffer.length,
        mimeType: XLSX_MIME,
      }
    }
  }

  return { ...result, data }
}

export async function exportKs3Content(
  content: Ks3DocumentContent,
  format: ExportFormat = 'both'
): Promise<FnsExportResult & { data: Ks3DocumentContent['data'] }> {
  const data = content.data
  assertValid(data, 'КС-3')
  const result: FnsExportResult = {}
  const xlsxFileName = buildKs3FileName(data.documentNumber, data.documentDate)

  if (format === 'xlsx' || format === 'both') {
    const buffer = await renderKs3Xlsx(data)
    result.xlsx = { buffer, fileName: xlsxFileName, fileSize: buffer.length, mimeType: XLSX_MIME }
  }

  if (format === 'pdf' || format === 'both') {
    const xlsxBuffer = result.xlsx?.buffer ?? (await renderKs3Xlsx(data))
    const pdfBuffer = await convertXlsxBufferToPdf(xlsxBuffer, xlsxFileName)
    result.pdf = {
      buffer: pdfBuffer,
      fileName: xlsxFileName.replace('.xlsx', '.pdf'),
      fileSize: pdfBuffer.length,
      mimeType: PDF_MIME,
    }
    if (format === 'pdf' && !result.xlsx) {
      result.xlsx = {
        buffer: xlsxBuffer,
        fileName: xlsxFileName,
        fileSize: xlsxBuffer.length,
        mimeType: XLSX_MIME,
      }
    }
  }

  return { ...result, data }
}

export function buildServiceActFileName(documentNumber: string, documentDate: string): string {
  return `Исходящий акт приемки услуг № ${documentNumber} от ${documentDate}.docx`
}

export async function exportInvoiceContent(
  content: InvoiceDocumentContent,
  format: ExportFormat = 'both',
  templateFilePath?: string | null
): Promise<FnsExportResult & { data: InvoiceDocumentContent['data'] }> {
  const data = content.data
  assertValid(data, 'Счёт')
  const result: FnsExportResult = {}
  const docxFileName = buildInvoiceFileName(data.documentNumber, data.documentDate)

  if (format === 'xlsx' || format === 'pdf' || format === 'both') {
    const buffer = await renderInvoiceDocx(data, templateFilePath)
    result.docx = { buffer, fileName: docxFileName, fileSize: buffer.length, mimeType: DOCX_MIME }
  }

  if (format === 'pdf' || format === 'both') {
    const docxBuffer = result.docx?.buffer ?? (await renderInvoiceDocx(data, templateFilePath))
    if (!result.docx) {
      result.docx = {
        buffer: docxBuffer,
        fileName: docxFileName,
        fileSize: docxBuffer.length,
        mimeType: DOCX_MIME,
      }
    }
    const pdfBuffer = await convertDocxBufferToPdf(docxBuffer, docxFileName)
    result.pdf = {
      buffer: pdfBuffer,
      fileName: docxFileName.replace(/\.docx$/i, '.pdf'),
      fileSize: pdfBuffer.length,
      mimeType: PDF_MIME,
    }
  }

  return { ...result, data }
}

export async function exportServiceActContent(
  content: ServiceActDocumentContent,
  format: ExportFormat = 'both',
  templateFilePath?: string | null
): Promise<FnsExportResult & { data: ServiceActDocumentContent['data'] }> {
  const data = content.data
  assertValid(data, 'Акт')
  const result: FnsExportResult = {}
  const docxFileName = buildServiceActFileName(data.documentNumber, data.documentDate)

  if (format === 'xlsx' || format === 'pdf' || format === 'both') {
    const buffer = await renderServiceActDocx(data, templateFilePath)
    result.docx = { buffer, fileName: docxFileName, fileSize: buffer.length, mimeType: DOCX_MIME }
  }

  if (format === 'pdf' || format === 'both') {
    const docxBuffer = result.docx?.buffer ?? (await renderServiceActDocx(data, templateFilePath))
    if (!result.docx) {
      result.docx = {
        buffer: docxBuffer,
        fileName: docxFileName,
        fileSize: docxBuffer.length,
        mimeType: DOCX_MIME,
      }
    }
    const pdfBuffer = await convertDocxBufferToPdf(docxBuffer, docxFileName)
    result.pdf = {
      buffer: pdfBuffer,
      fileName: docxFileName.replace(/\.docx$/i, '.pdf'),
      fileSize: pdfBuffer.length,
      mimeType: PDF_MIME,
    }
  }

  return { ...result, data }
}

export async function uploadDocumentFile(
  companyId: string,
  fileName: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const storageKey = `documents/${companyId}/${generateId()}_${fileName}`
  await uploadFile(storageKey, buffer, mimeType)
  return storageKey
}

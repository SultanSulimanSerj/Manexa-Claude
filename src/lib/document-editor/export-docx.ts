import { renderCommercialOfferDocx, renderContractDocx } from '@/lib/document-renderer/docx-renderer'
import {
  renderCommercialOfferFromTemplate,
  renderContractFromTemplate,
} from '@/lib/document-renderer/template-docx-renderer'
import { PDF_MIME } from '@/lib/upd-generator'
import { uploadFile } from '@/lib/storage'
import { generateId } from '@/lib/id-generator'
import type { CommercialOfferDocumentContent, ContractDocumentContent } from './types'
import type { ExportFormat } from './export-upd'
import type { FileExport, FnsExportResult } from './export-fns'
import { convertDocxBufferToPdf } from './xlsx-to-pdf'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export interface DocxExportResult {
  buffer: Buffer
  fileName: string
  fileSize: number
  mimeType: string
}

async function appendPdfFromDocx(
  result: FnsExportResult,
  docxFileName: string,
  format: ExportFormat,
  renderDocx: () => Promise<Buffer>
): Promise<void> {
  if (format !== 'pdf' && format !== 'both') return

  const docxBuffer = result.docx?.buffer ?? (await renderDocx())
  if (!result.docx && (format === 'pdf' || format === 'both')) {
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

async function renderCommercialOfferBuffer(
  content: CommercialOfferDocumentContent,
  templateFilePath?: string | null
): Promise<Buffer> {
  if (templateFilePath) {
    return renderCommercialOfferFromTemplate(templateFilePath, content)
  }
  return renderCommercialOfferDocx(content.data)
}

async function renderContractBuffer(
  content: ContractDocumentContent,
  templateFilePath?: string | null
): Promise<Buffer> {
  if (templateFilePath) {
    return renderContractFromTemplate(templateFilePath, content)
  }
  return renderContractDocx(content.data)
}

export async function exportCommercialOfferContent(
  content: CommercialOfferDocumentContent,
  format: ExportFormat = 'both',
  templateFilePath?: string | null
): Promise<FnsExportResult & { data: CommercialOfferDocumentContent['data'] }> {
  const data = content.data
  const result: FnsExportResult = {}
  const fileName = `КП_№${data.offerNumber}.docx`

  if (format === 'xlsx' || format === 'pdf' || format === 'both') {
    const buffer = await renderCommercialOfferBuffer(content, templateFilePath)
    result.docx = { buffer, fileName, fileSize: buffer.length, mimeType: DOCX_MIME }
  }

  await appendPdfFromDocx(result, fileName, format, () =>
    renderCommercialOfferBuffer(content, templateFilePath)
  )

  return { ...result, data }
}

export async function exportContractContent(
  content: ContractDocumentContent,
  format: ExportFormat = 'both',
  templateFilePath?: string | null
): Promise<FnsExportResult & { data: ContractDocumentContent['data'] }> {
  const data = content.data
  const result: FnsExportResult = {}
  const fileName = `Договор_подряда_№${data.contractNumber}.docx`

  if (format === 'xlsx' || format === 'pdf' || format === 'both') {
    const buffer = await renderContractBuffer(content, templateFilePath)
    result.docx = { buffer, fileName, fileSize: buffer.length, mimeType: DOCX_MIME }
  }

  await appendPdfFromDocx(result, fileName, format, () =>
    renderContractBuffer(content, templateFilePath)
  )

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

export type { FileExport }

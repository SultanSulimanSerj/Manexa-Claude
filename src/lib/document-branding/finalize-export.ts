import type { ExportFormat } from '@/lib/document-editor/export-upd'
import { convertDocxBufferToPdf, convertXlsxBufferToPdf } from '@/lib/document-editor/xlsx-to-pdf'
import { PDF_MIME } from '@/lib/upd-generator'
import type { RoutedExportResult } from '@/lib/document-editor/document-export-router'
import {
  applyBrandingToDocumentBuffer,
  type CompanyBrandingAssets,
} from './apply-branding'

export async function finalizeExportWithBranding(
  result: RoutedExportResult,
  options: {
    documentCategory: string | null | undefined
    branding: CompanyBrandingAssets
    includeStamp: boolean
    includeSignature: boolean
    format: ExportFormat
  }
): Promise<RoutedExportResult> {
  const { documentCategory, branding, includeStamp, includeSignature, format } = options

  if (!includeStamp && !includeSignature) {
    return result
  }

  if (result.xlsx) {
    const buffer = await applyBrandingToDocumentBuffer({
      buffer: result.xlsx.buffer,
      mimeType: result.xlsx.mimeType,
      documentCategory,
      branding,
      includeStamp,
      includeSignature,
    })
    result.xlsx = { ...result.xlsx, buffer, fileSize: buffer.length }
  }

  if (result.docx) {
    const buffer = await applyBrandingToDocumentBuffer({
      buffer: result.docx.buffer,
      mimeType: result.docx.mimeType,
      documentCategory,
      branding,
      includeStamp,
      includeSignature,
    })
    result.docx = { ...result.docx, buffer, fileSize: buffer.length }
  }

  if (format === 'pdf' || format === 'both') {
    const source = result.xlsx ?? result.docx
    if (source) {
      const pdfBuffer =
        result.xlsx != null
          ? await convertXlsxBufferToPdf(source.buffer, source.fileName)
          : await convertDocxBufferToPdf(source.buffer, source.fileName)
      const pdfFileName = source.fileName.replace(/\.(xlsx|docx)$/i, '.pdf')
      result.pdf = {
        buffer: pdfBuffer,
        fileName: pdfFileName,
        fileSize: pdfBuffer.length,
        mimeType: PDF_MIME,
      }
    }
  }

  return result
}

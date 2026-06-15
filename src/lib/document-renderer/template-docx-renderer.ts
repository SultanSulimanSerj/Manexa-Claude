import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import { assertValidDocxBuffer, DOCX_CORRUPT_MESSAGE } from '@/lib/docx-buffer'
import { getFileBuffer } from '@/lib/storage'
import type {
  CommercialOfferDocumentContent,
  ContractDocumentContent,
  InvoiceDocumentContent,
} from '@/lib/document-editor/types'
import {
  mapCommercialOfferToTemplateData,
  mapContractToTemplateData,
  mapInvoiceToTemplateData,
} from '@/lib/template-mapper'

export async function renderDocxFromTemplateBuffer(
  templateBuffer: Buffer,
  data: Record<string, unknown>
): Promise<Buffer> {
  assertValidDocxBuffer(templateBuffer, 'Шаблон договора')
  let zip: PizZip
  try {
    zip = new PizZip(templateBuffer)
  } catch {
    throw new Error(DOCX_CORRUPT_MESSAGE)
  }
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
  })
  doc.render(data)
  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer
}

export async function renderDocxFromTemplateFile(
  filePath: string,
  data: Record<string, unknown>
): Promise<Buffer> {
  const buffer = await getFileBuffer(filePath)
  return renderDocxFromTemplateBuffer(buffer, data)
}

export async function renderContractFromTemplate(
  filePath: string,
  content: ContractDocumentContent
): Promise<Buffer> {
  return renderDocxFromTemplateFile(filePath, mapContractToTemplateData(content))
}

export async function renderCommercialOfferFromTemplate(
  filePath: string,
  content: CommercialOfferDocumentContent
): Promise<Buffer> {
  return renderDocxFromTemplateFile(filePath, mapCommercialOfferToTemplateData(content))
}

export async function renderInvoiceFromTemplate(
  filePath: string,
  content: InvoiceDocumentContent
): Promise<Buffer> {
  return renderDocxFromTemplateFile(filePath, mapInvoiceToTemplateData(content))
}

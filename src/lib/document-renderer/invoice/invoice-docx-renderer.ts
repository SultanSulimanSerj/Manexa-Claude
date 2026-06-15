import fs from 'fs'
import path from 'path'
import type { InvoiceDocumentData } from '../fns-form-types'
import { mapInvoiceToTemplateData } from '@/lib/template-mapper'
import type { InvoiceDocumentContent } from '@/lib/document-editor/types'
import {
  renderDocxFromTemplateBuffer,
  renderDocxFromTemplateFile,
} from '@/lib/document-renderer/template-docx-renderer'

const TEMPLATE_PATH = path.join(
  process.cwd(),
  'assets/templates/invoice-template.docx'
)

function toInvoiceContent(data: InvoiceDocumentData): InvoiceDocumentContent {
  return { type: 'INVOICE', schemaVersion: 1, data }
}

export async function renderInvoiceDocx(
  data: InvoiceDocumentData,
  templateFilePath?: string | null
): Promise<Buffer> {
  const templateData = mapInvoiceToTemplateData(toInvoiceContent(data))

  if (templateFilePath) {
    return renderDocxFromTemplateFile(templateFilePath, templateData)
  }

  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(
      `Шаблон счёта не найден: ${TEMPLATE_PATH}. Запустите: npx tsx scripts/prepare-invoice-template.ts`
    )
  }

  const content = fs.readFileSync(TEMPLATE_PATH)
  return renderDocxFromTemplateBuffer(content, templateData)
}

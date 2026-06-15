import fs from 'fs'
import path from 'path'
import type { ServiceActDocumentData } from '../fns-form-types'
import { mapServiceActToTemplateData } from '@/lib/template-mapper'
import type { ServiceActDocumentContent } from '@/lib/document-editor/types'
import {
  renderDocxFromTemplateBuffer,
  renderDocxFromTemplateFile,
} from '@/lib/document-renderer/template-docx-renderer'

const TEMPLATE_PATH = path.join(
  process.cwd(),
  'assets/templates/service-act-template.docx'
)

function toServiceActContent(data: ServiceActDocumentData): ServiceActDocumentContent {
  return { type: 'SERVICE_ACT', schemaVersion: 1, data }
}

export async function renderServiceActDocx(
  data: ServiceActDocumentData,
  templateFilePath?: string | null
): Promise<Buffer> {
  const templateData = mapServiceActToTemplateData(toServiceActContent(data))

  if (templateFilePath) {
    return renderDocxFromTemplateFile(templateFilePath, templateData)
  }

  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(
      `Шаблон акта не найден: ${TEMPLATE_PATH}. Запустите: npx tsx scripts/prepare-service-act-template.ts`
    )
  }

  const content = fs.readFileSync(TEMPLATE_PATH)
  return renderDocxFromTemplateBuffer(content, templateData)
}

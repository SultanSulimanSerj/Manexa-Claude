import path from 'path'
import fs from 'fs'
import type { Ks2DocumentData } from '../fns-form-types'
import { patchXlsxTemplate } from '../xlsx-patcher'
import { buildKs2XlsxPatchPlan } from './ks2-cell-map'

const TEMPLATE_PATH = path.join(process.cwd(), 'templates/documents/ks2-template.xlsx')

export async function renderKs2Xlsx(data: Ks2DocumentData): Promise<Buffer> {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(
      `Шаблон КС-2 не найден: ${TEMPLATE_PATH}. Добавьте официальную форму КС-2 (ФНС) в templates/documents/ks2-template.xlsx`
    )
  }

  const plan = buildKs2XlsxPatchPlan(data)
  return patchXlsxTemplate({
    templatePath: TEMPLATE_PATH,
    assignments: plan.assignments,
  })
}

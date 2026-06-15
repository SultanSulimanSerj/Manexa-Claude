import path from 'path'
import fs from 'fs'
import type { Ks3DocumentData } from '../fns-form-types'
import { patchXlsxTemplate } from '../xlsx-patcher'
import { buildKs3XlsxPatchPlan } from './ks3-cell-map'

const TEMPLATE_PATH = path.join(process.cwd(), 'templates/documents/ks3-template.xlsx')

export async function renderKs3Xlsx(data: Ks3DocumentData): Promise<Buffer> {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(
      `Шаблон КС-3 не найден: ${TEMPLATE_PATH}. Добавьте официальную форму КС-3 (ФНС) в templates/documents/ks3-template.xlsx`
    )
  }

  const plan = buildKs3XlsxPatchPlan(data)
  return patchXlsxTemplate({
    templatePath: TEMPLATE_PATH,
    assignments: plan.assignments,
  })
}

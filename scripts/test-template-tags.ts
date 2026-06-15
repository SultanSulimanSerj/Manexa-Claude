/**
 * Скан тегов в DOCX-шаблоне и пробный рендер docxtemplater.
 */
import fs from 'fs'
import path from 'path'
import { scanDocxTags } from '../src/lib/template-scan'
import { renderDocxFromTemplateBuffer } from '../src/lib/document-renderer/template-docx-renderer'

const root = path.join(__dirname, '..')

const sampleData = {
  contractNumber: 'Д-001',
  contractDate: '01.06.2026',
  city: 'Москва',
  validUntil: '01.07.2026',
  executorLegalName: 'ООО «Манекса»',
  executorDirector: 'Иванов И.И.',
  executorInn: '7700000000',
  executorKpp: '770001001',
  executorAddress: 'г. Москва, ул. Примерная, 1',
  executorPhone: '+7 (900) 000-00-00',
  executorEmail: 'info@manexa.ru',
  executorBankAccount: '40702810000000000001',
  clientLegalName: 'ООО «Заказчик»',
  clientDirector: 'Петров П.П.',
  clientInn: '7700000001',
  clientAddress: 'г. Москва, ул. Клиентская, 2',
  projectName: 'Ремонт офиса',
  workAddress: 'г. Москва, ул. Рабочая, 3',
  startDate: '01.07.2026',
  endDate: '31.08.2026',
  totalAmount: '1 000 000,00',
  totalAmountWords: 'Один миллион рублей 00 копеек',
  items: [
    { lineNumber: '1', name: 'Монтаж', quantity: '1', unit: 'компл.', unitPrice: '500 000,00', total: '500 000,00' },
    { lineNumber: '2', name: 'Отделка', quantity: '100', unit: 'м²', unitPrice: '5 000,00', total: '500 000,00' },
  ],
}

async function testTemplate(templateFile: string, outFile: string, prepareHint: string) {
  const templatePath = path.join(root, 'assets/templates', templateFile)
  const outPath = path.join(root, 'tmp', outFile)

  if (!fs.existsSync(templatePath)) {
    console.error(`Шаблон ${templateFile} не найден. Сначала выполните: ${prepareHint}`)
    process.exit(1)
  }

  const buffer = fs.readFileSync(templatePath)
  const tags = scanDocxTags(buffer)
  const known = tags.filter((t) => t.known)
  const unknown = tags.filter((t) => !t.known)
  console.log(`[${templateFile}] найденные теги:`, known.map((t) => t.name))
  if (unknown.length) {
    console.log(`[${templateFile}] неизвестные теги:`, unknown.map((t) => t.name))
  }

  const rendered = await renderDocxFromTemplateBuffer(buffer, sampleData)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, rendered)
  console.log(`[${templateFile}] рендер сохранён:`, outPath)
}

async function main() {
  await testTemplate('contract-template.docx', 'test-contract-render.docx', 'npm run prepare:contract-template')
  await testTemplate('commercial-offer-template.docx', 'test-co-render.docx', 'npm run prepare:co-template')
  console.log('OK')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

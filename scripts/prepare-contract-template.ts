/**
 * Генерирует базовый DOCX-шаблон договора с плейсхолдерами docxtemplater.
 */
import fs from 'fs'
import path from 'path'
import { Document, Paragraph, TextRun, Packer } from 'docx'

const root = path.join(__dirname, '..')
const target = path.join(root, 'assets/templates/contract-template.docx')
import { BRAND_TAG_SIGNATURE, BRAND_TAG_STAMP, SIGNATURE_LINE } from '../src/lib/document-branding/brand-tags'

function p(text: string, bold = false): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold })],
  })
}

async function main() {
  const doc = new Document({
    sections: [
      {
        children: [
          p('ДОГОВОР ПОДРЯДА № {contractNumber}', true),
          p(''),
          p('г. {city}    {contractDate}'),
          p(''),
          p(
            '{executorLegalName}, именуемое в дальнейшем «Подрядчик», в лице {executorDirector}, действующего на основании Устава, с одной стороны, и {clientLegalName}, именуемое в дальнейшем «Заказчик», в лице {clientDirector}, с другой стороны, заключили настоящий договор о нижеследующем:'
          ),
          p(''),
          p('1. ПРЕДМЕТ ДОГОВОРА', true),
          p('1.1. Подрядчик обязуется выполнить работы по объекту: {projectName}, адрес: {workAddress}.'),
          p('1.2. Срок выполнения работ: с {startDate} по {endDate}.'),
          p('1.3. Стоимость работ по договору: {totalAmount} руб.'),
          p(''),
          p('2. СПЕЦИФИКАЦИЯ', true),
          p('{#items}{lineNumber}. {name} — {quantity} {unit}, {total} руб.{/items}'),
          p(''),
          p('3. РЕКВИЗИТЫ СТОРОН', true),
          p('Подрядчик: ИНН {executorInn}, {executorAddress}, р/с {executorBankAccount}'),
          p('Заказчик: ИНН {clientInn}, {clientAddress}'),
          p(''),
          p('Подрядчик:'),
          p('{executorDirectorPosition}'),
          p(`${SIGNATURE_LINE} ${BRAND_TAG_SIGNATURE} / {directorShortName} /`),
          p(`М.П. ${BRAND_TAG_STAMP}`),
        ],
      },
    ],
  })

  const buffer = await Packer.toBuffer(doc)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, buffer)
  console.log('Создан:', target)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

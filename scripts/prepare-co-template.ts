/**
 * Генерирует базовый DOCX-шаблон коммерческого предложения с плейсхолдерами docxtemplater.
 */
import fs from 'fs'
import path from 'path'
import { Document, Paragraph, TextRun, Packer } from 'docx'

const root = path.join(__dirname, '..')
const target = path.join(root, 'assets/templates/commercial-offer-template.docx')
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
          p('КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ № {contractNumber}', true),
          p(''),
          p('г. {city}    {contractDate}'),
          p(''),
          p('{executorLegalName}'),
          p('ИНН {executorInn}  КПП {executorKpp}'),
          p('Тел.: {executorPhone}  Email: {executorEmail}'),
          p(''),
          p('Кому: {clientLegalName}'),
          p(''),
          p('Предлагаем выполнение работ по объекту: {projectName}'),
          p('Адрес объекта: {workAddress}'),
          p(''),
          p('СОСТАВ РАБОТ И СТОИМОСТЬ', true),
          p('{#items}{lineNumber}. {name} — {quantity} {unit} × {unitPrice} руб. = {total} руб.{/items}'),
          p(''),
          p('ИТОГО: {totalAmount} руб.', true),
          p('({totalAmountWords})'),
          p(''),
          p('Предложение действительно до: {validUntil}'),
          p(''),
          p('С уважением,'),
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

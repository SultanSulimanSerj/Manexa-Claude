/**
 * Проверка: DOCX после брендинга остаётся валидным XML.
 * npx tsx scripts/test-docx-branding.ts
 */
import fs from 'fs'
import path from 'path'
import { renderDocxFromTemplateBuffer } from '../src/lib/document-renderer/template-docx-renderer'
import { mapCommercialOfferToTemplateData } from '../src/lib/template-mapper'
import { applyBrandingToDocx } from '../src/lib/document-branding/docx-branding'
import type { CommercialOfferDocumentContent } from '../src/lib/document-editor/types'
import PizZip from 'pizzip'

const templatePath = path.join(__dirname, '../assets/templates/commercial-offer-template.docx')
const outPath = path.join(__dirname, '../.tmp/branding-test-co.docx')

const sampleContent: CommercialOfferDocumentContent = {
  type: 'COMMERCIAL_OFFER',
  schemaVersion: 1,
  data: {
    offerNumber: '2',
    offerDate: '15.06.2026',
    city: 'Екатеринбург',
    executorName: 'ООО УралТек',
    executorLegalName: 'ООО УралТек',
    executorInn: '6670532682',
    executorKpp: '667001001',
    executorPhone: '+7',
    executorEmail: 'test@test.ru',
    executorDirector: 'Копыл Сергей Владимирович',
    clientName: 'Клиент',
    clientLegalName: 'ООО Клиент',
    projectName: 'Проект',
    workAddress: 'Адрес',
    estimateName: 'Смета',
    items: [],
    total: 1000,
    vatEnabled: false,
    vatRate: 0,
    vatAmount: 0,
    totalWithVat: 1000,
    validUntil: '30.06.2026',
  },
}

async function main() {
  const template = fs.readFileSync(templatePath)
  const rendered = await renderDocxFromTemplateBuffer(
    template,
    mapCommercialOfferToTemplateData(sampleContent)
  )

  const png1x1 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  )

  const branded = await applyBrandingToDocx(rendered, {
    documentCategory: 'COMMERCIAL',
    stamp: { buffer: png1x1, mimeType: 'image/png' },
    signature: { buffer: png1x1, mimeType: 'image/png' },
  })

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, branded)

  const xml = new PizZip(branded).file('word/document.xml')!.asText()
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('child_process').execSync(
      `python3 -c "import zipfile,xml.etree.ElementTree as ET; ET.fromstring(zipfile.ZipFile('${outPath}').read('word/document.xml'))"`,
      { stdio: 'pipe' }
    )
  } catch {
    console.error('FAIL: invalid document.xml')
    process.exit(1)
  }
  if (!xml.includes('<w:drawing>')) {
    console.error('FAIL: no drawing inserted')
    process.exit(1)
  }

  console.log('OK:', outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

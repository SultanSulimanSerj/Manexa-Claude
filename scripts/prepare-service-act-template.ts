/**
 * Подготавливает DOCX-шаблон акта приёмки услуг с плейсхолдерами docxtemplater
 */
import fs from 'fs'
import path from 'path'
import PizZip from 'pizzip'

const root = path.join(__dirname, '..')
const source = path.join(root, 'assets/templates/service-act-source.docx')
const target = path.join(root, 'assets/templates/service-act-template.docx')
const BRAND_TAG_SIGNATURE = '____"signature"_____'
const BRAND_TAG_STAMP = '____"stamp"_____'

function replaceAll(xml: string, from: string, to: string): string {
  return xml.split(from).join(to)
}

function replaceFirst(xml: string, from: string, to: string): string {
  const idx = xml.indexOf(from)
  if (idx === -1) return xml
  return xml.slice(0, idx) + to + xml.slice(idx + from.length)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function replaceFirstWt(rowXml: string, from: string, to: string): string {
  const re = new RegExp(`(<w:t[^>]*>)${escapeRegExp(from)}(</w:t>)`)
  return rowXml.replace(re, `$1${to}$2`)
}

function extractRowXml(xml: string, marker: string): { row: string; start: number; end: number } | null {
  const markerIndex = xml.indexOf(marker)
  if (markerIndex < 0) return null
  const start = xml.lastIndexOf('<w:tr', markerIndex)
  const end = xml.indexOf('</w:tr>', markerIndex)
  if (start < 0 || end < 0) return null
  const rowEnd = end + '</w:tr>'.length
  return { row: xml.slice(start, rowEnd), start, end: rowEnd }
}

function patchItemsTable(xml: string): string {
  const loop = extractRowXml(xml, 'Видеорегистратор Trassir')
  if (!loop) throw new Error('Не найдена строка-пример позиции в шаблоне акта')

  let loopRow = loop.row
  loopRow = replaceFirstWt(loopRow, '1', '{#items}{lineNumber}')
  loopRow = replaceFirstWt(loopRow, 'Видеорегистратор Trassir', '{name}')
  loopRow = replaceFirstWt(loopRow, '1', '{quantity}')
  loopRow = replaceFirstWt(loopRow, 'шт', '{unit}')
  loopRow = replaceFirstWt(loopRow, '63 230,00', '{unitPrice}')
  loopRow = replaceFirstWt(loopRow, '63 230,00', '{total}{/items}')

  return xml.slice(0, loop.start) + loopRow + xml.slice(loop.end)
}

function main() {
  if (!fs.existsSync(source)) {
    throw new Error(`Исходный файл не найден: ${source}`)
  }

  const zip = new PizZip(fs.readFileSync(source))
  let xml = zip.file('word/document.xml')!.asText()

  xml = replaceAll(
    xml,
    'Акт сдачи-приемки выполненных работ (оказанных услуг)№ 1 от 15.06.2026 г.',
    'Акт сдачи-приемки выполненных работ (оказанных услуг) № {documentNumber} от {documentDate} г.'
  )
  xml = replaceAll(
    xml,
    'Общество с ограниченной ответственностью "Уралтек", 620078, Российская Федерация, Свердловская обл, город Екатеринбург г.о., г Екатеринбург, ул Мира, д. 44, кв. 6, ИНН 6670532682, КПП 667001001, р/с 40702810320000272737 в ООО "Банк Точка", г Москва, БИК 044525104, корр/с 30101810745374525104',
    '{sellerLine}'
  )
  xml = replaceAll(
    xml,
    'ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "МЕХАНИКА ИНЖИНИРИНГ", Российская Федерация, Москва г, ш Старокаширское, 2, 6, 5 кв., ИНН 7735191266, КПП 772401001, р/с 40702810101770006500 в АО "АЛЬФА-БАНК", г Москва, БИК 044525593, корр/с 30101810545250000901',
    '{buyerLine}'
  )
  xml = replaceAll(
    xml,
    'Договор №\xa012/01-02 от 12.01.2026, Счет на оплату №\xa034 от 04.05.2026',
    '{basisText}'
  )
  xml = replaceAll(xml, '91 229,00', '{totalFormatted}')
  xml = replaceAll(xml, 'Без НДС', '{vatLabel}')
  xml = replaceAll(
    xml,
    'Девяносто одна тысяча двести двадцать девять рублей 00 копеек. Без НДС',
    '{totalInWords}'
  )
  xml = replaceAll(xml, 'Копыл С.В.', '{directorShortName}')

  xml = patchItemsTable(xml)

  xml = replaceFirst(xml, 'расшифровка подписи', BRAND_TAG_SIGNATURE)
  xml = replaceFirst(xml, '<w:t>М.П.</w:t>', `<w:t>М.П. ${BRAND_TAG_STAMP}</w:t>`)

  zip.file('word/document.xml', xml)
  fs.writeFileSync(target, zip.generate({ type: 'nodebuffer' }))
  console.log('service-act-template.docx written to', target)
}

main()

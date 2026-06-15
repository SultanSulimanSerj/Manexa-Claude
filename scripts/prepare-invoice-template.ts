/**
 * Подготавливает DOCX-шаблон счёта с плейсхолдерами docxtemplater
 * из образца assets/templates/invoice-outgoing.docx
 */
import fs from 'fs'
import path from 'path'
import PizZip from 'pizzip'

const root = path.join(__dirname, '..')
const source = path.join(root, 'assets/templates/invoice-outgoing.docx')
const target = path.join(root, 'assets/templates/invoice-template.docx')
const BRAND_TAG_SIGNATURE = '____"signature"_____'
const BRAND_TAG_STAMP = '____"stamp"_____'
const SIGNATURE_LINE = '___________________'

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
  const install = extractRowXml(xml, 'Установка и настройка')
  if (install) {
    xml = xml.slice(0, install.start) + xml.slice(install.end)
  }

  const loop = extractRowXml(xml, 'MESH-комплект TP-Link Deco')
  if (!loop) throw new Error('Не найдена строка-пример позиции в шаблоне')

  let loopRow = loop.row
  loopRow = replaceFirstWt(loopRow, '1', '{#items}{lineNumber}')
  loopRow = replaceFirstWt(loopRow, 'MESH-комплект TP-Link Deco', '{name}')
  loopRow = replaceFirstWt(loopRow, '2', '{quantity}')
  loopRow = replaceFirstWt(loopRow, 'шт', '{unit}')
  loopRow = replaceFirstWt(loopRow, '9\u00a0490,00', '{unitPrice}')
  loopRow = replaceFirstWt(loopRow, '18\u00a0980,00', '{total}{/items}')

  return xml.slice(0, loop.start) + loopRow + xml.slice(loop.end)
}

function main() {
  const zip = new PizZip(fs.readFileSync(source))
  let xml = zip.file('word/document.xml')!.asText()

  xml = replaceAll(xml, 'Счет на оплату № 38 от 29.05.2026', 'Счет на оплату № {documentNumber} от {documentDate}')
  xml = replaceAll(
    xml,
    'Общество с ограниченной ответственностью "Уралтек", 620078, Российская Федерация, Свердловская обл, город Екатеринбург г.о., г Екатеринбург, ул Мира, д. 44, кв. 6',
    '{sellerAddressLine}'
  )
  xml = replaceAll(xml, 'ООО "Банк Точка"', '{bankName}')
  xml = replaceAll(xml, '044525104', '{bankBik}')
  xml = replaceAll(xml, 'г Москва', '{bankCity}')
  xml = replaceAll(xml, '30101810745374525104', '{correspondentAccount}')
  xml = replaceAll(xml, '6670532682', '{sellerInn}')
  xml = replaceAll(xml, '667001001', '{sellerKpp}')
  xml = replaceAll(xml, 'Общество с ограниченной ответственностью "Уралтек"', '{sellerLegalName}')
  xml = replaceAll(xml, '40702810320000272737', '{bankAccount}')
  xml = replaceAll(
    xml,
    'Общество с ограниченной ответственностью "Завод Полимер Техсинтез", ИНН 6671238370, КПП 667901001, 620902, Российская Федерация, Свердловская обл, г Екатеринбург, ул 1-я Баритовая, стр. 127и, 3 офис',
    '{buyerLine}'
  )
  xml = replaceAll(xml, '24\u00a0980,00', '{totalFormatted}')
  xml = replaceAll(xml, 'Без налога (НДС)', '{vatLabel}')
  xml = replaceAll(xml, 'Всего наименований 2 на сумму 24980 рублей 00 копеек', '{itemsSummary}')
  xml = replaceAll(
    xml,
    'Двадцать четыре тысячи девятьсот восемьдесят рублей 00 копеек',
    '{totalInWords}'
  )
  xml = replaceAll(xml, '(Копыл С.В.)', '({directorShortName})')
  xml = replaceAll(xml, 'Условия оплаты:', 'Условия оплаты: {paymentTerms}')

  xml = xml.replace(
    /(<w:tr[\s\S]*?Итого к оплате[\s\S]*?Без налога \(НДС\)[\s\S]*?<w:t>)-(<\/w:t>)/,
    '$1{vatDisplay}$2'
  )

  xml = patchItemsTable(xml)

  xml = replaceFirst(
    xml,
    '<w:t>______________________________</w:t>',
    `<w:t>${SIGNATURE_LINE} ${BRAND_TAG_SIGNATURE}</w:t>`
  )
  xml = xml.replace(
    /(<w:t[^>]*>Генеральный директор<\/w:t><\/w:r>)/,
    `$1</w:p><w:p><w:r><w:t>М.П. ${BRAND_TAG_STAMP}</w:t></w:r>`
  )

  zip.file('word/document.xml', xml)
  fs.writeFileSync(target, zip.generate({ type: 'nodebuffer' }))
  console.log('invoice-template.docx written to', target)
}

main()

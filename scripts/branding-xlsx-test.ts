import fs from 'fs'
import path from 'path'
import PizZip from 'pizzip'
import { applyBrandingToXlsx } from '../src/lib/document-branding/xlsx-branding'

// минимальный валидный PNG 2x2 (красный)
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEUlEQVR4nGP8z8Dwn4EIwDiqEAARWAIBz9r7WgAAAABJRU5ErkJggg==',
  'base64'
)

function assert(c: boolean, m: string) {
  console.log(`${c ? 'OK' : 'FAIL'}: ${m}`)
  if (!c) process.exit(1)
}

async function main() {
  const tpl = path.join(process.cwd(), 'templates/documents/upd-status-2-template.xlsx')
  const input = fs.readFileSync(tpl)
  const before = new PizZip(input)
  const mergesBefore = (before.file('xl/worksheets/sheet1.xml')!.asText().match(/<mergeCell /g) || []).length
  const sheetBefore = before.file('xl/worksheets/sheet1.xml')!.asText().length

  const out = await applyBrandingToXlsx(input, 'UPD', {
    stamp: { buffer: PNG, mimeType: 'image/png' },
    signature: { buffer: PNG, mimeType: 'image/png' },
  })

  const zip = new PizZip(out)
  const sheet = zip.file('xl/worksheets/sheet1.xml')!.asText()
  const mergesAfter = (sheet.match(/<mergeCell /g) || []).length

  assert(out.length > 0 && zip.file("xl/media/brand-1.png") != null, `файл собран (${out.length} байт)`)
  assert(mergesAfter === mergesBefore, `merge-ячейки сохранены (${mergesBefore})`)
  assert(zip.file('xl/drawings/drawing1.xml') != null, 'drawing1.xml добавлен')
  assert(zip.file('xl/drawings/_rels/drawing1.xml.rels') != null, 'drawing rels добавлен')
  assert(zip.file('xl/media/brand-1.png') != null && zip.file('xl/media/brand-2.png') != null, 'media (печать+подпись) добавлены')
  assert(/<drawing r:id="rId\d+"\/>/.test(sheet), 'тег <drawing> в листе')
  const sheetRels = zip.file('xl/worksheets/_rels/sheet1.xml.rels')!.asText()
  assert(/Type=".*relationships\/drawing"/.test(sheetRels), 'ссылка лист->drawing')
  assert(sheetRels.includes('printerSettings'), 'старая ссылка printerSettings не потеряна')
  const ct = zip.file('[Content_Types].xml')!.asText()
  assert(ct.includes('Extension="png"'), 'png зарегистрирован в Content_Types')
  assert(ct.includes('/xl/drawings/drawing1.xml'), 'drawing override в Content_Types')
  const drawing = zip.file('xl/drawings/drawing1.xml')!.asText()
  assert((drawing.match(/<xdr:oneCellAnchor>/g) || []).length === 2, '2 oneCellAnchor (печать+подпись)')
  assert(drawing.includes('r:embed="rId1"') && drawing.includes('r:embed="rId2"'), 'blip embed на оба изображения')

  fs.writeFileSync('/tmp/upd-branded.xlsx', out)
  console.log('файл сохранён: /tmp/upd-branded.xlsx', out.length, 'байт')
  console.log('ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')
}
main().catch((e) => { console.error(e); process.exit(1) })

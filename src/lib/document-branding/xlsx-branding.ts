import PizZip from 'pizzip'
import { XLSX_BRANDING_ANCHORS, type BrandPlacement } from './anchors'
import { cellAnchorBox } from './xlsx-geometry'

/**
 * Вставка печати/подписи в XLSX-формы (УПД, КС-2, КС-3) прямой инъекцией
 * DrawingML в zip — БЕЗ перезаписи книги через ExcelJS.
 *
 * Позиционирование image-agnostic: изображение нормализуется в бокс
 * (maxWidth×maxHeight, пропорции сохраняются) и центрируется по геометрии
 * шаблона (absoluteAnchor с EMU-координатами, вычисленными из ширин колонок
 * и высот строк). Так печать/подпись любой компании любых размеров встают
 * по центру подписной линии / ячейки «М.П.», а шаблон остаётся нетронутым.
 */

const EMU_PER_PX = 9525

const DRAWING_PATH = 'xl/drawings/drawing1.xml'
const DRAWING_RELS_PATH = 'xl/drawings/_rels/drawing1.xml.rels'
const SHEET_PATH = 'xl/worksheets/sheet1.xml'
const SHEET_RELS_PATH = 'xl/worksheets/_rels/sheet1.xml.rels'
const CONTENT_TYPES_PATH = '[Content_Types].xml'

const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const DRAWING_REL_TYPE = `${REL_NS}/drawing`
const IMAGE_REL_TYPE = `${REL_NS}/image`

function imageExtension(mimeType: string): 'png' | 'jpeg' {
  return mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpeg' : 'png'
}

function readImagePixelSize(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length >= 24 && buffer[0] === 0x89 && buffer.toString('ascii', 1, 4) === 'PNG') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2
    while (offset < buffer.length - 9) {
      if (buffer[offset] !== 0xff) break
      const marker = buffer[offset + 1]
      const len = buffer.readUInt16BE(offset + 2)
      if (marker === 0xc0 || marker === 0xc2 || marker === 0xc1) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) }
      }
      offset += 2 + len
    }
  }
  return null
}

function fitImagePixels(buffer: Buffer, maxWidth: number, maxHeight: number): { width: number; height: number } {
  const size = readImagePixelSize(buffer)
  if (!size || size.width <= 0 || size.height <= 0) {
    return { width: maxWidth, height: maxHeight }
  }
  const aspect = size.width / size.height
  let width = maxWidth
  let height = Math.round(width / aspect)
  if (height > maxHeight) {
    height = maxHeight
    width = Math.round(height * aspect)
  }
  return { width, height }
}

function nextRelId(relsXml: string): number {
  let max = 0
  const re = /Id="rId(\d+)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(relsXml)) !== null) {
    max = Math.max(max, parseInt(m[1], 10))
  }
  return max + 1
}

interface PreparedImage {
  mediaName: string
  buffer: Buffer
  relId: string
  col: number
  row: number
  colOff: number
  rowOff: number
  cx: number
  cy: number
  picId: number
  name: string
}

function buildOneCellAnchor(img: PreparedImage): string {
  return (
    `<xdr:oneCellAnchor>` +
    `<xdr:from>` +
    `<xdr:col>${img.col}</xdr:col><xdr:colOff>${img.colOff}</xdr:colOff>` +
    `<xdr:row>${img.row}</xdr:row><xdr:rowOff>${img.rowOff}</xdr:rowOff>` +
    `</xdr:from>` +
    `<xdr:ext cx="${img.cx}" cy="${img.cy}"/>` +
    `<xdr:pic>` +
    `<xdr:nvPicPr>` +
    `<xdr:cNvPr id="${img.picId}" name="${img.name}"/>` +
    `<xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr>` +
    `</xdr:nvPicPr>` +
    `<xdr:blipFill>` +
    `<a:blip xmlns:r="${REL_NS}" r:embed="${img.relId}"/>` +
    `<a:stretch><a:fillRect/></a:stretch>` +
    `</xdr:blipFill>` +
    `<xdr:spPr>` +
    `<a:xfrm><a:off x="0" y="0"/><a:ext cx="${img.cx}" cy="${img.cy}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
    `</xdr:spPr>` +
    `</xdr:pic>` +
    `<xdr:clientData/>` +
    `</xdr:oneCellAnchor>`
  )
}

function buildDrawingXml(images: PreparedImage[]): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" ` +
    `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    images.map(buildOneCellAnchor).join('') +
    `</xdr:wsDr>`
  )
}

function buildDrawingRels(images: PreparedImage[]): string {
  const rels = images
    .map(
      (img) =>
        `<Relationship Id="${img.relId}" Type="${IMAGE_REL_TYPE}" Target="../media/${img.mediaName}"/>`
    )
    .join('')
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`
  )
}

function prepareImage(
  sheetXml: string,
  placement: BrandPlacement,
  asset: { buffer: Buffer; mimeType: string },
  ordinal: number,
  name: string
): PreparedImage {
  const { width, height } = fitImagePixels(asset.buffer, placement.maxWidth, placement.maxHeight)
  const cx = Math.round(width * EMU_PER_PX)
  const cy = Math.round(height * EMU_PER_PX)
  const ext = imageExtension(asset.mimeType)

  // Привязка к ячейке-ориентиру: смещения центрируют картинку внутри объединения
  // (могут быть отрицательными, если картинка шире/выше ячейки — это нормально,
  // рендерер позволяет выходить за пределы ячейки).
  const box = cellAnchorBox(sheetXml, placement.cell)
  let colOff = Math.round(box.w / 2 - cx / 2)
  let rowOff: number
  if (placement.mode === 'signature') {
    // подпись чуть пересекает линию (верхняя граница ячейки-caption «(подпись)»)
    rowOff = Math.round(-cy * 0.8)
  } else {
    // печать по центру ячейки «М.П.»
    rowOff = Math.round(box.h / 2 - cy / 2)
  }
  // у самой кромки листа отрицательное смещение уводит картинку за край (x/y<0) —
  // LibreOffice её не рисует; прижимаем к кромке (например, печать в «М.П.» в колонке A)
  if (box.col === 0 && colOff < 0) colOff = 0
  if (box.row === 0 && rowOff < 0) rowOff = 0

  return {
    mediaName: `brand-${ordinal}.${ext}`,
    buffer: asset.buffer,
    relId: `rId${ordinal}`,
    col: box.col,
    row: box.row,
    colOff,
    rowOff,
    cx,
    cy,
    picId: ordinal + 1,
    name: `${name}-${ordinal}`,
  }
}

export async function applyBrandingToXlsx(
  xlsxBuffer: Buffer,
  category: string,
  options: {
    stamp?: { buffer: Buffer; mimeType: string } | null
    signature?: { buffer: Buffer; mimeType: string } | null
  }
): Promise<Buffer> {
  const anchors = XLSX_BRANDING_ANCHORS[category]
  if (!anchors) return xlsxBuffer

  const zip = new PizZip(xlsxBuffer)
  const sheetFile = zip.file(SHEET_PATH)
  if (!sheetFile) return xlsxBuffer
  const sheetXmlForGeometry = sheetFile.asText()

  const images: PreparedImage[] = []
  if (options.stamp?.buffer) {
    for (const placement of anchors.stamp ?? []) {
      images.push(prepareImage(sheetXmlForGeometry, placement, options.stamp, images.length + 1, 'Stamp'))
    }
  }
  if (options.signature?.buffer) {
    for (const placement of anchors.signature ?? []) {
      images.push(
        prepareImage(sheetXmlForGeometry, placement, options.signature, images.length + 1, 'Signature')
      )
    }
  }
  if (images.length === 0) return xlsxBuffer

  // media
  for (const img of images) {
    zip.file(`xl/media/${img.mediaName}`, img.buffer)
  }

  // drawing + его rels
  zip.file(DRAWING_PATH, buildDrawingXml(images))
  zip.file(DRAWING_RELS_PATH, buildDrawingRels(images))

  // ссылка лист → drawing
  const sheetRelsFile = zip.file(SHEET_RELS_PATH)
  const sheetRelsXml =
    sheetRelsFile?.asText() ??
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`
  const drawingRelId = `rId${nextRelId(sheetRelsXml)}`
  const newSheetRels = sheetRelsXml.replace(
    '</Relationships>',
    `<Relationship Id="${drawingRelId}" Type="${DRAWING_REL_TYPE}" Target="../drawings/drawing1.xml"/></Relationships>`
  )
  zip.file(SHEET_RELS_PATH, newSheetRels)

  // <drawing> в лист (перед закрытием worksheet)
  let sheetXml = sheetFile.asText()
  if (!sheetXml.includes('<drawing ')) {
    sheetXml = sheetXml.replace('</worksheet>', `<drawing r:id="${drawingRelId}"/></worksheet>`)
    zip.file(SHEET_PATH, sheetXml)
  }

  // [Content_Types]: png/jpeg defaults + override для drawing
  const ctFile = zip.file(CONTENT_TYPES_PATH)
  if (ctFile) {
    let ct = ctFile.asText()
    const additions: string[] = []
    if (images.some((i) => i.mediaName.endsWith('.png')) && !ct.includes('Extension="png"')) {
      additions.push('<Default Extension="png" ContentType="image/png"/>')
    }
    if (images.some((i) => i.mediaName.endsWith('.jpeg')) && !ct.includes('Extension="jpeg"')) {
      additions.push('<Default Extension="jpeg" ContentType="image/jpeg"/>')
    }
    if (!ct.includes('/xl/drawings/drawing1.xml')) {
      additions.push(
        '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>'
      )
    }
    if (additions.length) {
      ct = ct.replace('</Types>', `${additions.join('')}</Types>`)
      zip.file(CONTENT_TYPES_PATH, ct)
    }
  }

  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
}

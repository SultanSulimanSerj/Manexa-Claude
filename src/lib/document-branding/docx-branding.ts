import PizZip from 'pizzip'
import {
  expandXmlTagVariants,
  SIGNATURE_TAG_VARIANTS,
  STAMP_TAG_VARIANTS,
} from './brand-tags'

const SIGNATURE_SCALE = 1.35
const STAMP_EMU = 1_100_000

// Геометрия линии подписи (EMU). Ширина одного «_» в шрифте шаблона и низ
// строки — калибровано по рендеру; от размеров картинки тенанта не зависит.
const UNDERSCORE_EMU = 72_000
const LINE_BOTTOM_EMU = 170_000 // низ строки с линией (CASE A)
const CELL_BOTTOM_EMU = 190_000 // низ абзаца-ячейки с нижней границей (CASE B)
const CASE_B_MAX_CY = 360_000 // макс. высота подписи в компактной ячейке (~28pt)

function detectImageExt(buffer: Buffer, mimeType: string): 'png' | 'jpeg' {
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpeg'
  if (mimeType.includes('png') || buffer[0] === 0x89) return 'png'
  return 'png'
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
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        }
      }
      offset += 2 + len
    }
  }
  return null
}

function imageExtentEmu(
  buffer: Buffer,
  kind: 'stamp' | 'signature'
): { cx: number; cy: number } {
  if (kind === 'stamp') {
    return { cx: STAMP_EMU, cy: STAMP_EMU }
  }

  const size = readImagePixelSize(buffer)
  const signatureWidth = Math.round(1_050_000 * SIGNATURE_SCALE)
  const signatureHeight = Math.round(380_000 * SIGNATURE_SCALE)

  if (!size || size.width <= 0 || size.height <= 0) {
    return { cx: signatureWidth, cy: Math.round(350_000 * SIGNATURE_SCALE) }
  }

  const aspect = size.width / size.height
  let cx = signatureWidth
  let cy = Math.round(cx / aspect)
  if (cy > signatureHeight) {
    cy = signatureHeight
    cx = Math.round(cy * aspect)
  }
  return { cx, cy }
}

/** Смещение в half-points: центр картинки на линии подчёркивания */
function signatureLineOffsetHalfPoints(cy: number): number {
  const heightPt = (cy / 914400) * 72
  return Math.max(8, Math.round(heightPt * 0.5 * 2))
}

function nextRelId(relsXml: string): number {
  const ids: number[] = []
  const re = /Id="rId(\d+)"/g
  let match: RegExpExecArray | null
  while ((match = re.exec(relsXml)) !== null) {
    ids.push(parseInt(match[1], 10))
  }
  return (ids.length ? Math.max(...ids) : 0) + 1
}

function addImageToZip(zip: PizZip, buffer: Buffer, mimeType: string, label: string): string {
  const ext = detectImageExt(buffer, mimeType)
  const relsPath = 'word/_rels/document.xml.rels'
  const relsFile = zip.file(relsPath)
  if (!relsFile) throw new Error('Некорректный DOCX: нет document.xml.rels')

  let rels = relsFile.asText()
  const id = nextRelId(rels)
  const rId = `rId${id}`
  const mediaName = `brand_${label}_${id}.${ext}`
  zip.file(`word/media/${mediaName}`, buffer)

  rels = rels.replace(
    '</Relationships>',
    `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaName}"/></Relationships>`
  )
  zip.file(relsPath, rels)

  const ctPath = '[Content_Types].xml'
  let ct = zip.file(ctPath)!.asText()
  const contentType = ext === 'png' ? 'image/png' : 'image/jpeg'
  if (!ct.includes(`Extension="${ext}"`)) {
    ct = ct.replace(
      '</Types>',
      `<Default Extension="${ext}" ContentType="${contentType}"/></Types>`
    )
    zip.file(ctPath, ct)
  }

  return rId
}

interface ImageRef {
  rId: string
  name: string
  cx: number
  cy: number
  docPrId: number
}

function picGraphic(rId: string, name: string, cx: number, cy: number): string {
  return (
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:nvPicPr><pic:cNvPr id="0" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic>`
  )
}

function buildImageRun(
  rId: string,
  name: string,
  cx: number,
  cy: number,
  docPrId: number,
  opts?: { verticalAlign?: 'signatureLine' }
): string {
  let rPr = ''
  if (opts?.verticalAlign === 'signatureLine') {
    const offset = signatureLineOffsetHalfPoints(cy)
    rPr = `<w:rPr><w:position w:val="-${offset}"/></w:rPr>`
  }
  return `<w:r>${rPr}<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${docPrId}" name="${name}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>${picGraphic(rId, name, cx, cy)}</wp:inline></w:drawing></w:r>`
}

/**
 * Плавающее (anchored) изображение — не участвует в потоке текста, поэтому не
 * «уезжает» и не раздвигает строку. Центрируется либо смещением по горизонтали
 * (от позиции символа — для линии «_____»), либо выравниванием по центру колонки
 * (для центрированной ячейки с нижней границей). По вертикали садится на линию.
 */
function buildFloatingImageRun(
  img: ImageRef,
  opts: {
    hFrom: string
    hAlign?: 'center'
    hOffset?: number
    vFrom: string
    vOffset: number
  }
): string {
  const h = opts.hAlign
    ? `<wp:align>${opts.hAlign}</wp:align>`
    : `<wp:posOffset>${Math.round(opts.hOffset ?? 0)}</wp:posOffset>`
  return (
    `<w:r><w:drawing>` +
    `<wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="251658240" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">` +
    `<wp:simplePos x="0" y="0"/>` +
    `<wp:positionH relativeFrom="${opts.hFrom}">${h}</wp:positionH>` +
    `<wp:positionV relativeFrom="${opts.vFrom}"><wp:posOffset>${Math.round(opts.vOffset)}</wp:posOffset></wp:positionV>` +
    `<wp:extent cx="${img.cx}" cy="${img.cy}"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:wrapNone/>` +
    `<wp:docPr id="${img.docPrId}" name="${img.name}"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    picGraphic(img.rId, img.name, img.cx, img.cy) +
    `</wp:anchor>` +
    `</w:drawing></w:r>`
  )
}

function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function extractRunText(runXml: string): string {
  const parts: string[] = []
  const re = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g
  let match: RegExpExecArray | null
  while ((match = re.exec(runXml)) !== null) {
    parts.push(decodeXmlText(match[1]))
  }
  return parts.join('')
}

function findRunStart(xml: string, beforeIdx: number): number {
  let pos = beforeIdx
  while (pos >= 0) {
    const idx = xml.lastIndexOf('<w:r', pos)
    if (idx === -1) return -1
    const next = xml[idx + 4]
    if (next === '>' || next === ' ' || next === '/') {
      return idx
    }
    pos = idx - 1
  }
  return -1
}

function findRunEnd(xml: string, afterIdx: number): number {
  const idx = xml.indexOf('</w:r>', afterIdx)
  return idx === -1 ? -1 : idx + '</w:r>'.length
}

function buildTextRun(runXml: string, text: string): string {
  const rPrMatch = runXml.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)
  const rPr = rPrMatch ? rPrMatch[0] : ''
  return `<w:r>${rPr}<w:t xml:space="preserve">${escapeXmlText(text)}</w:t></w:r>`
}

function findNthIndex(xml: string, anchorText: string, occurrence: number): number {
  let from = 0
  let found = -1
  for (let i = 0; i <= occurrence; i++) {
    found = xml.indexOf(anchorText, from)
    if (found === -1) return -1
    from = found + anchorText.length
  }
  return found
}

/** Заменяет маркер внутри w:r на картинку, сохраняя текст до/после в отдельных w:r */
function replaceMarkerInRun(xml: string, marker: string, imageRunXml: string): string | null {
  const idx = xml.indexOf(marker)
  if (idx === -1) return null

  const rStart = findRunStart(xml, idx)
  const runEnd = findRunEnd(xml, idx)
  if (rStart === -1 || runEnd === -1) return null
  const runBlock = xml.slice(rStart, runEnd)
  const text = extractRunText(runBlock)
  const markerPlain = decodeXmlText(marker)
  const pos = text.indexOf(markerPlain)
  if (pos === -1) return null

  const before = text.slice(0, pos)
  const after = text.slice(pos + markerPlain.length)

  let replacement = ''
  if (before) replacement += buildTextRun(runBlock, before)
  replacement += imageRunXml
  if (after) replacement += buildTextRun(runBlock, after)

  return xml.slice(0, rStart) + replacement + xml.slice(runEnd)
}

function replaceAnyMarkerInRuns(
  xml: string,
  markers: readonly string[],
  imageRunXml: string
): string {
  for (const marker of expandXmlTagVariants(markers)) {
    const next = replaceMarkerInRun(xml, marker, imageRunXml)
    if (next) return next
  }
  return xml
}

function getParagraphBounds(
  xml: string,
  anchorIdx: number
): { start: number; end: number } | null {
  const start = xml.lastIndexOf('<w:p', anchorIdx)
  const end = xml.indexOf('</w:p>', anchorIdx)
  if (start === -1 || end === -1) return null
  return { start, end: end + '</w:p>'.length }
}

/** Оставляет подчёркивания, добавляет картинку отдельным run сразу после */
function insertImageBesideUnderscoreRun(fragment: string, imageRunXml: string): string {
  const runRe = /<w:r[\s\S]*?<\/w:r>/g
  let match: RegExpExecArray | null
  let best: { run: string; score: number } | null = null

  while ((match = runRe.exec(fragment)) !== null) {
    const text = extractRunText(match[0])
    const underscores = text.match(/_+/g)
    if (!underscores) continue
    const score = underscores.reduce((max, part) => Math.max(max, part.length), 0)
    if (score >= 5 && (!best || score > best.score)) {
      best = { run: match[0], score }
    }
  }

  if (!best) return fragment
  return fragment.replace(best.run, best.run + imageRunXml)
}

function replaceUnderscoreInFragment(
  xml: string,
  fragmentStart: number,
  fragmentEnd: number,
  imageRunXml: string
): string {
  const fragment = xml.slice(fragmentStart, fragmentEnd)
  const updated = insertImageBesideUnderscoreRun(fragment, imageRunXml)
  if (updated === fragment) return xml
  return xml.slice(0, fragmentStart) + updated + xml.slice(fragmentEnd)
}

function replaceUnderscoreNearText(
  xml: string,
  imageRunXml: string,
  anchors: string[],
  scope: 'paragraph' | 'tableRow' | 'tail'
): string {
  const lower = xml.toLowerCase()

  for (const anchor of anchors) {
    const search = anchor.toLowerCase()
    let pos = 0

    while (pos < lower.length) {
      const idx = lower.indexOf(search, pos)
      if (idx === -1) break
      pos = idx + 1

      if (scope === 'tableRow') {
        const trStart = xml.lastIndexOf('<w:tr', idx)
        const trEnd = xml.indexOf('</w:tr>', idx)
        if (trStart === -1 || trEnd === -1) continue
        const fragmentEnd = trEnd + '</w:tr>'.length
        const next = replaceUnderscoreInFragment(xml, trStart, fragmentEnd, imageRunXml)
        if (next !== xml) return next
        continue
      }

      if (scope === 'paragraph') {
        const bounds = getParagraphBounds(xml, idx)
        if (!bounds) continue
        const next = replaceUnderscoreInFragment(xml, bounds.start, bounds.end, imageRunXml)
        if (next !== xml) return next
        continue
      }

      const bodyEnd = xml.lastIndexOf('</w:body>')
      if (bodyEnd === -1) continue
      const next = replaceUnderscoreInFragment(xml, idx, bodyEnd, imageRunXml)
      if (next !== xml) return next
    }
  }

  return xml
}

/** Заменяет w:r с подчёркиваниями в абзаце с «Подпись» */
function replaceUnderscoreRunNearPodpis(xml: string, imageRunXml: string): string {
  const anchorIdx = xml.indexOf('Подпись')
  if (anchorIdx === -1) return xml

  const bounds = getParagraphBounds(xml, anchorIdx)
  if (!bounds) return xml

  return replaceUnderscoreInFragment(xml, bounds.start, bounds.end, imageRunXml)
}

/** Вставляет картинку после текста внутри того же w:r (корректно разбивая run) */
function insertImageAfterTextInRun(
  xml: string,
  anchorText: string,
  imageRunXml: string,
  occurrence = 0
): string {
  const idx = findNthIndex(xml, anchorText, occurrence)
  if (idx === -1) return xml

  const rStart = findRunStart(xml, idx)
  const runEnd = findRunEnd(xml, idx)
  if (rStart === -1 || runEnd === -1) return xml
  const runBlock = xml.slice(rStart, runEnd)
  const text = extractRunText(runBlock)
  const pos = text.indexOf(anchorText)
  if (pos === -1) return xml

  const before = text.slice(0, pos + anchorText.length)
  const after = text.slice(pos + anchorText.length)

  let replacement = ''
  if (before) replacement += buildTextRun(runBlock, before)
  replacement += imageRunXml
  if (after) replacement += buildTextRun(runBlock, after)

  return xml.slice(0, rStart) + replacement + xml.slice(runEnd)
}

function insertImageInNewParagraphAfter(xml: string, anchorText: string, imageRunXml: string): string {
  const idx = xml.toLowerCase().indexOf(anchorText.toLowerCase())
  if (idx === -1) return xml

  const bounds = getParagraphBounds(xml, idx)
  if (!bounds) return xml

  const newPara = `<w:p>${imageRunXml}</w:p>`
  return xml.slice(0, bounds.end) + newPara + xml.slice(bounds.end)
}

function insertImageInNewParagraphAfterTableRow(xml: string, anchorText: string, imageRunXml: string): string {
  const idx = xml.toLowerCase().indexOf(anchorText.toLowerCase())
  if (idx === -1) return xml

  const trEnd = xml.indexOf('</w:tr>', idx)
  if (trEnd === -1) return xml
  const insertAt = trEnd + '</w:tr>'.length
  const newPara = `<w:p><w:r><w:t>М.П.</w:t></w:r>${imageRunXml}</w:p>`
  return xml.slice(0, insertAt) + newPara + xml.slice(insertAt)
}

/**
 * Заменяет маркер подписи на плавающее изображение, центрированное по подписной
 * линии. Два случая:
 *  CASE A — в run перед маркером есть линия «_____»: центр картинки над линией,
 *           низ — на линии (смещение от позиции символа, линия остаётся видна);
 *  CASE B — маркер один в центрированной ячейке с нижней границей: центр по
 *           колонке, низ — на нижней границе ячейки.
 */
function placeSignatureMarkerFloating(xml: string, img: ImageRef): string | null {
  for (const marker of expandXmlTagVariants(SIGNATURE_TAG_VARIANTS)) {
    const idx = xml.indexOf(marker)
    if (idx === -1) continue

    const rStart = findRunStart(xml, idx)
    const runEnd = findRunEnd(xml, idx)
    if (rStart === -1 || runEnd === -1) continue
    const runBlock = xml.slice(rStart, runEnd)
    const text = extractRunText(runBlock)
    const markerPlain = decodeXmlText(marker)
    const pos = text.indexOf(markerPlain)
    if (pos === -1) continue

    const before = text.slice(0, pos)
    const after = text.slice(pos + markerPlain.length)
    const underscores = before.match(/_{5,}/)

    let floatRun: string
    let replacement = ''
    if (underscores) {
      // CASE A: центр над линией «_____», низ картинки — на линии
      const lineW = underscores[0].length * UNDERSCORE_EMU
      const offX = -(lineW / 2 + img.cx / 2)
      // подпись сидит на линии, чуть выше центра (низ почти на линии), чтобы не уходила вниз
      const offY = LINE_BOTTOM_EMU - img.cy * 0.65
      floatRun = buildFloatingImageRun(img, {
        hFrom: 'character',
        hOffset: offX,
        vFrom: 'line',
        vOffset: offY,
      })
      if (before) replacement += buildTextRun(runBlock, before) // линия видна
      replacement += floatRun
      if (after) replacement += buildTextRun(runBlock, after)
    } else {
      // CASE B: компактная центрированная ячейка с нижней границей.
      // Уменьшаем подпись под высоту ячейки, центр по колонке, низ — на границе.
      const scale = img.cy > CASE_B_MAX_CY ? CASE_B_MAX_CY / img.cy : 1
      const bImg: ImageRef = {
        ...img,
        cx: Math.round(img.cx * scale),
        cy: Math.round(img.cy * scale),
      }
      const offY = CELL_BOTTOM_EMU - bImg.cy
      floatRun = buildFloatingImageRun(bImg, {
        hFrom: 'column',
        hAlign: 'center',
        vFrom: 'paragraph',
        vOffset: offY,
      })
      if (before) replacement += buildTextRun(runBlock, before)
      replacement += floatRun
      if (after) replacement += buildTextRun(runBlock, after)
    }

    return xml.slice(0, rStart) + replacement + xml.slice(runEnd)
  }
  return null
}

function placeSignature(xml: string, img: ImageRef): string {
  const floated = placeSignatureMarkerFloating(xml, img)
  if (floated) return floated

  // запасные пути для шаблонов без маркера — обычная inline-вставка у линии
  const imageRunXml = buildImageRun(img.rId, img.name, img.cx, img.cy, img.docPrId, {
    verticalAlign: 'signatureLine',
  })
  let next = replaceUnderscoreRunNearPodpis(xml, imageRunXml)
  if (next !== xml) return next

  next = replaceUnderscoreNearText(xml, imageRunXml, ['директор', 'руководитель'], 'tableRow')
  if (next !== xml) return next

  return replaceUnderscoreNearText(xml, imageRunXml, ['подпись'], 'paragraph')
}

function placeStamp(xml: string, imageRunXml: string): string {
  let next = replaceAnyMarkerInRuns(xml, STAMP_TAG_VARIANTS, imageRunXml)
  if (next !== xml) return next

  next = insertImageAfterTextInRun(xml, 'М.П.', imageRunXml, 0)
  if (next !== xml) return next

  next = insertImageAfterTextInRun(xml, 'М. П.', imageRunXml, 0)
  if (next !== xml) return next

  next = insertImageInNewParagraphAfter(xml, 'Подпись', imageRunXml)
  if (next !== xml) return next

  return insertImageInNewParagraphAfterTableRow(xml, 'директор', imageRunXml)
}

export async function applyBrandingToDocx(
  docxBuffer: Buffer,
  options: {
    stamp?: { buffer: Buffer; mimeType: string } | null
    signature?: { buffer: Buffer; mimeType: string } | null
    documentCategory?: string | null
  }
): Promise<Buffer> {
  if (!options.stamp?.buffer && !options.signature?.buffer) {
    return docxBuffer
  }

  const zip = new PizZip(docxBuffer)
  const docFile = zip.file('word/document.xml')
  if (!docFile) return docxBuffer

  let xml = docFile.asText()
  let docPrId = 9000

  if (options.signature?.buffer) {
    const { cx, cy } = imageExtentEmu(options.signature.buffer, 'signature')
    const rId = addImageToZip(zip, options.signature.buffer, options.signature.mimeType, 'sign')
    xml = placeSignature(xml, { rId, name: 'Signature', cx, cy, docPrId: docPrId++ })
  }

  if (options.stamp?.buffer) {
    const { cx, cy } = imageExtentEmu(options.stamp.buffer, 'stamp')
    const rId = addImageToZip(zip, options.stamp.buffer, options.stamp.mimeType, 'stamp')
    const run = buildImageRun(rId, 'Stamp', cx, cy, docPrId++)
    xml = placeStamp(xml, run)
  }

  zip.file('word/document.xml', xml)
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer
}

import { parseCellAddress, columnLettersToIndex } from '@/lib/document-renderer/xlsx-patcher/cell-address'

/**
 * Геометрия XLSX-листа в EMU: позволяет вычислить прямоугольник любой ячейки
 * (с учётом объединений) из ширин колонок и высот строк шаблона. Нужно для
 * центрирования печати/подписи независимо от размеров загруженного изображения
 * (мультитенантность: у каждой компании своя картинка произвольных пропорций).
 */

const EMU_PER_PX = 9525
const EMU_PER_POINT = 12700
const MAX_DIGIT_WIDTH = 7 // ширина цифры в px для шрифта по умолчанию
const DEFAULT_COL_CHARS = 8.43
const DEFAULT_ROW_POINTS = 15

export interface RectEmu {
  x: number
  y: number
  w: number
  h: number
}

interface SheetGeometry {
  colWidthPx: (col: number) => number
  rowHeightPt: (row: number) => number
  /** Левый край колонки (0-based) в EMU */
  colLeftEmu: (col: number) => number
  /** Верхний край строки (0-based) в EMU */
  rowTopEmu: (row: number) => number
  /** Диапазон объединения, содержащего ячейку, либо null */
  mergeOf: (col: number, row: number) => { c1: number; r1: number; c2: number; r2: number } | null
}

function charsToPx(chars: number): number {
  // Формула Excel для ширины колонки в пикселях
  return Math.round((chars * MAX_DIGIT_WIDTH + 5) / MAX_DIGIT_WIDTH * 256) / 256 * MAX_DIGIT_WIDTH
}

function buildGeometry(sheetXml: string): SheetGeometry {
  // defaultColWidth / defaultRowHeight
  const fmt = sheetXml.match(/<sheetFormatPr\b[^>]*>/)?.[0] ?? ''
  const defColChars = parseFloat(fmt.match(/defaultColWidth="([\d.]+)"/)?.[1] ?? '') || DEFAULT_COL_CHARS
  const defRowPt = parseFloat(fmt.match(/defaultRowHeight="([\d.]+)"/)?.[1] ?? '') || DEFAULT_ROW_POINTS
  const defColPx = charsToPx(defColChars)

  let m: RegExpExecArray | null

  // ширины колонок: <col min=".." max=".." width=".."/>
  const colWidths = new Map<number, number>()
  const colsBlock = sheetXml.match(/<cols>[\s\S]*?<\/cols>/)?.[0] ?? ''
  const colRe = /<col\b[^>]*\bmin="(\d+)"[^>]*\bmax="(\d+)"[^>]*\bwidth="([\d.]+)"[^>]*\/>/g
  while ((m = colRe.exec(colsBlock)) !== null) {
    const min = parseInt(m[1], 10)
    const max = parseInt(m[2], 10)
    const px = charsToPx(parseFloat(m[3]))
    for (let c = min; c <= max; c++) colWidths.set(c - 1, px) // 0-based
  }

  // высоты строк: <row r=".." ht=".."/>
  const rowHeights = new Map<number, number>()
  const rowRe = /<row\b[^>]*\br="(\d+)"[^>]*>/g
  while ((m = rowRe.exec(sheetXml)) !== null) {
    const r = parseInt(m[1], 10)
    const ht = m[0].match(/\bht="([\d.]+)"/)
    if (ht) rowHeights.set(r - 1, parseFloat(ht[1]))
  }

  // объединения
  const merges: { c1: number; r1: number; c2: number; r2: number }[] = []
  const mergeRe = /<mergeCell ref="([A-Z]+\d+):([A-Z]+\d+)"\/>/g
  while ((m = mergeRe.exec(sheetXml)) !== null) {
    const a = parseCellAddress(m[1])
    const b = parseCellAddress(m[2])
    merges.push({
      c1: columnLettersToIndex(a.col),
      r1: a.row - 1,
      c2: columnLettersToIndex(b.col),
      r2: b.row - 1,
    })
  }

  const colWidthPx = (col: number) => colWidths.get(col) ?? defColPx
  const rowHeightPt = (row: number) => rowHeights.get(row) ?? defRowPt

  // кумулятивные суммы с кэшем
  const colLeftCache = new Map<number, number>()
  const colLeftEmu = (col: number): number => {
    if (colLeftCache.has(col)) return colLeftCache.get(col)!
    let px = 0
    for (let c = 0; c < col; c++) px += colWidthPx(c)
    const emu = Math.round(px * EMU_PER_PX)
    colLeftCache.set(col, emu)
    return emu
  }
  const rowTopCache = new Map<number, number>()
  const rowTopEmu = (row: number): number => {
    if (rowTopCache.has(row)) return rowTopCache.get(row)!
    let pt = 0
    for (let r = 0; r < row; r++) pt += rowHeightPt(r)
    const emu = Math.round(pt * EMU_PER_POINT)
    rowTopCache.set(row, emu)
    return emu
  }

  const mergeOf = (col: number, row: number) =>
    merges.find((m) => col >= m.c1 && col <= m.c2 && row >= m.r1 && row <= m.r2) ?? null

  return { colWidthPx, rowHeightPt, colLeftEmu, rowTopEmu, mergeOf }
}

/** Прямоугольник ячейки (с учётом объединения) в EMU. */
export function cellRectEmu(sheetXml: string, address: string): RectEmu {
  const geo = buildGeometry(sheetXml)
  const { col, row } = parseCellAddress(address)
  const c = columnLettersToIndex(col)
  const r = row - 1
  const merge = geo.mergeOf(c, r)
  const c1 = merge ? merge.c1 : c
  const r1 = merge ? merge.r1 : r
  const c2 = merge ? merge.c2 : c
  const r2 = merge ? merge.r2 : r

  const x = geo.colLeftEmu(c1)
  const y = geo.rowTopEmu(r1)
  let w = 0
  for (let cc = c1; cc <= c2; cc++) w += Math.round(geo.colWidthPx(cc) * EMU_PER_PX)
  let h = 0
  for (let rr = r1; rr <= r2; rr++) h += Math.round(geo.rowHeightPt(rr) * EMU_PER_POINT)
  return { x, y, w, h }
}

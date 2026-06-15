import { categoryToContentType } from '@/lib/document-editor/registry'
import {
  columnLettersToIndex,
  parseCellAddress,
} from '@/lib/document-renderer/xlsx-patcher/cell-address'
import { BRAND_TAG_SIGNATURE, BRAND_TAG_STAMP } from './brand-tags'

/** Координаты вставки изображений (0-based col/row, как в ExcelJS) */
export interface ImagePlacement {
  col: number
  row: number
  width: number
  height: number
  /** Макс. размер с сохранением пропорций */
  maxWidth?: number
  maxHeight?: number
}

export interface DocumentBrandingAnchors {
  stamp?: ImagePlacement[]
  signature?: ImagePlacement[]
}

/** Якорь по адресу ячейки шаблона. rowOff/colOff — сдвиг в ячейках:
 *  подпись ставим выше подписной строки, печать центрируем на «М.П.». */
function at(cell: string, maxWidth: number, maxHeight: number, rowOff = 0, colOff = 0): ImagePlacement {
  const { col, row } = parseCellAddress(cell)
  return {
    col: columnLettersToIndex(col) + colOff,
    row: row - 1 + rowOff,
    width: maxWidth,
    height: maxHeight,
    maxWidth,
    maxHeight,
  }
}

/**
 * Координаты печати/подписи в XLSX-формах — по фактическим ячейкам шаблона
 * (строки «(подпись)» и «М.П.» стороны исполнителя/продавца):
 *  УПД  — руководитель (AZ43), товар передал (AA54), ответственный (AA61), М.П. (M65)
 *  КС-2 — блок «Сдал»: подпись (E40), М.П. (B42)
 *  КС-3 — блок «Подрядчик»: подпись (D43), М.П. (A45)
 */
export const XLSX_BRANDING_ANCHORS: Record<string, DocumentBrandingAnchors> = {
  UPD: {
    signature: [at('AZ43', 90, 30, -2), at('AA54', 90, 30, -1), at('AA61', 90, 30, -1)],
    stamp: [at('M65', 85, 85, -1)],
  },
  KS2: {
    signature: [at('E40', 95, 32, -1)],
    stamp: [at('B42', 80, 80, -1)],
  },
  KS3: {
    signature: [at('D43', 95, 32, -2)],
    stamp: [at('A45', 80, 80, -1)],
  },
}

export function resolveXlsxBrandingCategory(category: string | null | undefined): string | null {
  if (!category) return null
  if (category in XLSX_BRANDING_ANCHORS) return category
  return null
}

export interface DocxTextAnchor {
  searches: string[]
  occurrence?: number
}

export interface DocxBrandingAnchors {
  stamp?: DocxTextAnchor
  signature?: DocxTextAnchor
}

/** Текстовые якоря для вставки печати/подписи в DOCX */
export const DOCX_BRANDING_ANCHORS: Record<string, DocxBrandingAnchors> = {
  COMMERCIAL_OFFER: {
    stamp: { searches: [BRAND_TAG_STAMP, '____stamp____', '[[STAMP]]', 'М.П.'], occurrence: 0 },
    signature: {
      searches: [BRAND_TAG_SIGNATURE, '____signature____', '[[SIGNATURE]]'],
      occurrence: 0,
    },
  },
  INVOICE: {
    stamp: { searches: [BRAND_TAG_STAMP, '____stamp____', '[[STAMP]]', 'М.П.'], occurrence: 0 },
    signature: {
      searches: [BRAND_TAG_SIGNATURE, '____signature____', '[[SIGNATURE]]'],
      occurrence: 0,
    },
  },
  CONTRACT: {
    stamp: { searches: [BRAND_TAG_STAMP, '____stamp____', '[[STAMP]]', 'М.П.'], occurrence: 0 },
    signature: {
      searches: [BRAND_TAG_SIGNATURE, '____signature____', '[[SIGNATURE]]'],
      occurrence: 0,
    },
  },
  SERVICE_ACT: {
    stamp: { searches: ['М.П.', 'М. П.'], occurrence: 0 },
    signature: {
      searches: ['расшифровка подписи', '(расшифровка подписи)'],
      occurrence: 0,
    },
  },
}

const DEFAULT_DOCX_ANCHORS: DocxBrandingAnchors = {
  stamp: { searches: [BRAND_TAG_STAMP, '____stamp____', '[[STAMP]]', 'М.П.'] },
  signature: { searches: [BRAND_TAG_SIGNATURE, '____signature____', '[[SIGNATURE]]'] },
}

export function resolveDocxBrandingAnchors(
  category: string | null | undefined
): DocxBrandingAnchors {
  const contentType = categoryToContentType(category) ?? category
  if (contentType && contentType in DOCX_BRANDING_ANCHORS) {
    return DOCX_BRANDING_ANCHORS[contentType as keyof typeof DOCX_BRANDING_ANCHORS]
  }
  return DEFAULT_DOCX_ANCHORS
}

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
  stamp?: ImagePlacement
  signature?: ImagePlacement
}

function cellPlacement(
  cell: string,
  maxWidth: number,
  maxHeight: number
): ImagePlacement {
  const { col, row } = parseCellAddress(cell)
  return {
    col: columnLettersToIndex(col),
    row: row - 1,
    width: maxWidth,
    height: maxHeight,
    maxWidth,
    maxHeight,
  }
}

/** Позиции печати/подписи для XLSX-форм (ячейки из шаблона ФНС) */
export const XLSX_BRANDING_ANCHORS: Record<string, DocumentBrandingAnchors> = {
  UPD: {
    /** Строка подписи продавца (AZ41), не блок «Генеральный директор» */
    signature: cellPlacement('AZ41', 105, 38),
    /** М.П. продавца */
    stamp: cellPlacement('M65', 95, 95),
  },
  KS2: {
    stamp: { col: 1, row: 41, width: 95, height: 95, maxWidth: 95, maxHeight: 95 },
    signature: { col: 8, row: 38, width: 105, height: 38, maxWidth: 105, maxHeight: 38 },
  },
  KS3: {
    stamp: { col: 0.3, row: 39, width: 95, height: 95, maxWidth: 95, maxHeight: 95 },
    signature: { col: 6.2, row: 41, width: 105, height: 38, maxWidth: 105, maxHeight: 38 },
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

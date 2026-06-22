import { categoryToContentType } from '@/lib/document-editor/registry'
import { BRAND_TAG_SIGNATURE, BRAND_TAG_STAMP } from './brand-tags'

/**
 * Якорь печати/подписи в XLSX. Указывает только ЯЧЕЙКУ-ориентир и режим —
 * изображение центрируется по геометрии шаблона независимо от своих размеров
 * (мультитенантность: у каждой компании своя картинка). Размер нормализуется
 * в бокс maxWidth×maxHeight с сохранением пропорций.
 *
 * mode:
 *  - 'signature' — центр по горизонтали ячейки, низ картинки на подписной линии
 *    (ячейка-ориентир = подпись-caption «(подпись)», линия — её верхняя граница);
 *  - 'stamp' — по центру ячейки «М.П.».
 */
export interface BrandPlacement {
  cell: string
  mode: 'signature' | 'stamp'
  maxWidth: number
  maxHeight: number
}

export interface DocumentBrandingAnchors {
  stamp?: BrandPlacement[]
  signature?: BrandPlacement[]
}

// Нормализованные боксы (подпись крупная и заметная, печать — квадрат)
const SIGNATURE_BOX = { maxWidth: 150, maxHeight: 50 }
const STAMP_BOX = { maxWidth: 120, maxHeight: 120 }

function sig(cell: string): BrandPlacement {
  return { cell, mode: 'signature', ...SIGNATURE_BOX }
}
function stamp(cell: string): BrandPlacement {
  return { cell, mode: 'stamp', ...STAMP_BOX }
}

/**
 * Ячейки-ориентиры печати/подписи в XLSX-формах (сторона исполнителя/продавца):
 *  УПД  — руководитель (AZ43), товар передал (AA54), ответственный (AA61), М.П. (M65)
 *  КС-2 — блок «Сдал»: подпись (E40), М.П. (B42)
 *  КС-3 — блок «Подрядчик»: подпись (D43), М.П. (A45)
 */
export const XLSX_BRANDING_ANCHORS: Record<string, DocumentBrandingAnchors> = {
  UPD: {
    signature: [sig('AZ43'), sig('AA54'), sig('AA61')],
    stamp: [stamp('M65')],
  },
  KS2: {
    signature: [sig('E40')],
    stamp: [stamp('B42')],
  },
  KS3: {
    signature: [sig('D43')],
    stamp: [stamp('A45')],
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

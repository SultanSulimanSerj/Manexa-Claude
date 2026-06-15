/** Адреса ячеек формы КС-2 (шаблон templates/documents/ks2-template.xlsx) */
export const KS2_CELLS = {
  buyer: 'C9',
  seller: 'C11',
  constructionSite: 'C14',
  objectName: 'C16',
  contractNumber: 'L18',
  contractDateDay: 'L19',
  contractDateMonth: 'M19',
  contractDateYear: 'N19',
  documentNumber: 'D24',
  documentDate: 'F24',
  contractCost: 'F27',
  itemStartRow: 32,
  totalRow: 35,
  sellerDirectorPosition: 'B39',
  sellerDirectorName: 'I39',
} as const

export const KS2_ITEM_COLS = {
  lineNumber: 'A',
  positionNumber: 'B',
  name: 'C',
  unit: 'F',
  quantity: 'G',
  unitPrice: 'J',
  total: 'L',
} as const

export const KS2_MAX_ITEM_ROWS = 3

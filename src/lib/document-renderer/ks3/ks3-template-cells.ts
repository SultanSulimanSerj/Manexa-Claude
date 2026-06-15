/** Адреса ячеек формы КС-3 (шаблон templates/documents/ks3-template.xlsx) */
export const KS3_CELLS = {
  buyer: 'B9',
  seller: 'B11',
  constructionSite: 'B14',
  contractNumber: 'I16',
  contractDateDay: 'I17',
  contractDateMonth: 'K17',
  contractDateYear: 'M17',
  documentNumber: 'D22',
  documentDate: 'G22',
  totalWorksRow: 28,
  itemStartRow: 30,
  subtotalRow: 33,
  vatRow: 34,
  totalWithVatRow: 35,
  sellerDirectorPosition: 'B42',
  sellerDirectorName: 'G42',
} as const

export const KS3_ITEM_COLS = {
  lineNumber: 'A',
  name: 'B',
  amountFromStart: 'E',
  amountFromYear: 'H',
  amountForPeriod: 'K',
} as const

export const KS3_MAX_ITEM_ROWS = 3

const CATEGORY_LABELS: Record<string, string> = {
  UPD: 'УПД',
  INVOICE: 'Счёт',
  CONTRACT: 'Договор',
  COMMERCIAL: 'КП',
  KS2: 'КС-2',
  KS3: 'КС-3',
  SERVICE_ACT: 'АВР',
  GENERAL: 'Файл',
}

const CATEGORY_COLORS: Record<string, string> = {
  UPD: 'bg-green-100 text-green-800',
  INVOICE: 'bg-blue-100 text-blue-800',
  CONTRACT: 'bg-purple-100 text-purple-800',
  COMMERCIAL: 'bg-orange-100 text-orange-800',
}

export function getCategoryLabel(category: string | null | undefined): string {
  if (!category) return 'Документ'
  return CATEGORY_LABELS[category] || category
}

export function getCategoryColor(category: string | null | undefined): string {
  return CATEGORY_COLORS[category || ''] || 'bg-gray-100 text-gray-700'
}

export const EDITABLE_CATEGORIES = new Set([
  'UPD',
  'INVOICE',
  'CONTRACT',
  'COMMERCIAL',
  'KS2',
  'KS3',
  'SERVICE_ACT',
])

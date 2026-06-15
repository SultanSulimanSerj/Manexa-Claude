import type { ValidationIssue, ValidationResult } from './types'

function isValidInn(inn: string): boolean {
  const digits = inn.replace(/\D/g, '')
  return digits.length === 10 || digits.length === 12
}

export function validateFnsFormDocument(
  data: {
    documentNumber?: string
    documentDate?: string
    seller?: { legalName?: string; name?: string; inn?: string }
    buyer?: { legalName?: string; name?: string; inn?: string }
    items?: unknown[]
    objectName?: string
  } | null | undefined,
  label: string,
  maxItems = 9
): ValidationResult {
  const issues: ValidationIssue[] = []

  if (!data) {
    return { valid: false, issues: [{ field: 'data', message: 'Нет данных документа', severity: 'error' }] }
  }

  if (!data.documentNumber?.trim()) {
    issues.push({ field: 'documentNumber', message: 'Укажите номер документа', severity: 'error' })
  }
  if (!data.documentDate?.trim()) {
    issues.push({ field: 'documentDate', message: 'Укажите дату документа', severity: 'error' })
  }
  if (!data.seller?.legalName?.trim() && !data.seller?.name?.trim()) {
    issues.push({ field: 'seller.name', message: 'Укажите наименование исполнителя', severity: 'error' })
  }
  if (data.seller?.inn?.trim() && !isValidInn(data.seller.inn)) {
    issues.push({ field: 'seller.inn', message: 'ИНН исполнителя должен содержать 10 или 12 цифр', severity: 'error' })
  }
  if (!data.buyer?.legalName?.trim() && !data.buyer?.name?.trim()) {
    issues.push({ field: 'buyer.name', message: 'Укажите наименование заказчика', severity: 'error' })
  }

  const items = Array.isArray(data.items) ? data.items : []
  if (!items.length) {
    issues.push({
      field: 'items',
      message: `Добавьте хотя бы одну позицию для ${label}`,
      severity: 'error',
    })
  }
  if (items.length > maxItems) {
    issues.push({
      field: 'items',
      message: `В ${label} допускается не более ${maxItems} позиций на одном листе`,
      severity: 'error',
    })
  }

  if ('objectName' in data && !data.objectName?.trim()) {
    issues.push({ field: 'objectName', message: 'Укажите наименование объекта', severity: 'warning' })
  }

  return { valid: issues.every((i) => i.severity !== 'error'), issues }
}

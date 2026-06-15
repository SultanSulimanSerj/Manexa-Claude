import type { DocumentParty } from '@/lib/document-editor/common'

export function formatMoney(value: number): string {
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function buildOrganizationLine(party: DocumentParty): string {
  const name = party.legalName || party.name
  const parts = [name]
  if (party.address) parts.push(party.address)
  if (party.inn) parts.push(`ИНН ${party.inn}`)
  if (party.kpp) parts.push(`КПП ${party.kpp}`)
  return parts.join(', ')
}

export function parseRuDateParts(dateStr: string): { day: string; month: string; year: string } | null {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(dateStr.trim())
  if (!match) return null
  return {
    day: match[1],
    month: match[2],
    year: match[3],
  }
}

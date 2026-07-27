import { prisma } from './prisma'

const SETTINGS_ID = 'platform'

/** Singleton-настройки платформы (реквизиты продавца, налоги, биллинг). */
export async function getPlatformSettings() {
  const existing = await prisma.platformSettings.findUnique({ where: { id: SETTINGS_ID } })
  if (existing) return existing
  return prisma.platformSettings.create({ data: { id: SETTINGS_ID } })
}

/** Заполнены ли минимальные реквизиты продавца для выставления счёта. */
export function sellerRequisitesComplete(s: {
  sellerLegalName?: string | null
  sellerInn?: string | null
  sellerBankAccount?: string | null
  sellerBankBik?: string | null
}): boolean {
  return Boolean(s.sellerLegalName && s.sellerInn && s.sellerBankAccount && s.sellerBankBik)
}

/**
 * Расчёт суммы счёта.
 * Годовая (12 мес) скидка применяется к подытогу. При OSN НДС уже «в том числе».
 */
export function calcInvoiceAmount(params: {
  priceMonthly: number
  months: number
  annualDiscountPercent: number
  taxMode: string
  vatRate: number
}): { subtotal: number; discountPercent: number; amount: number; vatRate: number; vatAmount: number } {
  const round2 = (n: number) => Math.round(n * 100) / 100
  const subtotal = round2(params.priceMonthly * params.months)
  const discountPercent = params.months >= 12 ? params.annualDiscountPercent : 0
  const amount = round2(subtotal * (1 - discountPercent / 100))
  const vatRate = params.taxMode === 'OSN' ? params.vatRate : 0
  // НДС «в том числе»: выделяем из итога
  const vatAmount = vatRate > 0 ? round2((amount * vatRate) / (100 + vatRate)) : 0
  return { subtotal, discountPercent, amount, vatRate, vatAmount }
}

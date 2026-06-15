import type {
  CommercialOfferDocumentContent,
  ContractDocumentContent,
  InvoiceDocumentContent,
  ServiceActDocumentContent,
} from '@/lib/document-editor/types'
import { rublesToWords, directorShortName } from '@/lib/number-to-words-ru'
import type { DocumentLineItem, DocumentParty } from '@/lib/document-editor/common'

function formatMoney(value: number): string {
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function mapContractToTemplateData(content: ContractDocumentContent): Record<string, unknown> {
  const d = content.data
  return {
    contractNumber: d.contractNumber,
    contractDate: d.contractDate,
    city: d.city,
    executorName: d.executorName,
    executorLegalName: d.executorLegalName,
    executorDirector: d.executorDirector,
    executorDirectorPosition: d.executorDirectorPosition,
    executorInn: d.executorInn,
    executorKpp: d.executorKpp || '',
    executorOgrn: d.executorOgrn,
    executorAddress: d.executorAddress,
    executorPhone: d.executorPhone || '',
    executorEmail: d.executorEmail || '',
    executorBankAccount: d.executorBankAccount || '',
    executorBankName: d.executorBankName || '',
    executorBankBik: d.executorBankBik || '',
    executorCorrespondentAccount: d.executorCorrespondentAccount || '',
    clientName: d.clientName,
    clientLegalName: d.clientLegalName,
    clientDirector: d.clientDirector,
    clientInn: d.clientInn,
    clientKpp: d.clientKpp || '',
    clientOgrn: d.clientOgrn || '',
    clientAddress: d.clientLegalAddress || '',
    clientPhone: d.clientPhone || '',
    clientEmail: d.clientEmail || '',
    clientBankAccount: d.clientBankAccount || '',
    clientBankName: d.clientBankName || '',
    clientBankBik: d.clientBankBik || '',
    clientCorrespondentAccount: d.clientCorrespondentAccount || '',
    projectName: d.projectName,
    workAddress: d.workAddress,
    startDate: d.startDate,
    endDate: d.endDate,
    totalAmount: d.totalAmount,
    totalAmountWords: d.specification?.totalWithVat
      ? rublesToWords(d.specification.totalWithVat)
      : '',
    subject: d.projectDescription || d.projectName,
    items: (d.specification?.items || []).map((item, index) => ({
      lineNumber: String(index + 1),
      name: item.name,
      quantity: String(item.quantity),
      unit: item.unit,
      unitPrice: formatMoney(item.unitPrice),
      total: formatMoney(item.total),
    })),
  }
}

export function mapCommercialOfferToTemplateData(
  content: CommercialOfferDocumentContent
): Record<string, unknown> {
  const d = content.data
  const total = d.totalWithVat ?? d.total ?? 0
  return {
    contractNumber: d.offerNumber,
    contractDate: d.offerDate,
    city: d.city || '',
    validUntil: d.validUntil || '',
    executorName: d.executorName || '',
    executorLegalName: d.executorLegalName || d.executorName || '',
    executorDirector: d.executorDirector || '',
    executorDirectorPosition: 'Генеральный директор',
    directorShortName: directorShortName(d.executorDirector),
    executorInn: d.executorInn || '',
    executorKpp: d.executorKpp || '',
    executorAddress: '',
    executorPhone: d.executorPhone || '',
    executorEmail: d.executorEmail || '',
    executorBankAccount: '',
    executorBankName: '',
    executorBankBik: '',
    executorCorrespondentAccount: '',
    clientName: d.clientName || '',
    clientLegalName: d.clientLegalName || d.clientName || '',
    clientDirector: '',
    clientInn: '',
    clientKpp: '',
    clientOgrn: '',
    clientAddress: '',
    clientPhone: '',
    clientEmail: '',
    clientBankAccount: '',
    clientBankName: '',
    clientBankBik: '',
    clientCorrespondentAccount: '',
    projectName: d.projectName || '',
    workAddress: d.workAddress || '',
    startDate: '',
    endDate: '',
    totalAmount: formatMoney(total),
    totalAmountWords: rublesToWords(total),
    estimateName: d.estimateName || '',
    items: (d.items || []).map((item, index) => ({
      lineNumber: String(index + 1),
      name: item.name,
      quantity: String(item.quantity),
      unit: item.unit,
      unitPrice: formatMoney(item.unitPrice),
      total: formatMoney(item.total),
    })),
  }
}

function buildPartyLine(party: DocumentParty): string {
  const name = party.legalName || party.name
  const parts = [name]
  if (party.inn) parts.push(`ИНН ${party.inn}`)
  if (party.kpp) parts.push(`КПП ${party.kpp}`)
  if (party.address) parts.push(party.address)
  return parts.join(', ')
}

function buildSellerAddressLine(party: DocumentParty): string {
  const name = party.legalName || party.name
  if (party.address) return `${name}, ${party.address}`
  return name
}

function itemUnitPrice(item: DocumentLineItem): number {
  if (!item.quantity) return 0
  return item.totalWithVat / item.quantity
}

function buildItemsSummary(itemsCount: number, total: number): string {
  const rubles = Math.floor(total)
  const kopecks = Math.round((total - rubles) * 100)
  return `Всего наименований ${itemsCount} на сумму ${rubles} рублей ${String(kopecks).padStart(2, '0')} копеек`
}

function buildPaymentTerms(data: InvoiceDocumentContent['data']): string {
  const parts: string[] = []
  if (data.paymentPurpose?.trim()) parts.push(data.paymentPurpose.trim())
  if (data.dueDate?.trim()) parts.push(`Оплатить до ${data.dueDate.trim()}`)
  return parts.join('. ')
}

function buildSellerFullLine(party: DocumentParty): string {
  const parts: string[] = []
  const name = party.legalName || party.name
  if (party.address) parts.push(`${name}, ${party.address}`)
  else parts.push(name)
  if (party.inn) parts.push(`ИНН ${party.inn}`)
  if (party.kpp) parts.push(`КПП ${party.kpp}`)
  if (party.bankAccount && party.bankName) {
    parts.push(`р/с ${party.bankAccount} в ${party.bankName}`)
  }
  if (party.bankCity) parts.push(party.bankCity)
  if (party.bankBik) parts.push(`БИК ${party.bankBik}`)
  if (party.correspondentAccount) parts.push(`корр/с ${party.correspondentAccount}`)
  return parts.join(', ')
}

function buildBuyerFullLine(party: DocumentParty): string {
  return buildSellerFullLine(party)
}

export function mapServiceActToTemplateData(
  content: ServiceActDocumentContent
): Record<string, unknown> {
  const data = content.data
  const seller = data.seller
  const total = data.totals.totalWithVat
  const hasVat = data.totals.hasVat && data.totals.totalVat > 0

  return {
    documentNumber: data.documentNumber,
    documentDate: data.documentDate,
    sellerLine: buildSellerFullLine(seller),
    buyerLine: buildBuyerFullLine(data.buyer),
    basisText:
      data.basisText ||
      (data.contractNumber
        ? `Договор № ${data.contractNumber}${data.contractDate ? ` от ${data.contractDate}` : ''}`
        : ''),
    items: data.items.map((item) => ({
      lineNumber: String(item.lineNumber),
      name: item.name,
      quantity: String(item.quantity),
      unit: item.unit,
      unitPrice: formatMoney(itemUnitPrice(item)),
      total: formatMoney(item.totalWithVat),
    })),
    totalFormatted: formatMoney(total),
    vatLabel: hasVat ? formatMoney(data.totals.totalVat) : 'Без НДС',
    totalInWords: `${rublesToWords(total)}${hasVat ? '' : '. Без НДС'}`,
    directorShortName: directorShortName(seller.directorName),
  }
}

export function mapInvoiceToTemplateData(
  content: InvoiceDocumentContent
): Record<string, unknown> {
  const data = content.data
  const seller = data.seller
  const total = data.totals.totalWithVat
  const hasVat = data.totals.hasVat && data.totals.totalVat > 0

  return {
    documentNumber: data.documentNumber,
    documentDate: data.documentDate,
    sellerAddressLine: buildSellerAddressLine(seller),
    bankName: seller.bankName || '',
    bankBik: seller.bankBik || '',
    bankCity: seller.bankCity || '',
    correspondentAccount: seller.correspondentAccount || '',
    sellerInn: seller.inn || '',
    sellerKpp: seller.kpp || '',
    sellerLegalName: seller.legalName || seller.name || '',
    bankAccount: seller.bankAccount || '',
    buyerLine: buildPartyLine(data.buyer),
    items: data.items.map((item) => ({
      lineNumber: String(item.lineNumber),
      name: item.name,
      quantity: String(item.quantity),
      unit: item.unit,
      unitPrice: formatMoney(itemUnitPrice(item)),
      total: formatMoney(item.totalWithVat),
    })),
    totalFormatted: formatMoney(total),
    vatLabel: hasVat ? 'НДС' : 'Без налога (НДС)',
    vatDisplay: hasVat ? formatMoney(data.totals.totalVat) : '-',
    itemsSummary: buildItemsSummary(data.items.length, total),
    totalInWords: rublesToWords(total),
    paymentTerms: buildPaymentTerms(data),
    directorShortName: directorShortName(seller.directorName),
  }
}

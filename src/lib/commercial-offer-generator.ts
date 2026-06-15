import {
  Document,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from 'docx'
import type { SpecificationData, SpecificationItem } from './specification-appendix'

export interface CommercialOfferData {
  offerNumber: string
  offerDate: string
  city: string
  executorName: string
  executorLegalName: string
  executorInn?: string
  executorKpp?: string
  executorPhone: string
  executorEmail: string
  executorDirector?: string
  clientName: string
  clientLegalName: string
  projectName: string
  workAddress: string
  estimateName: string
  items: SpecificationItem[]
  total: number
  vatEnabled: boolean
  vatRate: number
  vatAmount: number
  totalWithVat: number
  validUntil: string
}

function formatMoney(value: number): string {
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function headerCell(text: string): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })],
    shading: { fill: 'E8E8E8' },
  })
}

function bodyCell(text: string): TableCell {
  return new TableCell({ children: [new Paragraph({ text })] })
}

export function generateCommercialOfferDocument(data: CommercialOfferData): Document {
  const tableRows = [
    new TableRow({
      children: [
        headerCell('№'),
        headerCell('Наименование'),
        headerCell('Кол-во'),
        headerCell('Ед.'),
        headerCell('Цена, ₽'),
        headerCell('Сумма, ₽'),
      ],
    }),
    ...data.items.map((item, index) =>
      new TableRow({
        children: [
          bodyCell(String(index + 1)),
          bodyCell(item.name),
          bodyCell(formatMoney(item.quantity)),
          bodyCell(item.unit),
          bodyCell(formatMoney(item.unitPrice)),
          bodyCell(formatMoney(item.total)),
        ],
      })
    ),
  ]

  const totalLine = data.vatEnabled
    ? `Итого с НДС (${data.vatRate}%): ${formatMoney(data.totalWithVat)} ₽`
    : `Итого: ${formatMoney(data.total)} ₽ (НДС не облагается)`

  return new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: `КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ № ${data.offerNumber}`,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
          }),
          new Paragraph({
            text: `г. ${data.city}, ${data.offerDate}`,
            alignment: AlignmentType.RIGHT,
            spacing: { after: 300 },
          }),
          new Paragraph({
            text: `${data.executorLegalName || data.executorName} предлагает ${data.clientLegalName || data.clientName} выполнить работы по проекту «${data.projectName}».`,
            spacing: { after: 200 },
            alignment: AlignmentType.JUSTIFIED,
          }),
          new Paragraph({
            text: `Смета: ${data.estimateName}`,
            spacing: { after: 100 },
          }),
          ...(data.workAddress
            ? [new Paragraph({ text: `Адрес объекта: ${data.workAddress}`, spacing: { after: 200 } })]
            : []),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1 },
              bottom: { style: BorderStyle.SINGLE, size: 1 },
              left: { style: BorderStyle.SINGLE, size: 1 },
              right: { style: BorderStyle.SINGLE, size: 1 },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
              insideVertical: { style: BorderStyle.SINGLE, size: 1 },
            },
            rows: tableRows,
          }),
          new Paragraph({
            text: totalLine,
            alignment: AlignmentType.RIGHT,
            spacing: { before: 200, after: 200 },
          }),
          new Paragraph({
            text: `Предложение действительно до ${data.validUntil}.`,
            spacing: { after: 200 },
          }),
          new Paragraph({
            text: `Контакты: ${data.executorPhone || '—'}, ${data.executorEmail || '—'}`,
            spacing: { after: 400 },
          }),
          new Paragraph({ text: data.executorLegalName || data.executorName, spacing: { after: 100 } }),
          new Paragraph({ text: '___________________ / Подпись' }),
        ],
      },
    ],
  })
}

export function buildSpecificationFromEstimate(
  estimate: {
    name: string
    total: unknown
    totalCost?: unknown
    profit?: unknown
    vatEnabled: boolean
    vatRate?: unknown
    vatAmount?: unknown
    totalWithVat?: unknown
    items?: Array<{
      name: string
      description?: string | null
      quantity: unknown
      unit: string
      unitPrice: unknown
      total: unknown
      category: string
    }>
  },
  contractNumber: string,
  contractDate: string,
  projectName: string,
  workAddress: string,
  startDate: string,
  endDate: string
): SpecificationData {
  return {
    estimateName: estimate.name,
    contractNumber,
    contractDate,
    projectName,
    workAddress,
    startDate,
    endDate,
    items: (estimate.items || []).map((item) => ({
      name: item.name,
      description: item.description,
      quantity: Number(item.quantity),
      unit: item.unit,
      unitPrice: Number(item.unitPrice),
      total: Number(item.total),
      category: item.category,
    })),
    total: Number(estimate.total),
    totalCost: Number(estimate.totalCost || 0),
    profit: Number(estimate.profit || 0),
    vatEnabled: estimate.vatEnabled,
    vatRate: Number(estimate.vatRate || 20),
    vatAmount: Number(estimate.vatAmount || 0),
    totalWithVat: Number(estimate.totalWithVat || estimate.total),
  }
}

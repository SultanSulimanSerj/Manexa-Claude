import type { Ks2DocumentData } from '../fns-form-types'
import type { XlsxCellAssignment } from '../types'
import { buildOrganizationLine, formatMoney, parseRuDateParts } from '../fns-cell-helpers'
import { KS2_CELLS, KS2_ITEM_COLS, KS2_MAX_ITEM_ROWS } from './ks2-template-cells'
import { directorShortName } from '@/lib/number-to-words-ru'

function assign(
  assignments: XlsxCellAssignment[],
  address: string,
  value: string | number | null
) {
  assignments.push({ address, value })
}

function clearItemRow(assignments: XlsxCellAssignment[], row: number) {
  for (const col of Object.values(KS2_ITEM_COLS)) {
    assign(assignments, `${col}${row}`, null)
  }
}

export interface Ks2XlsxPatchPlan {
  assignments: XlsxCellAssignment[]
  itemCount: number
}

export function buildKs2XlsxPatchPlan(data: Ks2DocumentData): Ks2XlsxPatchPlan {
  const items = data.items.slice(0, KS2_MAX_ITEM_ROWS)
  if (!items.length) {
    throw new Error('Нет позиций для выгрузки в КС-2')
  }
  if (data.items.length > KS2_MAX_ITEM_ROWS) {
    throw new Error(
      `В шаблоне КС-2 допускается не более ${KS2_MAX_ITEM_ROWS} позиций. Разбейте на несколько актов.`
    )
  }

  const assignments: XlsxCellAssignment[] = []

  for (let row = KS2_CELLS.itemStartRow; row < KS2_CELLS.totalRow; row++) {
    clearItemRow(assignments, row)
  }

  assign(assignments, KS2_CELLS.buyer, buildOrganizationLine(data.buyer))
  assign(assignments, KS2_CELLS.seller, buildOrganizationLine(data.seller))
  assign(assignments, KS2_CELLS.constructionSite, data.projectName || data.objectName)
  assign(assignments, KS2_CELLS.objectName, data.objectName)

  if (data.contractNumber) {
    assign(assignments, KS2_CELLS.contractNumber, data.contractNumber)
  }
  if (data.contractDate) {
    const parts = parseRuDateParts(data.contractDate)
    if (parts) {
      assign(assignments, KS2_CELLS.contractDateDay, parts.day)
      assign(assignments, KS2_CELLS.contractDateMonth, parts.month)
      assign(assignments, KS2_CELLS.contractDateYear, parts.year)
    }
  }

  assign(assignments, KS2_CELLS.documentNumber, data.documentNumber)
  assign(assignments, KS2_CELLS.documentDate, data.documentDate)
  assign(assignments, KS2_CELLS.contractCost, data.totals.totalWithoutVat)

  items.forEach((item, index) => {
    const row = KS2_CELLS.itemStartRow + index
    assign(assignments, `${KS2_ITEM_COLS.lineNumber}${row}`, item.lineNumber)
    assign(assignments, `${KS2_ITEM_COLS.positionNumber}${row}`, item.lineNumber)
    assign(assignments, `${KS2_ITEM_COLS.name}${row}`, item.name)
    assign(assignments, `${KS2_ITEM_COLS.unit}${row}`, item.unit || 'шт')
    assign(assignments, `${KS2_ITEM_COLS.quantity}${row}`, item.quantity)
    assign(
      assignments,
      `${KS2_ITEM_COLS.unitPrice}${row}`,
      item.quantity ? item.totalWithoutVat / item.quantity : item.unitPriceWithoutVat
    )
    assign(assignments, `${KS2_ITEM_COLS.total}${row}`, item.totalWithoutVat)
  })

  const total = data.totals.totalWithoutVat
  assign(assignments, `${KS2_ITEM_COLS.total}${KS2_CELLS.totalRow}`, total)
  assign(assignments, `G${KS2_CELLS.totalRow}`, items.reduce((s, i) => s + i.quantity, 0))

  const directorPosition = data.seller.directorPosition || 'Генеральный директор'
  const directorName = directorShortName(data.seller.directorName) || data.seller.directorName || ''
  if (directorPosition) {
    assign(assignments, KS2_CELLS.sellerDirectorPosition, directorPosition)
  }
  if (directorName) {
    assign(assignments, KS2_CELLS.sellerDirectorName, directorName)
  }

  return { assignments, itemCount: items.length }
}

/** @deprecated используйте buildKs2XlsxPatchPlan */
export function buildKs2CellAssignments(data: Ks2DocumentData): XlsxCellAssignment[] {
  return buildKs2XlsxPatchPlan(data).assignments
}

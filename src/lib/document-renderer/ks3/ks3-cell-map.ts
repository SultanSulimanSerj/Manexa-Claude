import type { Ks3DocumentData } from '../fns-form-types'
import type { XlsxCellAssignment } from '../types'
import { buildOrganizationLine, parseRuDateParts } from '../fns-cell-helpers'
import { KS3_CELLS, KS3_ITEM_COLS, KS3_MAX_ITEM_ROWS } from './ks3-template-cells'
import { directorShortName } from '@/lib/number-to-words-ru'

function assign(
  assignments: XlsxCellAssignment[],
  address: string,
  value: string | number | null
) {
  assignments.push({ address, value })
}

/** Суммы в объединённых блоках E:G, H:J, K:M — пишем только в мастер-ячейки */
function fillAmountBlocks(
  assignments: XlsxCellAssignment[],
  row: number,
  amount: number | null
) {
  assign(assignments, `${KS3_ITEM_COLS.amountFromStart}${row}`, amount)
  assign(assignments, `${KS3_ITEM_COLS.amountFromYear}${row}`, amount)
  assign(assignments, `${KS3_ITEM_COLS.amountForPeriod}${row}`, amount)
}

/** Итоговые строки: сумма только в блоке K:M, подписи в G/H не трогаем */
function fillPeriodTotal(
  assignments: XlsxCellAssignment[],
  row: number,
  amount: number | null
) {
  assign(assignments, `${KS3_ITEM_COLS.amountForPeriod}${row}`, amount)
}

function clearItemRow(assignments: XlsxCellAssignment[], row: number) {
  assign(assignments, `${KS3_ITEM_COLS.lineNumber}${row}`, null)
  assign(assignments, `${KS3_ITEM_COLS.name}${row}`, null)
  fillAmountBlocks(assignments, row, null)
}

export interface Ks3XlsxPatchPlan {
  assignments: XlsxCellAssignment[]
  itemCount: number
}

export function buildKs3XlsxPatchPlan(data: Ks3DocumentData): Ks3XlsxPatchPlan {
  const items = data.items.slice(0, KS3_MAX_ITEM_ROWS)
  if (!items.length) {
    throw new Error('Нет позиций для выгрузки в КС-3')
  }
  if (data.items.length > KS3_MAX_ITEM_ROWS) {
    throw new Error(
      `В шаблоне КС-3 допускается не более ${KS3_MAX_ITEM_ROWS} позиций. Разбейте на несколько справок.`
    )
  }

  const assignments: XlsxCellAssignment[] = []

  for (let row = KS3_CELLS.itemStartRow; row <= KS3_CELLS.itemStartRow + KS3_MAX_ITEM_ROWS - 1; row++) {
    clearItemRow(assignments, row)
  }

  assign(assignments, KS3_CELLS.buyer, buildOrganizationLine(data.buyer))
  assign(assignments, KS3_CELLS.seller, buildOrganizationLine(data.seller))
  assign(assignments, KS3_CELLS.constructionSite, data.projectName || data.objectName)

  if (data.contractNumber) {
    assign(assignments, KS3_CELLS.contractNumber, data.contractNumber)
  }
  if (data.contractDate) {
    const parts = parseRuDateParts(data.contractDate)
    if (parts) {
      assign(assignments, KS3_CELLS.contractDateDay, parts.day)
      assign(assignments, KS3_CELLS.contractDateMonth, parts.month)
      assign(assignments, KS3_CELLS.contractDateYear, parts.year)
    }
  }

  assign(assignments, KS3_CELLS.documentNumber, data.documentNumber)
  assign(assignments, KS3_CELLS.documentDate, data.documentDate)

  const totalWithoutVat = data.totals.totalWithoutVat
  const totalVat = data.totals.totalVat
  const totalWithVat = data.totals.hasVat ? data.totals.totalWithVat : totalWithoutVat

  fillAmountBlocks(assignments, KS3_CELLS.totalWorksRow, totalWithoutVat)

  items.forEach((item, index) => {
    const row = KS3_CELLS.itemStartRow + index
    assign(assignments, `${KS3_ITEM_COLS.lineNumber}${row}`, item.lineNumber)
    assign(assignments, `${KS3_ITEM_COLS.name}${row}`, item.name)
    fillAmountBlocks(assignments, row, item.totalWithoutVat)
  })

  fillPeriodTotal(assignments, KS3_CELLS.subtotalRow, totalWithoutVat)
  fillPeriodTotal(assignments, KS3_CELLS.vatRow, totalVat)
  fillPeriodTotal(assignments, KS3_CELLS.totalWithVatRow, totalWithVat)

  const directorPosition = data.seller.directorPosition || 'Генеральный директор'
  const directorName = directorShortName(data.seller.directorName) || data.seller.directorName || ''
  if (directorPosition) {
    assign(assignments, KS3_CELLS.sellerDirectorPosition, directorPosition)
  }
  if (directorName) {
    assign(assignments, KS3_CELLS.sellerDirectorName, directorName)
  }

  return { assignments, itemCount: items.length }
}

/** @deprecated используйте buildKs3XlsxPatchPlan */
export function buildKs3CellAssignments(data: Ks3DocumentData): XlsxCellAssignment[] {
  return buildKs3XlsxPatchPlan(data).assignments
}

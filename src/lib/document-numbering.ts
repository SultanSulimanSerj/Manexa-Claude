import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

const RULE_NAMES: Record<string, string> = {
  UPD: 'doc:UPD',
  KS2: 'doc:KS2',
  KS3: 'doc:KS3',
  INVOICE: 'doc:INVOICE',
  SERVICE_ACT: 'doc:SERVICE_ACT',
  CONTRACT: 'doc:CONTRACT',
  COMMERCIAL: 'doc:COMMERCIAL',
}

const MAX_NUMBER_RETRIES = 5

type NumberingTx = Prisma.TransactionClient

export function parseNumericDocumentNumber(value: string | null | undefined): number | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const num = parseInt(trimmed, 10)
  return Number.isFinite(num) && num > 0 ? num : null
}

/** Первый свободный порядковый номер: 1, 2, … с заполнением пропусков после удаления. */
export function findFirstAvailableNumber(used: Iterable<number>): number {
  const usedSet = used instanceof Set ? used : new Set(used)
  let candidate = 1
  while (usedSet.has(candidate)) {
    candidate += 1
  }
  return candidate
}

export function isDocumentNumberUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'P2002'
  )
}

function numberingLockKey(companyId: string, category: string): string {
  return `${companyId}:${category}`
}

async function acquireNumberingLock(tx: NumberingTx, companyId: string, category: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${numberingLockKey(companyId, category)})::bigint)`
}

async function loadUsedNumericNumbers(
  tx: NumberingTx,
  companyId: string,
  category: string,
  excludeDocumentId?: string
): Promise<Set<number>> {
  const docs = await tx.document.findMany({
    where: {
      companyId,
      category,
      documentNumber: { not: null },
      ...(excludeDocumentId ? { id: { not: excludeDocumentId } } : {}),
    },
    select: { documentNumber: true },
  })

  const used = new Set<number>()
  for (const doc of docs) {
    const numeric = parseNumericDocumentNumber(doc.documentNumber)
    if (numeric !== null) {
      used.add(numeric)
    }
  }
  return used
}

export async function isDocumentNumberTaken(
  companyId: string,
  category: string,
  documentNumber: string,
  excludeDocumentId?: string
): Promise<boolean> {
  const trimmed = documentNumber.trim()
  if (!trimmed) return false

  const existing = await prisma.document.findFirst({
    where: {
      companyId,
      category,
      documentNumber: trimmed,
      ...(excludeDocumentId ? { id: { not: excludeDocumentId } } : {}),
    },
    select: { id: true },
  })
  return Boolean(existing)
}

async function syncCounterToMax(
  tx: NumberingTx,
  companyId: string,
  category: string,
  used: Set<number>
): Promise<void> {
  const maxUsed = used.size > 0 ? Math.max(...Array.from(used)) : 0
  const ruleName = RULE_NAMES[category] || `doc:${category}`

  const rule = await tx.numberingRule.findFirst({
    where: { companyId, name: ruleName },
  })

  if (!rule) {
    if (maxUsed > 0) {
      await tx.numberingRule.create({
        data: {
          name: ruleName,
          pattern: '{n}',
          counter: maxUsed,
          companyId,
          isActive: true,
        },
      })
    }
    return
  }

  if (maxUsed > rule.counter) {
    await tx.numberingRule.update({
      where: { id: rule.id },
      data: { counter: maxUsed },
    })
  }
}

async function normalizeLegacyCounter(
  companyId: string,
  category: string,
  counter: number,
  ruleId: string
): Promise<number> {
  if (counter < 100) return counter

  const docCount = await prisma.document.count({
    where: { companyId, category },
  })

  if (counter > Math.max(docCount * 3, 10)) {
    await prisma.numberingRule.update({
      where: { id: ruleId },
      data: { counter: 0 },
    })
    return 0
  }
  return counter
}

async function ensureNumberingRule(companyId: string, category: string) {
  const ruleName = RULE_NAMES[category] || `doc:${category}`

  const existing = await prisma.numberingRule.findFirst({
    where: { companyId, name: ruleName },
  })
  if (existing) {
    const counter = await normalizeLegacyCounter(
      companyId,
      category,
      existing.counter,
      existing.id
    )
    return counter === existing.counter ? existing : { ...existing, counter }
  }

  return prisma.numberingRule.create({
    data: {
      name: ruleName,
      pattern: '{n}',
      counter: 0,
      companyId,
      isActive: true,
    },
  })
}

async function allocateDocumentNumberInTx(
  tx: NumberingTx,
  companyId: string,
  category: string,
  customNumber?: string | null,
  excludeDocumentId?: string
): Promise<string> {
  await acquireNumberingLock(tx, companyId, category)

  const used = await loadUsedNumericNumbers(tx, companyId, category, excludeDocumentId)
  const custom = customNumber?.trim()

  if (custom) {
    const taken = await tx.document.findFirst({
      where: {
        companyId,
        category,
        documentNumber: custom,
        ...(excludeDocumentId ? { id: { not: excludeDocumentId } } : {}),
      },
      select: { id: true },
    })
    if (taken) {
      throw new Error(`Номер ${custom} уже используется для этого типа документа`)
    }

    const numeric = parseNumericDocumentNumber(custom)
    if (numeric !== null) {
      used.add(numeric)
    }
    await syncCounterToMax(tx, companyId, category, used)
    return custom
  }

  const next = findFirstAvailableNumber(used)
  used.add(next)
  await syncCounterToMax(tx, companyId, category, used)
  return String(next)
}

/** Следующий номер без резервирования (для подсказки в UI) */
export async function peekNextDocumentNumber(
  companyId: string,
  category: string
): Promise<number> {
  await ensureNumberingRule(companyId, category)
  const used = await loadUsedNumericNumbers(prisma, companyId, category)
  return findFirstAvailableNumber(used)
}

/**
 * Выделяет номер документа (с блокировкой на уровне БД).
 * Автоматически заполняет пропуски (удалили №4 → следующий будет 4).
 */
export async function allocateDocumentNumber(
  companyId: string,
  category: string,
  customNumber?: string | null,
  options?: { excludeDocumentId?: string }
): Promise<string> {
  return prisma.$transaction((tx) =>
    allocateDocumentNumberInTx(
      tx,
      companyId,
      category,
      customNumber,
      options?.excludeDocumentId
    )
  )
}

/**
 * Создаёт документ с уникальным номером; при гонке (P2002) повторяет выделение.
 */
export async function createDocumentWithAllocatedNumber<T>(
  companyId: string,
  category: string,
  customNumber: string | null | undefined,
  createFn: (documentNumber: string) => Promise<T>
): Promise<T> {
  let useCustom = customNumber

  for (let attempt = 0; attempt < MAX_NUMBER_RETRIES; attempt++) {
    const documentNumber = await allocateDocumentNumber(
      companyId,
      category,
      attempt === 0 ? useCustom : null
    )

    try {
      return await createFn(documentNumber)
    } catch (error) {
      if (isDocumentNumberUniqueViolation(error) && attempt < MAX_NUMBER_RETRIES - 1) {
        useCustom = null
        continue
      }
      throw error
    }
  }

  throw new Error('Не удалось выделить уникальный номер документа')
}

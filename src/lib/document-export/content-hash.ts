import { createHash } from 'crypto'
import type { ExportFormat } from '@/lib/document-editor/export-upd'
import type { DocumentContent } from '@/lib/document-editor/types'
import { isUpdContent } from '@/lib/document-editor/types'
import { applyCalculationsToUpdData } from '@/lib/document-editor/upd-calculations'

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`
}

/** Хеш содержимого документа (без формата — один на все типы выгрузки). */
export function computeDocumentContentHash(content: DocumentContent): string {
  const data = isUpdContent(content)
    ? applyCalculationsToUpdData(content.data)
    : content.data
  const payload = {
    schemaVersion: content.schemaVersion,
    type: content.type,
    data,
  }
  return createHash('sha256').update(stableStringify(payload)).digest('hex')
}

export interface ExportBrandingFingerprint {
  includeStamp?: boolean
  includeSignature?: boolean
  stampFilePath?: string | null
  signatureFilePath?: string | null
}

/** Хеш выгрузки: контент + флаги печати/подписи и пути файлов компании. */
export function computeDocumentExportHash(
  content: DocumentContent,
  branding?: ExportBrandingFingerprint
): string {
  const contentHash = computeDocumentContentHash(content)
  if (!branding) return contentHash

  const payload = {
    contentHash,
    includeStamp: Boolean(branding.includeStamp),
    includeSignature: Boolean(branding.includeSignature),
    stampFilePath: branding.stampFilePath ?? null,
    signatureFilePath: branding.signatureFilePath ?? null,
  }
  return createHash('sha256').update(stableStringify(payload)).digest('hex')
}

/** @deprecated Используйте computeDocumentContentHash — format не входит в хеш */
export function computeExportContentHash(
  content: DocumentContent,
  _format?: ExportFormat
): string {
  return computeDocumentContentHash(content)
}

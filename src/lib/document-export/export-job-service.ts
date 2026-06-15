import type { DocumentExportJob } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { generateId } from '@/lib/id-generator'
import { checkRateLimit } from '@/lib/rate-limit'
import { getDocumentForCompany } from '@/lib/document-editor/document-service'
import type { ExportFormat } from '@/lib/document-editor/export-upd'
import { isEditableDocumentContent, parseDocumentContent } from '@/lib/document-editor/types'
import { computeDocumentExportHash } from './content-hash'
import { exportJobCoversFormat } from './format-utils'
import { addDocumentExportToQueue, isExportQueueConfigured } from './queue'
import type {
  EnqueueExportOptions,
  EnqueueExportResult,
  ExportJobPublicView,
} from './types'

const USER_RATE_LIMIT = parseInt(process.env.DOCUMENT_EXPORT_RATE_LIMIT_USER || '15', 10)
const USER_RATE_WINDOW_MS = parseInt(
  process.env.DOCUMENT_EXPORT_RATE_LIMIT_USER_WINDOW_MS || String(60_000),
  10
)
const COMPANY_RATE_LIMIT = parseInt(
  process.env.DOCUMENT_EXPORT_RATE_LIMIT_COMPANY || '120',
  10
)
const COMPANY_RATE_WINDOW_MS = parseInt(
  process.env.DOCUMENT_EXPORT_RATE_LIMIT_COMPANY_WINDOW_MS || String(3_600_000),
  10
)

const STALE_PROCESSING_MS = parseInt(
  process.env.DOCUMENT_EXPORT_STALE_PROCESSING_MS || String(15 * 60_000),
  10
)

function toPublicView(job: DocumentExportJob, extra?: { cached?: boolean }): ExportJobPublicView {
  return {
    id: job.id,
    documentId: job.documentId,
    format: job.format as ExportFormat,
    status: job.status,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    cached: extra?.cached,
  }
}

async function findActiveExportJob(documentId: string): Promise<DocumentExportJob | null> {
  return prisma.documentExportJob.findFirst({
    where: {
      documentId,
      status: { in: ['QUEUED', 'PROCESSING'] },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function recoverStaleExportJobs(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_PROCESSING_MS)
  const stale = await prisma.documentExportJob.findMany({
    where: {
      status: 'PROCESSING',
      startedAt: { lt: cutoff },
    },
  })

  let recovered = 0
  for (const job of stale) {
    await prisma.documentExportJob.update({
      where: { id: job.id },
      data: {
        status: 'QUEUED',
        errorMessage: 'Повтор после зависания воркера',
      },
    })
    try {
      await addDocumentExportToQueue(job.id)
      recovered += 1
    } catch (err) {
      await prisma.documentExportJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage:
            err instanceof Error ? err.message : 'Не удалось вернуть задачу в очередь',
        },
      })
    }
  }
  return recovered
}

export async function getExportJobForCompany(jobId: string, companyId: string) {
  const job = await prisma.documentExportJob.findFirst({
    where: { id: jobId, companyId },
  })
  return job ? toPublicView(job) : null
}

export async function getActiveExportJobForDocument(
  documentId: string,
  companyId: string
): Promise<ExportJobPublicView | null> {
  const job = await prisma.documentExportJob.findFirst({
    where: {
      documentId,
      companyId,
      status: { in: ['QUEUED', 'PROCESSING'] },
    },
    orderBy: { createdAt: 'desc' },
  })
  return job ? toPublicView(job) : null
}

export async function enqueueDocumentExport(
  documentId: string,
  companyId: string,
  userId: string,
  options?: EnqueueExportOptions
): Promise<EnqueueExportResult> {
  if (!isExportQueueConfigured()) {
    throw new Error(
      'Очередь экспорта не настроена. Задайте REDIS_URL и запустите воркер: npm run worker:export'
    )
  }

  const format: ExportFormat = options?.format ?? 'both'

  const userLimit = await checkRateLimit(
    `doc-export:user:${userId}`,
    USER_RATE_LIMIT,
    USER_RATE_WINDOW_MS
  )
  if (!userLimit.allowed) {
    const retrySec = Math.ceil(Math.max(0, userLimit.resetAt - Date.now()) / 1000)
    const err = new Error(`Слишком много запросов на экспорт. Повторите через ${retrySec} с`)
    ;(err as Error & { statusCode?: number }).statusCode = 429
    throw err
  }

  const companyLimit = await checkRateLimit(
    `doc-export:company:${companyId}`,
    COMPANY_RATE_LIMIT,
    COMPANY_RATE_WINDOW_MS
  )
  if (!companyLimit.allowed) {
    const retryMin = Math.ceil(Math.max(0, companyLimit.resetAt - Date.now()) / 60_000)
    const err = new Error(`Лимит экспорта компании исчерпан. Повторите через ${retryMin} мин`)
    ;(err as Error & { statusCode?: number }).statusCode = 429
    throw err
  }

  const document = await getDocumentForCompany(documentId, companyId)
  if (!document) {
    throw new Error('Документ не найден')
  }

  const content = parseDocumentContent(document.contentJson)
  if (!content || !isEditableDocumentContent(content)) {
    throw new Error('Документ не содержит редактируемых данных')
  }

  const companyBranding = await prisma.company.findUnique({
    where: { id: companyId },
    select: { stampFilePath: true, signatureFilePath: true },
  })

  const contentHash = computeDocumentExportHash(content, {
    includeStamp: document.includeStampOnExport,
    includeSignature: document.includeSignatureOnExport,
    stampFilePath: companyBranding?.stampFilePath,
    signatureFilePath: companyBranding?.signatureFilePath,
  })

  const activeJob = await findActiveExportJob(documentId)
  if (activeJob) {
    const activeFormat = activeJob.format as ExportFormat
    if (exportJobCoversFormat(activeFormat, format)) {
      return { kind: 'existing', job: toPublicView(activeJob) }
    }
    const err = new Error(
      `Идёт экспорт (${activeFormat === 'xlsx' ? 'Excel' : activeFormat === 'pdf' ? 'PDF' : 'Excel + PDF'}). Дождитесь завершения или повторите позже.`
    )
    ;(err as Error & { statusCode?: number; pollUrl?: string }).statusCode = 409
    ;(err as Error & { pollUrl?: string }).pollUrl =
      `/api/documents/export-jobs/${activeJob.id}`
    throw err
  }

  const jobId = generateId()

  const dbJob = await prisma.$transaction(async (tx) => {
    const concurrent = await tx.documentExportJob.findFirst({
      where: {
        documentId,
        status: { in: ['QUEUED', 'PROCESSING'] },
      },
    })
    if (concurrent) {
      const concurrentFormat = concurrent.format as ExportFormat
      if (exportJobCoversFormat(concurrentFormat, format)) {
        return concurrent
      }
      throw new Error('Конфликт: другой экспорт уже запущен для этого документа')
    }

    return tx.documentExportJob.create({
      data: {
        id: jobId,
        documentId,
        companyId,
        requestedById: userId,
        format,
        contentHash,
        publish: Boolean(options?.publish),
        comment: options?.comment,
        status: 'QUEUED',
      },
    })
  })

  if (dbJob.id !== jobId) {
    return { kind: 'existing', job: toPublicView(dbJob) }
  }

  try {
    const bullJobId = await addDocumentExportToQueue(jobId)
    await prisma.documentExportJob.update({
      where: { id: jobId },
      data: { bullJobId },
    })
    return { kind: 'queued', job: toPublicView({ ...dbJob, bullJobId }) }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка постановки в очередь'
    await prisma.documentExportJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: message,
      },
    })
    throw new Error(`Не удалось поставить экспорт в очередь: ${message}`)
  }
}

import { prisma } from '@/lib/prisma'
import { executeDocumentExport } from '@/lib/document-editor/document-service'
import type { ExportFormat } from '@/lib/document-editor/export-upd'
import { computeDocumentExportHash } from './content-hash'
import { isEditableDocumentContent, parseDocumentContent } from '@/lib/document-editor/types'

export async function processDocumentExportJob(
  jobId: string,
  options?: { isFinalAttempt?: boolean }
): Promise<void> {
  const job = await prisma.documentExportJob.findUnique({
    where: { id: jobId },
  })

  if (!job) {
    throw new Error(`Задача экспорта ${jobId} не найдена`)
  }

  if (job.status === 'COMPLETED') {
    return
  }

  await prisma.documentExportJob.update({
    where: { id: jobId },
    data: {
      status: 'PROCESSING',
      startedAt: job.startedAt ?? new Date(),
      attempts: { increment: 1 },
    },
  })

  try {
    const document = await prisma.document.findFirst({
      where: { id: job.documentId, companyId: job.companyId },
      select: {
        contentJson: true,
        includeStampOnExport: true,
        includeSignatureOnExport: true,
      },
    })
    const companyBranding = await prisma.company.findUnique({
      where: { id: job.companyId },
      select: { stampFilePath: true, signatureFilePath: true },
    })
    const content = parseDocumentContent(document?.contentJson)
    const contentHash =
      content && isEditableDocumentContent(content)
        ? computeDocumentExportHash(content, {
            includeStamp: document?.includeStampOnExport,
            includeSignature: document?.includeSignatureOnExport,
            stampFilePath: companyBranding?.stampFilePath,
            signatureFilePath: companyBranding?.signatureFilePath,
          })
        : job.contentHash

    const exportResult = await executeDocumentExport(job.documentId, job.companyId, {
      publish: job.publish,
      comment: job.comment ?? undefined,
      format: job.format as ExportFormat,
      contentHash,
    })

    await prisma.documentExportJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        errorMessage: null,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка экспорта документа'
    const isFinal = options?.isFinalAttempt !== false

    await prisma.documentExportJob.update({
      where: { id: jobId },
      data: isFinal
        ? {
            status: 'FAILED',
            completedAt: new Date(),
            errorMessage: message,
          }
        : {
            status: 'QUEUED',
            errorMessage: message,
          },
    })
    throw err
  }
}

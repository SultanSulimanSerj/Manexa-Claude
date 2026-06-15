import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/auth-middleware'
import {
  executeDocumentExport,
  getDocumentForCompany,
  saveDocumentContent,
} from '@/lib/document-editor/document-service'
import {
  isEditableDocumentContent,
  parseDocumentContent,
  getDocumentContentType,
} from '@/lib/document-editor/types'
import {
  getDocumentTypeDefinition,
  categoryToContentType,
  isDocxEditorType,
} from '@/lib/document-editor/registry'
import { enqueueDocumentExport } from '@/lib/document-export/export-job-service'
import { computeDocumentExportHash } from '@/lib/document-export/content-hash'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canEditDocuments')
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!allowed) {
      return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
    }
    if (!user.companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const publish = Boolean(body.publish)
    const comment = typeof body.comment === 'string' ? body.comment : undefined
    const format =
      body.format === 'xlsx' || body.format === 'pdf' || body.format === 'both'
        ? body.format
        : 'both'
    const includeStamp = typeof body.includeStamp === 'boolean' ? body.includeStamp : undefined
    const includeSignature =
      typeof body.includeSignature === 'boolean' ? body.includeSignature : undefined

    if (body.content && isEditableDocumentContent(body.content)) {
      await saveDocumentContent(params.id, user.companyId, body.content)
    }

    const existing = await getDocumentForCompany(params.id, user.companyId)
    if (!existing) {
      return NextResponse.json({ error: 'Документ не найден' }, { status: 404 })
    }

    const content = parseDocumentContent(existing.contentJson)
    if (!content) {
      return NextResponse.json(
        {
          error:
            'Документ не содержит редактируемых данных. Создайте новый документ через «Создать документ».',
        },
        { status: 400 }
      )
    }

    const typeDef = getDocumentTypeDefinition(getDocumentContentType(content))
    if (typeDef.validate) {
      const validation = typeDef.validate(content)
      if (!validation.valid) {
        return NextResponse.json(
          { error: 'Документ не прошёл валидацию', issues: validation.issues },
          { status: 400 }
        )
      }
    }

    const contentType =
      getDocumentContentType(content) ?? categoryToContentType(existing.category)
    const syncDocxExport = contentType && isDocxEditorType(contentType)

    const resolvedIncludeStamp = includeStamp ?? existing.includeStampOnExport
    const resolvedIncludeSignature = includeSignature ?? existing.includeSignatureOnExport

    if (includeStamp !== undefined || includeSignature !== undefined) {
      await prisma.document.update({
        where: { id: params.id },
        data: {
          includeStampOnExport: resolvedIncludeStamp,
          includeSignatureOnExport: resolvedIncludeSignature,
        },
      })
    }

    const companyBranding = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { stampFilePath: true, signatureFilePath: true },
    })

    const contentHash = computeDocumentExportHash(content, {
      includeStamp: resolvedIncludeStamp,
      includeSignature: resolvedIncludeSignature,
      stampFilePath: companyBranding?.stampFilePath,
      signatureFilePath: companyBranding?.signatureFilePath,
    })

    if (syncDocxExport) {
      const result = await executeDocumentExport(params.id, user.companyId, {
        publish,
        comment,
        format,
        contentHash,
        includeStamp: resolvedIncludeStamp,
        includeSignature: resolvedIncludeSignature,
      })

      return NextResponse.json({
        status: 'completed',
        document: result.document,
        downloadUrl: `/api/documents/${params.id}/download`,
      })
    }

    if (!categoryToContentType(existing.category)) {
      return NextResponse.json(
        { error: 'Документ не поддерживает экспорт из редактора' },
        { status: 400 }
      )
    }

    const result = await enqueueDocumentExport(params.id, user.companyId, user.id, {
      publish,
      comment,
      format,
    })

    if (result.kind === 'cached') {
      return NextResponse.json(
        {
          status: 'completed',
          document: result.document,
          downloadUrl: `/api/documents/${params.id}/download`,
        },
        { status: 200 }
      )
    }

    const statusCode = result.kind === 'queued' ? 202 : 200

    return NextResponse.json(
      {
        status: result.job.status === 'COMPLETED' ? 'completed' : 'queued',
        job: result.job,
        pollUrl: `/api/documents/export-jobs/${result.job.id}`,
        downloadUrl: `/api/documents/${params.id}/download`,
      },
      { status: statusCode }
    )
  } catch (err) {
    console.error('Error enqueueing document export:', err)
    const message = err instanceof Error ? err.message : 'Ошибка при экспорте'
    const statusCode = (err as Error & { statusCode?: number }).statusCode
    const pollUrl = (err as Error & { pollUrl?: string }).pollUrl
    let status = 500
    if (statusCode) {
      status = statusCode
    } else if (message.includes('REDIS_URL') || message.includes('очередь')) {
      status = 503
    }
    return NextResponse.json(
      { error: message, pollUrl },
      { status }
    )
  }
}

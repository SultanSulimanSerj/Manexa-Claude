import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/auth-middleware'
import { verifyProjectCompanyAccess } from '@/lib/access-control'
import {
  createUpdDraft,
  createInvoiceDraft,
  createCommercialOfferDraft,
  createContractDraft,
  createKs2Draft,
  createKs3Draft,
  createServiceActDraft,
} from '@/lib/document-editor/document-service'
import type { DocumentContentType } from '@/lib/document-editor/types'

const ALLOWED_TYPES = new Set<DocumentContentType>([
  'UPD',
  'INVOICE',
  'CONTRACT',
  'COMMERCIAL_OFFER',
  'KS2',
  'KS3',
  'SERVICE_ACT',
])

export async function POST(request: NextRequest) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canCreateDocuments')
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!allowed) {
      return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
    }
    if (!user.companyId) {
      return NextResponse.json({ error: 'Компания не найдена' }, { status: 400 })
    }

    const body = await request.json()
    const {
      type,
      projectId,
      estimateIds,
      commercialOfferId,
      invoiceDocumentId,
      contractDocumentId,
      parentDocumentId,
      documentNumber,
      updStatus,
      templateId,
    } = body

    if (!type || !ALLOWED_TYPES.has(type)) {
      return NextResponse.json({ error: 'Неподдерживаемый тип документа' }, { status: 400 })
    }

    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json({ error: 'Укажите проект' }, { status: 400 })
    }

    const hasAccess = await verifyProjectCompanyAccess(user, projectId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Проект не найден' }, { status: 404 })
    }

    const resolvedEstimateIds = Array.isArray(estimateIds)
      ? estimateIds.filter(
          (id: unknown): id is string => typeof id === 'string' && id.trim().length > 0
        )
      : []

    const baseParams = {
      projectId,
      companyId: user.companyId,
      creatorId: user.id,
      estimateIds: resolvedEstimateIds,
      commercialOfferId:
        typeof commercialOfferId === 'string' ? commercialOfferId : undefined,
      parentDocumentId: typeof parentDocumentId === 'string' ? parentDocumentId : undefined,
      documentNumber: typeof documentNumber === 'string' ? documentNumber : null,
      documentDate: new Date(),
      templateId: typeof templateId === 'string' ? templateId : undefined,
    }

    let document

    switch (type as DocumentContentType) {
      case 'UPD':
        if (!invoiceDocumentId || typeof invoiceDocumentId !== 'string') {
          return NextResponse.json(
            { error: 'Для УПД необходимо выбрать счёт-основание' },
            { status: 400 }
          )
        }
        document = await createUpdDraft({
          ...baseParams,
          invoiceDocumentId,
          contractDocumentId:
            typeof contractDocumentId === 'string' ? contractDocumentId : undefined,
          updStatus: updStatus === 1 ? 1 : 2,
        })
        break
      case 'INVOICE':
        if (!commercialOfferId && resolvedEstimateIds.length === 0) {
          return NextResponse.json(
            { error: 'Выберите смету или коммерческое предложение' },
            { status: 400 }
          )
        }
        document = await createInvoiceDraft(baseParams)
        break
      case 'COMMERCIAL_OFFER':
        if (resolvedEstimateIds.length === 0) {
          return NextResponse.json({ error: 'Для КП необходимо выбрать смету' }, { status: 400 })
        }
        document = await createCommercialOfferDraft(baseParams)
        break
      case 'CONTRACT':
        document = await createContractDraft(baseParams)
        break
      case 'KS2':
      case 'KS3':
        if (resolvedEstimateIds.length === 0) {
          return NextResponse.json({ error: 'Выберите смету проекта' }, { status: 400 })
        }
        document =
          type === 'KS2'
            ? await createKs2Draft(baseParams)
            : await createKs3Draft(baseParams)
        break
      case 'SERVICE_ACT':
        if (resolvedEstimateIds.length === 0) {
          return NextResponse.json({ error: 'Выберите смету проекта' }, { status: 400 })
        }
        document = await createServiceActDraft({
          ...baseParams,
          invoiceDocumentId:
            typeof invoiceDocumentId === 'string' ? invoiceDocumentId : undefined,
        })
        break
      default:
        return NextResponse.json({ error: 'Неподдерживаемый тип' }, { status: 400 })
    }

    return NextResponse.json({
      document,
      documentId: document.id,
      redirectUrl: `/documents/${document.id}/edit`,
    })
  } catch (err) {
    console.error('Error creating document draft:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Ошибка при создании черновика' },
      { status: 500 }
    )
  }
}

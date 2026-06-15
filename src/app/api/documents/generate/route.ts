import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/auth-middleware'
import { ContractData } from '@/lib/document-generator'
import { buildSpecificationFromEstimate } from '@/lib/commercial-offer-generator'
import { getSystemTemplateById } from '@/lib/system-templates'
import { uploadFile } from '@/lib/storage'
import { generateId } from '@/lib/id-generator'
import {
  createUpdDraft,
  createInvoiceDraft,
  createCommercialOfferDraft,
  createKs2Draft,
  createKs3Draft,
  createServiceActDraft,
} from '@/lib/document-editor/document-service'
import {
  renderContractDocx,
  renderCommercialOfferDocx,
} from '@/lib/document-renderer/docx-renderer'
import { createDocumentWithAllocatedNumber } from '@/lib/document-numbering'

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

function resolveDocumentType(documentType: string, templateId?: string | null): string {
  if (templateId) {
    const template = getSystemTemplateById(templateId)
    if (template?.type) return template.type
  }
  return documentType
}

function resolveEstimateIds(body: {
  estimateId?: unknown
  estimateIds?: unknown
}): string[] {
  if (Array.isArray(body.estimateIds)) {
    return body.estimateIds
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      .map((id) => id.trim())
  }
  if (typeof body.estimateId === 'string' && body.estimateId.trim()) {
    return [body.estimateId.trim()]
  }
  return []
}

function buildContractData(
  project: any,
  contractNumber: string,
  today: Date,
  estimate: any | null
): ContractData {
  const contractDate = today.toLocaleDateString('ru-RU')
  const startDate = project.startDate ? new Date(project.startDate).toLocaleDateString('ru-RU') : ''
  const endDate = project.endDate ? new Date(project.endDate).toLocaleDateString('ru-RU') : ''
  const workAddress = project.clientActualAddress || project.clientLegalAddress || ''

  const totalAmount = estimate
    ? Number(estimate.totalWithVat || estimate.total).toLocaleString('ru-RU')
    : project.budget
      ? Number(project.budget).toLocaleString('ru-RU')
      : ''

  return {
    contractNumber,
    contractDate,
    city: project.company?.city || 'Екатеринбург',
    executorName: project.company?.name || '',
    executorLegalName: project.company?.legalName || project.company?.name || '',
    executorDirector: project.company?.directorName || '',
    executorDirectorPosition: project.company?.directorPosition || 'Генеральный директор',
    executorInn: project.company?.inn || '',
    executorKpp: project.company?.kpp || '',
    executorOgrn: project.company?.ogrn || '',
    executorAddress: project.company?.legalAddress || project.company?.address || '',
    executorPhone: project.company?.phone || project.company?.contactPhone || '',
    executorEmail: project.company?.contactEmail || '',
    executorBankAccount: project.company?.bankAccount || '',
    executorBankName: project.company?.bankName || '',
    executorBankBik: project.company?.bankBik || '',
    executorCorrespondentAccount: project.company?.correspondentAccount || '',
    clientName: project.clientName || '',
    clientLegalName: project.clientLegalName || project.clientName || '',
    clientDirector: project.clientDirectorName || '',
    clientInn: project.clientInn || '',
    clientKpp: project.clientKpp || '',
    clientOgrn: project.clientOgrn || '',
    clientLegalAddress: project.clientLegalAddress || '',
    clientPhone: project.clientContactPhone || '',
    clientEmail: project.clientContactEmail || '',
    clientBankAccount: project.clientBankAccount || '',
    clientBankName: project.clientBankName || '',
    clientBankBik: project.clientBankBik || '',
    clientCorrespondentAccount: project.clientCorrespondentAccount || '',
    projectName: project.name,
    projectDescription: project.description || '',
    workAddress,
    startDate,
    endDate,
    totalAmount,
    vatEnabled: estimate ? estimate.vatEnabled : false,
    specification:
      estimate && (estimate as { items?: unknown[] }).items?.length
        ? buildSpecificationFromEstimate(
            estimate,
            contractNumber,
            contractDate,
            project.name,
            workAddress,
            startDate,
            endDate
          )
        : undefined,
  }
}

async function saveGeneratedDocument(params: {
  fileName: string
  storageKey: string
  buffer: Buffer
  title: string
  description: string
  category: string
  documentNumber: string
  projectId: string
  creatorId: string
  companyId: string | null
  templateId?: string | null
  mimeType: string
}) {
  await uploadFile(params.storageKey, params.buffer, params.mimeType)

  return prisma.document.create({
    data: {
      id: generateId(),
      title: params.title,
      description: params.description,
      fileName: params.fileName,
      filePath: params.storageKey,
      fileSize: params.buffer.length,
      mimeType: params.mimeType,
      category: params.category,
      documentNumber: params.documentNumber,
      numberAllocated: true,
      isPublished: true,
      publishedAt: new Date(),
      projectId: params.projectId,
      creatorId: params.creatorId,
      companyId: params.companyId,
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canCreateDocuments')
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!allowed) {
      return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { projectId, documentType, templateId, updStatus, documentNumber: customDocNumber } = body
    const estimateIds = resolveEstimateIds(body)
    if (!projectId || !documentType) {
      return NextResponse.json(
        { error: 'Отсутствуют обязательные параметры' },
        { status: 400 }
      )
    }

    const resolvedType = resolveDocumentType(documentType, templateId)
    const needsEstimates =
      resolvedType === 'commercial-offer' || estimateIds.length > 0

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        company: true,
        creator: true,
        estimates: needsEstimates
          ? {
              where: estimateIds.length > 0 ? { id: { in: estimateIds } } : undefined,
              include: { items: { orderBy: { createdAt: 'asc' } } },
            }
          : undefined,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Проект не найден' }, { status: 404 })
    }

    if (project.companyId !== user.companyId) {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
    }

    const estimate =
      estimateIds.length === 1 && project.estimates?.length
        ? project.estimates[0]
        : null

    if (estimateIds.length === 1 && !estimate) {
      return NextResponse.json({ error: 'Смета не найдена' }, { status: 404 })
    }

    if (resolvedType === 'commercial-offer' && !estimate) {
      return NextResponse.json(
        { error: 'Для коммерческого предложения необходимо выбрать смету' },
        { status: 400 }
      )
    }

    const today = new Date()
    const timestamp = Date.now()
    const mimeType = DOCX_MIME

    if (resolvedType === 'ks2' || resolvedType === 'ks3' || resolvedType === 'service-act') {
      if (!user.companyId) {
        return NextResponse.json({ error: 'Компания не найдена' }, { status: 400 })
      }
      if (estimateIds.length === 0) {
        return NextResponse.json({ error: 'Выберите смету проекта' }, { status: 400 })
      }

      const draftParams = {
        projectId,
        companyId: user.companyId,
        creatorId: user.id,
        estimateIds,
        documentNumber: typeof customDocNumber === 'string' ? customDocNumber : null,
        documentDate: today,
        invoiceDocumentId:
          typeof body.invoiceDocumentId === 'string' ? body.invoiceDocumentId : undefined,
      }

      const document =
        resolvedType === 'ks2'
          ? await createKs2Draft(draftParams)
          : resolvedType === 'ks3'
            ? await createKs3Draft(draftParams)
            : await createServiceActDraft(draftParams)

      return NextResponse.json({
        documentId: document.id,
        redirectUrl: `/documents/${document.id}/edit`,
        document,
      })
    }

    const editableDraftTypes = new Set(['upd', 'invoice'])
    if (editableDraftTypes.has(resolvedType)) {
      if (!user.companyId) {
        return NextResponse.json({ error: 'Компания не найдена' }, { status: 400 })
      }

      if (resolvedType === 'upd') {
        const invoiceDocumentId = body.invoiceDocumentId
        if (!invoiceDocumentId || typeof invoiceDocumentId !== 'string') {
          return NextResponse.json(
            { error: 'Для УПД необходимо выбрать счёт-основание' },
            { status: 400 }
          )
        }
        const document = await createUpdDraft({
          projectId,
          companyId: user.companyId,
          creatorId: user.id,
          invoiceDocumentId,
          contractDocumentId:
            typeof body.contractDocumentId === 'string' ? body.contractDocumentId : undefined,
          documentNumber: typeof customDocNumber === 'string' ? customDocNumber : null,
          updStatus: updStatus === 1 ? 1 : 2,
        })
        return NextResponse.json({
          documentId: document.id,
          redirectUrl: `/documents/${document.id}/edit`,
          document,
        })
      }

      if (resolvedType === 'invoice' && estimateIds.length === 0) {
        return NextResponse.json(
          { error: 'Для счёта необходимо выбрать смету' },
          { status: 400 }
        )
      }

      const draftParams = {
        projectId,
        companyId: user.companyId,
        creatorId: user.id,
        estimateIds,
        documentNumber: typeof customDocNumber === 'string' ? customDocNumber : null,
        documentDate: today,
        commercialOfferId:
          typeof body.commercialOfferId === 'string' ? body.commercialOfferId : undefined,
      }

      const document = await createInvoiceDraft(draftParams)

      return NextResponse.json({
        documentId: document.id,
        redirectUrl: `/documents/${document.id}/edit`,
        document,
      })
    }

    if (!user.companyId) {
      return NextResponse.json({ error: 'Компания не найдена' }, { status: 400 })
    }

    if (resolvedType === 'contract') {
      const generated = await createDocumentWithAllocatedNumber(
        user.companyId,
        'CONTRACT',
        null,
        async (documentNumber) => {
          const contractData = buildContractData(project, documentNumber, today, estimate)
          const buffer = await renderContractDocx(contractData)
          const fileName = `Договор_подряда_№${documentNumber}.docx`
          const storageKey = `documents/${user.companyId}/${timestamp}_${fileName}`
          const document = await saveGeneratedDocument({
            fileName,
            storageKey,
            buffer,
            title: `Договор подряда № ${documentNumber}`,
            description: estimate
              ? `Договор подряда со спецификацией «${estimate.name}»`
              : 'Автоматически сгенерированный договор подряда',
            category: 'CONTRACT',
            documentNumber,
            projectId,
            creatorId: user.id,
            companyId: user.companyId,
            templateId: templateId || null,
            mimeType,
          })
          return { buffer, fileName, document }
        }
      )

      return new NextResponse(generated.buffer as BodyInit, {
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `attachment; filename="${encodeURIComponent(generated.fileName)}"`,
          'Content-Length': generated.buffer.length.toString(),
          'X-Document-Id': generated.document.id,
        },
      })
    }

    if (resolvedType === 'commercial-offer') {
      if (!user.companyId) {
        return NextResponse.json({ error: 'Компания не найдена' }, { status: 400 })
      }
      const document = await createCommercialOfferDraft({
        projectId,
        companyId: user.companyId,
        creatorId: user.id,
        estimateIds: [estimate!.id],
        documentNumber: typeof customDocNumber === 'string' ? customDocNumber : null,
        documentDate: today,
      })

      return NextResponse.json({
        documentId: document.id,
        redirectUrl: `/documents/${document.id}/edit`,
        document,
      })
    }

    return NextResponse.json({ error: 'Неподдерживаемый тип документа' }, { status: 400 })
  } catch (error) {
    console.error('Error generating document:', error)
    return NextResponse.json(
      {
        error: 'Ошибка при генерации документа',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

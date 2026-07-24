import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/auth-middleware'
import { deleteDocumentForCompany } from '@/lib/document-editor/delete-document'
import { getDocumentForCompany } from '@/lib/document-editor/document-service'
import { getActiveExportJobForDocument } from '@/lib/document-export/export-job-service'
import { hasPermission, UserRole } from '@/lib/permissions'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canViewAllDocuments')
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!allowed) {
      return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
    }
    if (!user.companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const document = await getDocumentForCompany(params.id, user.companyId)
    if (!document) {
      return NextResponse.json({ error: 'Документ не найден' }, { status: 404 })
    }

    // Заказчик видит только опубликованные документы
    if (user.role === UserRole.CLIENT && !document.isPublished) {
      return NextResponse.json({ error: 'Документ не найден' }, { status: 404 })
    }

    const hasEditableContent = Boolean(document.contentJson)
    const canEdit = hasPermission(user.role as UserRole, 'canEditDocuments')
    const activeExportJob = await getActiveExportJobForDocument(
      params.id,
      user.companyId
    )

    return NextResponse.json({
      document: {
        ...document,
        hasEditableContent,
      },
      canEdit,
      activeExportJob,
    })
  } catch (err) {
    console.error('Error fetching document:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canDeleteDocuments')
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!allowed) {
      return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
    }
    if (!user.companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const deleted = await deleteDocumentForCompany(params.id, user.companyId)
    if (!deleted) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting document:', error)
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

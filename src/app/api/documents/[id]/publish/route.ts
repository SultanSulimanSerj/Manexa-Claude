import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/auth-middleware'
import { blockIfImpersonated } from '@/lib/impersonation-guard'
import { publishDocument } from '@/lib/document-editor/document-service'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const blocked = await blockIfImpersonated(request)
    if (blocked) return blocked

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

    const document = await publishDocument(params.id, user.companyId)

    return NextResponse.json({ document })
  } catch (err) {
    console.error('Error publishing document:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Ошибка при публикации' },
      { status: 500 }
    )
  }
}

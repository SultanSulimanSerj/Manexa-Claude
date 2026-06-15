import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/auth-middleware'
import { peekNextDocumentNumber } from '@/lib/document-numbering'

const ALLOWED_TYPES = new Set(['UPD', 'INVOICE', 'CONTRACT', 'COMMERCIAL', 'KS2', 'KS3', 'SERVICE_ACT'])

export async function GET(request: NextRequest) {
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

    const type = (request.nextUrl.searchParams.get('type') || 'UPD').toUpperCase()
    if (!ALLOWED_TYPES.has(type)) {
      return NextResponse.json({ error: 'Неподдерживаемый тип документа' }, { status: 400 })
    }

    const nextNumber = await peekNextDocumentNumber(user.companyId, type)

    return NextResponse.json({ type, nextNumber: String(nextNumber) })
  } catch (err) {
    console.error('Error peeking next document number:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

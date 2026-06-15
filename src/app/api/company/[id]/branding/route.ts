import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'
import { uploadFile, deleteFile } from '@/lib/storage'
import { generateId } from '@/lib/id-generator'

const ALLOWED_TYPES = new Set(['stamp', 'signature'])
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
const MAX_SIZE = 2 * 1024 * 1024

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canViewAllDocuments')
    if (!user?.companyId || user.companyId !== params.id) {
      return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
    }
    if (!allowed) {
      return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
    }

    const company = await prisma.company.findUnique({
      where: { id: params.id },
      select: {
        stampFilePath: true,
        stampMimeType: true,
        signatureFilePath: true,
        signatureMimeType: true,
      },
    })

    if (!company) {
      return NextResponse.json({ error: 'Компания не найдена' }, { status: 404 })
    }

    return NextResponse.json({
      hasStamp: Boolean(company.stampFilePath),
      hasSignature: Boolean(company.signatureFilePath),
      stampUrl: company.stampFilePath
        ? `/api/company/${params.id}/branding/file?type=stamp`
        : null,
      signatureUrl: company.signatureFilePath
        ? `/api/company/${params.id}/branding/file?type=signature`
        : null,
    })
  } catch (err) {
    console.error('Branding GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canEditUsers')
    if (!user?.companyId || user.companyId !== params.id) {
      return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
    }
    if (!allowed) {
      return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
    }

    const formData = await request.formData()
    const type = String(formData.get('type') || '')
    const file = formData.get('file')

    if (!ALLOWED_TYPES.has(type)) {
      return NextResponse.json({ error: 'Укажите type: stamp или signature' }, { status: 400 })
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Файл не передан' }, { status: 400 })
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: 'Допустимы PNG, JPEG или WebP' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Файл не больше 2 МБ' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.type.includes('jpeg') || file.type.includes('jpg') ? 'jpg' : file.type.includes('webp') ? 'webp' : 'png'
    const storageKey = `company-branding/${params.id}/${type}_${generateId()}.${ext}`

    const company = await prisma.company.findUnique({
      where: { id: params.id },
      select: { stampFilePath: true, signatureFilePath: true },
    })
    if (!company) {
      return NextResponse.json({ error: 'Компания не найдена' }, { status: 404 })
    }

    const previousPath = type === 'stamp' ? company.stampFilePath : company.signatureFilePath
    await uploadFile(storageKey, buffer, file.type)

    const data =
      type === 'stamp'
        ? { stampFilePath: storageKey, stampMimeType: file.type }
        : { signatureFilePath: storageKey, signatureMimeType: file.type }

    await prisma.company.update({ where: { id: params.id }, data })

    if (previousPath && previousPath !== storageKey) {
      try {
        await deleteFile(previousPath)
      } catch {
        /* ignore */
      }
    }

    return NextResponse.json({
      message: type === 'stamp' ? 'Печать загружена' : 'Подпись загружена',
      url: `/api/company/${params.id}/branding/file?type=${type}`,
    })
  } catch (err) {
    console.error('Branding POST error:', err)
    return NextResponse.json({ error: 'Ошибка загрузки' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canEditUsers')
    if (!user?.companyId || user.companyId !== params.id) {
      return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
    }
    if (!allowed) {
      return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
    }

    const type = request.nextUrl.searchParams.get('type') || ''
    if (!ALLOWED_TYPES.has(type)) {
      return NextResponse.json({ error: 'Укажите type: stamp или signature' }, { status: 400 })
    }

    const company = await prisma.company.findUnique({
      where: { id: params.id },
      select: { stampFilePath: true, signatureFilePath: true },
    })
    if (!company) {
      return NextResponse.json({ error: 'Компания не найдена' }, { status: 404 })
    }

    const path = type === 'stamp' ? company.stampFilePath : company.signatureFilePath
    const data =
      type === 'stamp'
        ? { stampFilePath: null, stampMimeType: null }
        : { signatureFilePath: null, signatureMimeType: null }

    await prisma.company.update({ where: { id: params.id }, data })
    if (path) {
      try {
        await deleteFile(path)
      } catch {
        /* ignore */
      }
    }

    return NextResponse.json({ message: 'Удалено' })
  } catch (err) {
    console.error('Branding DELETE error:', err)
    return NextResponse.json({ error: 'Ошибка удаления' }, { status: 500 })
  }
}

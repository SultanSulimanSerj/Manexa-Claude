import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-api'
import { hasPermission, UserRole } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { generateId } from '@/lib/id-generator'
import path from 'path'

// Заказчик (view-only) не может изменять фото этапов
function blockClientWrite(role: string) {
  return !hasPermission(role as UserRole, 'canViewAllTasks')
}
import { uploadFile, getSignedUrl, deleteFile } from '@/lib/storage'

// GET - получить фото этапа
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; stageId: string } }
) {
  try {
    const user = await authenticateUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!user.companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { stageId } = params

    const stage = await prisma.workStage.findFirst({
      where: {
        id: stageId,
        project: {
          companyId: user.companyId
        }
      }
    })

    if (!stage) {
      return NextResponse.json({ error: 'Этап не найден' }, { status: 404 })
    }

    const photos = await prisma.stagePhoto.findMany({
      where: { stageId },
      include: {
        uploadedBy: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const storageKeyPrefix = `stages/${stageId}/`
    const photosWithUrls = await Promise.all(
      photos.map(async (photo) => {
        const storageKey = `${storageKeyPrefix}${photo.filename}`
        const url = await getSignedUrl(storageKey, 3600)
        return { ...photo, url }
      })
    )

    return NextResponse.json(photosWithUrls)
  } catch (error) {
    console.error('Error fetching photos:', error)
    return NextResponse.json({ error: 'Ошибка получения фото' }, { status: 500 })
  }
}

// POST - загрузить фото
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; stageId: string } }
) {
  try {
    const user = await authenticateUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!user.companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { stageId } = params

    const stage = await prisma.workStage.findFirst({
      where: {
        id: stageId,
        project: {
          companyId: user.companyId
        }
      }
    })

    if (!stage) {
      return NextResponse.json({ error: 'Этап не найден' }, { status: 404 })
    }

    if (blockClientWrite(user.role)) {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const description = formData.get('description') as string | null

    if (!file) {
      return NextResponse.json({ error: 'Файл не выбран' }, { status: 400 })
    }

    // Проверяем тип файла
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Недопустимый тип файла. Разрешены: JPG, PNG, GIF, WebP' }, { status: 400 })
    }

    // Проверяем размер (макс 10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'Файл слишком большой. Максимум 10 МБ' }, { status: 400 })
    }

    const ext = path.extname(file.name) || '.jpg'
    const filename = `${stageId}_${Date.now()}_${generateId()}${ext}`
    const storageKey = `stages/${stageId}/${filename}`

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await uploadFile(storageKey, buffer, file.type)

    const photo = await prisma.stagePhoto.create({
      data: {
        id: generateId(),
        filename,
        originalName: file.name,
        description: description || null,
        mimeType: file.type,
        size: file.size,
        stageId,
        uploadedById: user.id
      },
      include: {
        uploadedBy: {
          select: { id: true, name: true }
        }
      }
    })

    const url = await getSignedUrl(storageKey, 3600)
    return NextResponse.json({
      ...photo,
      url
    }, { status: 201 })
  } catch (error) {
    console.error('Error uploading photo:', error)
    return NextResponse.json({ error: 'Ошибка загрузки фото' }, { status: 500 })
  }
}

// DELETE - удалить фото
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; stageId: string } }
) {
  try {
    const user = await authenticateUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!user.companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (blockClientWrite(user.role)) {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
    }

    const { stageId } = params
    const { searchParams } = new URL(request.url)
    const photoId = searchParams.get('photoId')

    if (!photoId) {
      return NextResponse.json({ error: 'ID фото обязателен' }, { status: 400 })
    }

    // Проверяем доступ
    const photo = await prisma.stagePhoto.findFirst({
      where: {
        id: photoId,
        stageId,
        stage: {
          project: {
            companyId: user.companyId
          }
        }
      }
    })

    if (!photo) {
      return NextResponse.json({ error: 'Фото не найдено' }, { status: 404 })
    }

    const storageKey = `stages/${stageId}/${photo.filename}`
    try {
      await deleteFile(storageKey)
    } catch (e) {
      console.error('Error deleting file from MinIO:', e)
    }

    await prisma.stagePhoto.delete({
      where: { id: photoId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting photo:', error)
    return NextResponse.json({ error: 'Ошибка удаления фото' }, { status: 500 })
  }
}

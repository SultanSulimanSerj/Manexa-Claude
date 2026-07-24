import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-api'
import { prisma } from '@/lib/prisma'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { getFileBuffer, getFileStream } from '@/lib/storage'
import { inspectXlsxBuffer } from '@/lib/document-renderer/xlsx-patcher'

const EXPECTED_UPD_MERGE_COUNT = 338

function isMinIOKey(filePath: string): boolean {
  return filePath.startsWith('documents/') || filePath.startsWith('stages/') || filePath.startsWith('approvals/')
}

function resolveMimeType(filePath: string, mimeType: string | null): string {
  if (filePath.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }
  if (filePath.endsWith('.pdf')) {
    return 'application/pdf'
  }
  if (filePath.endsWith('.html')) {
    return 'text/html'
  }
  if (filePath.endsWith('.xlsx')) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }
  return mimeType || 'application/octet-stream'
}

function fileResponse(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): NextResponse {
  return new NextResponse(fileBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName || 'document')}"`,
      'Content-Length': fileBuffer.length.toString(),
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
    },
  })
}

async function validateAndServeUpdXlsx(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  context: {
    documentId: string
    filePath: string
    versionParam: string | null
    isLegacy: boolean
  }
): Promise<NextResponse> {
  const metrics = inspectXlsxBuffer(fileBuffer)

  if (metrics.mergeCount !== EXPECTED_UPD_MERGE_COUNT) {
    return NextResponse.json(
      {
        error:
          'Файл УПД устарел (повреждённая структура Excel). Нажмите «Сформировать» в редакторе и скачайте заново.',
        mergeCount: metrics.mergeCount,
        expectedMergeCount: EXPECTED_UPD_MERGE_COUNT,
      },
      { status: 409 }
    )
  }

  return fileResponse(fileBuffer, fileName, mimeType)
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!user.companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const document = await prisma.document.findFirst({
      where: {
        id: params.id,
        OR: [
          { companyId: user.companyId },
          { companyId: null, creator: { companyId: user.companyId } },
        ],
      },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Заказчик может скачивать только опубликованные документы
    if (user.role === 'CLIENT' && !document.isPublished) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const versionParam = request.nextUrl.searchParams.get('version')
    const formatParam = request.nextUrl.searchParams.get('format')
    const wantPdf = formatParam === 'pdf'

    let filePath = wantPdf ? document.pdfFilePath : document.filePath
    let fileName = wantPdf ? document.pdfFileName : document.fileName
    let mimeType = wantPdf ? 'application/pdf' : document.mimeType
    let fileSize = wantPdf ? document.pdfFileSize : document.fileSize

    if (versionParam) {
      const versionNum = parseInt(versionParam, 10)
      if (!isNaN(versionNum)) {
        const versionRecord =
          versionNum === document.version
            ? null
            : await prisma.documentVersion.findFirst({
                where: { documentId: params.id, version: versionNum },
              })
        if (versionRecord) {
          filePath = wantPdf ? versionRecord.pdfFilePath : versionRecord.filePath
          fileName = wantPdf ? versionRecord.pdfFileName : versionRecord.fileName
          mimeType = wantPdf ? 'application/pdf' : versionRecord.mimeType
          fileSize = wantPdf ? versionRecord.pdfFileSize : versionRecord.fileSize
        }
      }
    }

    if (!filePath || filePath === 'draft-placeholder.txt' || !fileSize) {
      const label = wantPdf ? 'PDF' : 'файл'
      return NextResponse.json(
        { error: `${label} ещё не сформирован. Нажмите «Сформировать» в редакторе.` },
        { status: 404 }
      )
    }

    const resolvedMime = resolveMimeType(filePath, mimeType)
    const isUpdXlsx =
      document.category === 'UPD' && !wantPdf && filePath.endsWith('.xlsx')

    if (isMinIOKey(filePath)) {
      // UPD-xlsx требует валидации структуры → нужен буфер целиком.
      if (isUpdXlsx) {
        const fileBuffer = await getFileBuffer(filePath)
        return validateAndServeUpdXlsx(fileBuffer, fileName || 'document.xlsx', resolvedMime, {
          documentId: params.id,
          filePath,
          versionParam,
          isLegacy: !document.contentJson,
        })
      }

      // Обычные файлы — стримом, без загрузки целиком в память процесса.
      const { stream, contentLength } = await getFileStream(filePath)
      const headers: Record<string, string> = {
        'Content-Type': resolvedMime,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName || 'document')}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
      }
      if (contentLength != null) headers['Content-Length'] = String(contentLength)
      return new NextResponse(stream as unknown as BodyInit, { status: 200, headers })
    }

    const uploadsDir = join(process.cwd(), 'uploads')
    const localPath = join(uploadsDir, filePath)
    try {
      const fileBuffer = await readFile(localPath)

      if (isUpdXlsx) {
        return validateAndServeUpdXlsx(fileBuffer, fileName || 'document.xlsx', resolvedMime, {
          documentId: params.id,
          filePath,
          versionParam,
          isLegacy: !document.contentJson,
        })
      }

      return fileResponse(fileBuffer, fileName || 'document', resolvedMime)
    } catch (fileError) {
      console.error('Error reading file:', fileError)
      return NextResponse.json({ error: 'File not found or cannot be read' }, { status: 404 })
    }
  } catch (error) {
    console.error('Error downloading document:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

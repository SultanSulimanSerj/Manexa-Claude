import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

export async function GET() {
  const filePath = path.join(process.cwd(), 'assets/templates/contract-template.docx')
  if (!fs.existsSync(filePath)) {
    return NextResponse.json(
      { error: 'Базовый шаблон не найден. Запустите npm run prepare:contract-template' },
      { status: 404 }
    )
  }

  const buffer = fs.readFileSync(filePath)
  return new NextResponse(buffer, {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': 'attachment; filename="contract-template.docx"',
    },
  })
}

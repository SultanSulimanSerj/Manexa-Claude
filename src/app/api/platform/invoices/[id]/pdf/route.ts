import { NextRequest, NextResponse } from 'next/server'
import { checkPlatformPermission } from '@/lib/platform-auth'
import { getPlatformSettings } from '@/lib/platform-settings'
import { renderInvoiceHtml } from '@/lib/billing/invoice-html'
import { htmlToPdf } from '@/lib/html-to-pdf'
import { getFileBuffer } from '@/lib/storage'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { allowed, user, error } = await checkPlatformPermission(request, 'canManagePlatform')
  if (!allowed || !user) {
    return NextResponse.json({ error: error || 'Не найдено' }, { status: 404 })
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { company: true },
  })
  if (!invoice) return NextResponse.json({ error: 'Счёт не найден' }, { status: 404 })

  const settings = await getPlatformSettings()

  // СБП QR как data URI (если загружен)
  let sbpQrDataUri: string | null = null
  if (settings.sbpQrPath) {
    try {
      const buf = await getFileBuffer(settings.sbpQrPath)
      sbpQrDataUri = `data:image/png;base64,${buf.toString('base64')}`
    } catch {
      sbpQrDataUri = null
    }
  }

  const html = renderInvoiceHtml(
    {
      number: invoice.number,
      issuedAt: invoice.issuedAt,
      planName: invoice.planName,
      months: invoice.months,
      amount: Number(invoice.amount),
      vatRate: invoice.vatRate,
      vatAmount: Number(invoice.vatAmount),
    },
    settings,
    {
      name: invoice.company.name,
      legalName: invoice.company.legalName,
      inn: invoice.company.inn,
      kpp: invoice.company.kpp,
      legalAddress: invoice.company.legalAddress,
    },
    sbpQrDataUri
  )

  try {
    const pdf = await htmlToPdf(html)
    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(`Счёт-${invoice.number}.pdf`)}`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    console.error('Invoice PDF error:', err)
    return NextResponse.json({ error: 'Не удалось сформировать PDF' }, { status: 500 })
  }
}

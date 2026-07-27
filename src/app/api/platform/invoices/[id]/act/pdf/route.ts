import { NextRequest, NextResponse } from 'next/server'
import { checkPlatformPermission } from '@/lib/platform-auth'
import { getPlatformSettings } from '@/lib/platform-settings'
import { renderActHtml } from '@/lib/billing/invoice-html'
import { htmlToPdf } from '@/lib/html-to-pdf'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Акт об оказании услуг (доступен только для оплаченного счёта)
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
  if (invoice.status !== 'PAID' || !invoice.actNumber) {
    return NextResponse.json({ error: 'Акт доступен после оплаты счёта' }, { status: 400 })
  }

  const settings = await getPlatformSettings()

  const html = renderActHtml(
    {
      actNumber: invoice.actNumber,
      actDate: invoice.actGeneratedAt || invoice.paidAt || invoice.issuedAt,
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
    }
  )

  try {
    const pdf = await htmlToPdf(html)
    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(`Акт-${invoice.actNumber}.pdf`)}`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    console.error('Act PDF error:', err)
    return NextResponse.json({ error: 'Не удалось сформировать PDF' }, { status: 500 })
  }
}

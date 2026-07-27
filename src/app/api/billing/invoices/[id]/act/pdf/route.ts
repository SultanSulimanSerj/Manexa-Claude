import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/auth-middleware'
import { getPlatformSettings } from '@/lib/platform-settings'
import { renderActHtml } from '@/lib/billing/invoice-html'
import { htmlToPdf } from '@/lib/html-to-pdf'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// PDF акта для компании (только её собственный, после оплаты)
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { allowed, user } = await checkPermission(request, 'canViewCompanySettings')
  if (!allowed || !user || !user.companyId) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, companyId: user.companyId },
    include: { company: true },
  })
  if (!invoice) return NextResponse.json({ error: 'Счёт не найден' }, { status: 404 })
  if (invoice.status !== 'PAID' || !invoice.actNumber) {
    return NextResponse.json({ error: 'Акт доступен после оплаты' }, { status: 400 })
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
    console.error('Company act PDF error:', err)
    return NextResponse.json({ error: 'Не удалось сформировать PDF' }, { status: 500 })
  }
}

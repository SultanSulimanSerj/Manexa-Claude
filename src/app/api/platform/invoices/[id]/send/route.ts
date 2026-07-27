import { NextRequest, NextResponse } from 'next/server'
import { checkPlatformPermission } from '@/lib/platform-auth'
import { getPlatformSettings } from '@/lib/platform-settings'
import { renderInvoiceHtml } from '@/lib/billing/invoice-html'
import { htmlToPdf } from '@/lib/html-to-pdf'
import { getFileBuffer } from '@/lib/storage'
import { sendMail, isMailEnabled } from '@/lib/mail'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// POST — отправить счёт на email компании (PDF во вложении)
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { allowed, user, error } = await checkPlatformPermission(request, 'canManagePlatform')
  if (!allowed || !user) {
    return NextResponse.json({ error: error || 'Не найдено' }, { status: 404 })
  }

  if (!isMailEnabled()) {
    return NextResponse.json({ error: 'Почта не настроена на сервере' }, { status: 400 })
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { company: true },
  })
  if (!invoice) return NextResponse.json({ error: 'Счёт не найден' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const to = (body.email || invoice.company.contactEmail || '').trim()
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ error: 'Нет корректного email компании' }, { status: 400 })
  }

  const settings = await getPlatformSettings()

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
    const amount = Number(invoice.amount).toLocaleString('ru-RU')
    const sent = await sendMail({
      to,
      subject: `Счёт на оплату № ${invoice.number} — Manexa`,
      text: `Здравствуйте!\n\nВо вложении счёт на оплату № ${invoice.number} на сумму ${amount} ₽.\nОплату можно произвести банковским переводом по реквизитам или по СБП QR из счёта.\n\nПосле поступления оплаты подписка будет продлена.`,
      attachments: [{ filename: `Счёт-${invoice.number}.pdf`, content: pdf, contentType: 'application/pdf' }],
    })
    if (!sent) {
      return NextResponse.json({ error: 'Не удалось отправить письмо' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, to })
  } catch (err) {
    console.error('Invoice send error:', err)
    return NextResponse.json({ error: 'Не удалось отправить счёт' }, { status: 500 })
  }
}

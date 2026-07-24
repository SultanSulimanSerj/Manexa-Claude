import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/auth-middleware'
import { blockIfImpersonated } from '@/lib/impersonation-guard'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const blocked = await blockIfImpersonated(request)
    if (blocked) return blocked

    const { allowed, user, error } = await checkPermission(request, 'canEditUsers')
    
    if (!allowed || !user) {
      return NextResponse.json({ error: error || 'Недостаточно прав' }, { status: 403 })
    }

    const body = await request.json()
    const {
      name,
      description,
      legalName, // Добавляем legalName
      inn,
      kpp,
      ogrn,
      legalAddress,
      actualAddress,
      directorName,
      directorPosition, // Добавляем directorPosition
      contactEmail,
      contactPhone,
      bankAccount,
      bankName,
      bankBik,
      correspondentAccount
    } = body

    // Проверяем, что пользователь может редактировать эту компанию
    if (user.companyId !== params.id) {
      return NextResponse.json({ error: 'Нет доступа к этой компании' }, { status: 403 })
    }

    // Обновляем компанию
    const updatedCompany = await prisma.company.update({
      where: {
        id: params.id
      },
      data: {
        name: name || undefined,
        description: description || undefined,
        legalName: legalName || undefined, // Добавляем legalName
        inn: inn || undefined,
        kpp: kpp || undefined,
        ogrn: ogrn || undefined,
        legalAddress: legalAddress || undefined,
        actualAddress: actualAddress || undefined,
        directorName: directorName || undefined,
        directorPosition: directorPosition || undefined, // Добавляем directorPosition
        contactEmail: contactEmail || undefined,
        contactPhone: contactPhone || undefined,
        bankAccount: bankAccount || undefined,
        bankName: bankName || undefined,
        bankBik: bankBik || undefined,
        correspondentAccount: correspondentAccount || undefined,
        updatedAt: new Date()
      },
      select: {
        id: true,
        name: true,
        description: true,
        legalName: true, // Добавляем legalName
        inn: true,
        kpp: true,
        ogrn: true,
        legalAddress: true,
        actualAddress: true,
        directorName: true,
        directorPosition: true, // Добавляем directorPosition
        contactEmail: true,
        contactPhone: true,
        bankAccount: true,
        bankName: true,
        bankBik: true,
        correspondentAccount: true
      }
    })

    return NextResponse.json({
      message: 'Настройки компании обновлены',
      company: updatedCompany
    })

  } catch (error) {
    console.error('Company update error:', error)
    return NextResponse.json({ error: 'Ошибка обновления компании' }, { status: 500 })
  }
}

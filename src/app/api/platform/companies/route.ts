import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { checkPlatformPermission, logPlatformAction } from '@/lib/platform-auth'
import { generateTempPassword } from '@/lib/temp-password'

export const dynamic = 'force-dynamic'

/** Список компаний с метриками. */
export async function GET(request: NextRequest) {
  const { allowed, user, error } = await checkPlatformPermission(request, 'canManagePlatform')
  if (!allowed || !user) {
    return NextResponse.json({ error: error || 'Не найдено' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.trim()
  const status = searchParams.get('status') // active | archived | suspended | trial

  const where: any = {}
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { legalName: { contains: search, mode: 'insensitive' } },
      { inn: { contains: search } },
    ]
  }
  if (status === 'archived') where.isActive = false
  if (status === 'active') where.isActive = true
  if (status === 'suspended') where.subscription = { status: 'SUSPENDED' }
  if (status === 'trial') where.subscription = { status: 'TRIAL' }

  const companies = await prisma.company.findMany({
    where,
    select: {
      id: true,
      name: true,
      legalName: true,
      inn: true,
      isActive: true,
      createdAt: true,
      subscription: {
        select: {
          status: true,
          currentPeriodEnd: true,
          plan: { select: { code: true, name: true } },
        },
      },
      _count: { select: { users: true, projects: true, documents: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ companies })
}

/** Создание компании с директором (OWNER) и триальной подпиской. */
export async function POST(request: NextRequest) {
  const { allowed, user, error } = await checkPlatformPermission(request, 'canManagePlatform')
  if (!allowed || !user) {
    return NextResponse.json({ error: error || 'Не найдено' }, { status: 404 })
  }

  const body = await request.json()
  const {
    // Компания
    name,
    legalName,
    inn,
    kpp,
    ogrn,
    legalAddress,
    actualAddress,
    city,
    directorName,
    contactPhone,
    contactEmail,
    bankAccount,
    bankName,
    bankBik,
    correspondentAccount,
    // Директор (OWNER)
    ownerName,
    ownerEmail,
    // Тариф (опционально, по умолчанию TRIAL)
    planCode,
  } = body

  if (!name || !inn || !ownerName || !ownerEmail) {
    return NextResponse.json(
      { error: 'Обязательные поля: название компании, ИНН, имя и email директора' },
      { status: 400 }
    )
  }

  const existingUser = await prisma.user.findUnique({ where: { email: ownerEmail } })
  if (existingUser) {
    return NextResponse.json(
      { error: `Пользователь с email ${ownerEmail} уже существует` },
      { status: 409 }
    )
  }

  const plan = await prisma.plan.findUnique({ where: { code: planCode || 'TRIAL' } })
  if (!plan) {
    return NextResponse.json(
      { error: `Тариф ${planCode || 'TRIAL'} не найден. Выполните npm run platform:seed-plans` },
      { status: 400 }
    )
  }

  const tempPassword = generateTempPassword()
  const hashedPassword = await bcrypt.hash(tempPassword, 10)

  const trialDays = 14
  const periodEnd = new Date()
  periodEnd.setDate(periodEnd.getDate() + (plan.code === 'TRIAL' ? trialDays : 30))

  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name,
        legalName: legalName || null,
        inn,
        kpp: kpp || null,
        ogrn: ogrn || null,
        legalAddress: legalAddress || null,
        actualAddress: actualAddress || null,
        city: city || null,
        directorName: directorName || ownerName,
        contactPhone: contactPhone || null,
        contactEmail: contactEmail || ownerEmail,
        bankAccount: bankAccount || null,
        bankName: bankName || null,
        bankBik: bankBik || null,
        correspondentAccount: correspondentAccount || null,
      },
    })

    const owner = await tx.user.create({
      data: {
        name: ownerName,
        email: ownerEmail,
        password: hashedPassword,
        role: 'OWNER',
        companyId: company.id,
        mustChangePassword: true,
      },
    })

    const subscription = await tx.subscription.create({
      data: {
        companyId: company.id,
        planId: plan.id,
        status: plan.code === 'TRIAL' ? 'TRIAL' : 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
      },
    })

    return { company, owner, subscription }
  })

  await logPlatformAction({
    actorId: user.id,
    actorEmail: user.email,
    action: 'COMPANY_CREATE',
    targetType: 'Company',
    targetId: result.company.id,
    metadata: { name, inn, ownerEmail, plan: plan.code },
    request,
  })

  return NextResponse.json({
    company: { id: result.company.id, name: result.company.name },
    owner: { id: result.owner.id, email: result.owner.email },
    // Временный пароль показывается менеджеру один раз — передать директору вручную
    tempPassword,
    subscription: {
      status: result.subscription.status,
      currentPeriodEnd: result.subscription.currentPeriodEnd,
      plan: plan.code,
    },
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as bcrypt from 'bcryptjs'
import { generateId } from '@/lib/id-generator'
import { isPublicRegistrationAllowed } from '@/lib/prod-guard'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request)
    const rateLimit = await checkRateLimit(`register-ip:${ip}`, 5, 60 * 60 * 1000)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Слишком много попыток регистрации. Попробуйте позже.' },
        { status: 429 }
      )
    }

    if (!isPublicRegistrationAllowed()) {
      return NextResponse.json(
        { error: 'Регистрация отключена. Обратитесь к администратору.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { 
      name, 
      email, 
      password, 
      phone, 
      address, 
      companyName, 
      companyDescription,
      // Реквизиты компании для генерации документов
      inn,
      kpp,
      ogrn,
      legalAddress,
      actualAddress,
      directorName,
      contactPhone,
      contactEmail,
      bankAccount,
      bankName,
      bankBik,
      correspondentAccount
    } = body

    // Валидация
    if (!name || !email || !password || !companyName || !inn || !directorName) {
      return NextResponse.json({ error: 'Все обязательные поля должны быть заполнены (ФИО, Email, Пароль, Название компании, ИНН, ФИО директора)' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Пароль должен содержать минимум 8 символов' }, { status: 400 })
    }

    // Проверяем, существует ли пользователь
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json({ error: 'Пользователь с таким email уже существует' }, { status: 400 })
    }

    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 10)

    // Создаем компанию и пользователя в транзакции
    const result = await prisma.$transaction(async (tx) => {
      // Создаем компанию
      const company = await tx.company.create({
        data: {
          id: generateId(),
          name: companyName,
          description: companyDescription || null,
          inn: inn,
          kpp: kpp || null,
          ogrn: ogrn || null,
          legalAddress: legalAddress || null,
          actualAddress: actualAddress || null,
          directorName: directorName,
          contactEmail: contactEmail || email, // Используем контактный email или основной
          contactPhone: contactPhone || phone || null,
          bankAccount: bankAccount || null,
          bankName: bankName || null,
          bankBik: bankBik || null,
          correspondentAccount: correspondentAccount || null,
          updatedAt: new Date()
        }
      })

      // Создаем пользователя как владельца компании
      const user = await tx.user.create({
        data: {
          id: generateId(),
          name,
          email,
          password: hashedPassword,
          role: 'OWNER',
          position: 'Владелец',
          companyId: company.id,
          phone: phone || null,
          address: address || null,
          updatedAt: new Date()
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          position: true,
          phone: true,
          address: true,
          companyId: true,
          company: {
            select: {
              id: true,
              name: true,
              legalName: true,
              inn: true,
              directorName: true,
              directorPosition: true,
              contactEmail: true,
              contactPhone: true,
              bankAccount: true,
              bankName: true,
              bankBik: true,
              correspondentAccount: true,
              legalAddress: true,
              actualAddress: true,
              city: true
            }
          }
        }
      })

      return { user, company }
    })

    return NextResponse.json({
      message: 'Регистрация прошла успешно',
      user: result.user,
      company: result.company
    }, { status: 201 })

  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json({ error: 'Ошибка регистрации' }, { status: 500 })
  }
}
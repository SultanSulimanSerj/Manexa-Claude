import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-api'
import { blockIfImpersonated } from '@/lib/impersonation-guard'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateUser(request)
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Получаем полные данные пользователя
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        position: true,
        phone: true,
        image: true,
        companyId: true,
        company: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (!fullUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(fullUser)
  } catch (error) {
    console.error('Error fetching current user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await authenticateUser(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Под impersonation нельзя менять профиль (пароль/email) чужой учётки
    const blocked = await blockIfImpersonated(request)
    if (blocked) return blocked

    const body = await request.json()
    const { name, email, phone, position, password } = body

    // Prepare update data
    const updateData: any = {
      ...(name && { name }),
      ...(email && { email }),
      ...(phone !== undefined && { phone }),
      ...(position !== undefined && { position }),
      updatedAt: new Date()
    }

    // Only update password if provided
    if (password && password.trim() !== '') {
      const bcrypt = require('bcryptjs')
      updateData.password = await bcrypt.hash(password, 10)
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        position: true,
        phone: true,
        image: true
      }
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Error updating current user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


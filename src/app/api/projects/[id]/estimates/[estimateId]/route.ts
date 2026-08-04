import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

interface EstimateItemInput {
  id: string
  name: string
  description?: string | null
  notes?: string | null
  quantity: number | string
  unit: string
  unitPrice: number | string
  costPrice?: number | string
  vatRate?: number | string | null
  category: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; estimateId: string } }
) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canViewEstimates')
    
    if (!allowed || !user) {
      return NextResponse.json({ error: error || 'Недостаточно прав' }, { status: 403 })
    }

    const estimate = await prisma.estimate.findFirst({
      where: {
        id: params.estimateId,
        projectId: params.id,
        project: {
          companyId: user.companyId
        }
      },
      include: {
        items: true,
        creator: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    if (!estimate) {
      return NextResponse.json({ error: 'Смета не найдена' }, { status: 404 })
    }

    return NextResponse.json(estimate)
  } catch (error) {
    console.error('Error fetching estimate:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; estimateId: string } }
) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canEditEstimates')
    
    if (!allowed || !user) {
      return NextResponse.json({ error: error || 'Недостаточно прав' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, vatEnabled, vatRate, items, status, contractNumber } = body

    if (!name) {
      return NextResponse.json({ error: 'Название сметы обязательно' }, { status: 400 })
    }

    // Проверяем, что смета существует и принадлежит компании пользователя
    const existingEstimate = await prisma.estimate.findFirst({
      where: {
        id: params.estimateId,
        projectId: params.id,
        project: {
          companyId: user.companyId
        }
      }
    })

    if (!existingEstimate) {
      return NextResponse.json({ error: 'Смета не найдена' }, { status: 404 })
    }

    // Обновляем смету и позиции в транзакции
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Удаляем старые позиции
      await tx.estimateItem.deleteMany({
        where: { estimateId: params.estimateId }
      })

      // Создаем новые позиции
      let total = 0
      let totalCost = 0
      let vatAmount = 0
      const estimateRate = Number(vatRate || 20)
      if (items && items.length > 0) {
        const estimateItems = (items as EstimateItemInput[]).map((item) => {
          const itemTotal = Number(item.quantity) * Number(item.unitPrice)
          const itemCost = Number(item.quantity) * Number(item.costPrice || 0)
          // ставка НДС позиции: своя, иначе ставка сметы
          const lineRate = item.vatRate != null && item.vatRate !== '' ? Number(item.vatRate) : estimateRate
          total += itemTotal
          totalCost += itemCost
          if (vatEnabled) vatAmount += (itemTotal * lineRate) / 100

          return {
            id: item.id.startsWith('new_') || item.id.startsWith('dup_') || item.id.startsWith('tpl_')
              ? undefined
              : item.id,
            name: item.name,
            description: item.description || null,
            notes: item.notes || null,
            quantity: Number(item.quantity),
            unit: item.unit,
            unitPrice: Number(item.unitPrice),
            costPrice: Number(item.costPrice || 0),
            vatRate: item.vatRate != null && item.vatRate !== '' ? Number(item.vatRate) : null,
            total: itemTotal,
            category: item.category
          }
        })

        await tx.estimateItem.createMany({
          data: estimateItems.map((item) => ({
            ...item,
            estimateId: params.estimateId
          }))
        })
      }

      const profit = total - totalCost
      const totalWithVat = total + vatAmount

      // Обновляем смету
      const updatedEstimate = await tx.estimate.update({
        where: { id: params.estimateId },
        data: {
          name,
          description: description || null,
          ...(status ? { status } : {}),
          ...(contractNumber !== undefined ? { contractNumber: contractNumber || null } : {}),
          total,
          totalCost,
          profit,
          vatEnabled: vatEnabled || false,
          vatRate: estimateRate,
          vatAmount,
          totalWithVat,
          updatedAt: new Date()
        },
        include: {
          items: true,
          creator: {
            select: { id: true, name: true, email: true }
          }
        }
      })

      return updatedEstimate
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error updating estimate:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; estimateId: string } }
) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canDeleteEstimates')
    
    if (!allowed || !user) {
      return NextResponse.json({ error: error || 'Недостаточно прав' }, { status: 403 })
    }

    // Проверяем, что смета существует и принадлежит компании пользователя
    const existingEstimate = await prisma.estimate.findFirst({
      where: {
        id: params.estimateId,
        projectId: params.id,
        project: {
          companyId: user.companyId
        }
      }
    })

    if (!existingEstimate) {
      return NextResponse.json({ error: 'Смета не найдена' }, { status: 404 })
    }

    // Удаляем смету (позиции удалятся автоматически из-за onDelete: Cascade)
    await prisma.estimate.delete({
      where: { id: params.estimateId }
    })

    return NextResponse.json({ message: 'Смета удалена' })
  } catch (error) {
    console.error('Error deleting estimate:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}

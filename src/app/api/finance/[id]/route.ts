import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/auth-middleware'
import { blockIfImpersonated } from '@/lib/impersonation-guard'
import { verifyFinanceCompanyAccess, verifyProjectCompanyAccess } from '@/lib/access-control'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const blocked = await blockIfImpersonated(request)
    if (blocked) return blocked

    const { allowed, user, error } = await checkPermission(request, 'canEditFinances')
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!allowed) {
      return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
    }

    const hasAccess = await verifyFinanceCompanyAccess(user, params.id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { type, category, description, amount, date, projectId, invoiceNumber, dueDate, counterparty, purchasedBy, receiptKeys, estimateItemId } = body

    if (projectId) {
      const projectOk = await verifyProjectCompanyAccess(user, projectId)
      if (!projectOk) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
    }

    let parsedAmount: number | undefined
    if (amount !== undefined) {
      parsedAmount = parseFloat(amount)
      if (isNaN(parsedAmount) || parsedAmount < 0) {
        return NextResponse.json({ error: 'Некорректная сумма' }, { status: 400 })
      }
    }

    const finance = await prisma.finance.update({
      where: { id: params.id },
      data: {
        ...(type && { type }),
        ...(category && { category }),
        ...(description !== undefined && { description: description || null }),
        ...(parsedAmount !== undefined && { amount: parsedAmount }),
        ...(date && { date: new Date(date) }),
        ...(projectId !== undefined && { projectId: projectId || null }),
        ...(invoiceNumber !== undefined && { invoiceNumber: invoiceNumber || null }),
        ...(counterparty !== undefined && { counterparty: counterparty || null }),
        ...(purchasedBy !== undefined && { purchasedBy: purchasedBy || null }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(estimateItemId !== undefined && { estimateItemId: estimateItemId || null }),
        ...(Array.isArray(receiptKeys) && { receiptKeys: receiptKeys.filter((k: unknown) => typeof k === 'string') }),
        updatedAt: new Date(),
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
      },
    })

    return NextResponse.json(finance)
  } catch (error) {
    console.error('Error updating finance record:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const blocked = await blockIfImpersonated(request)
    if (blocked) return blocked

    const { allowed, user, error } = await checkPermission(request, 'canDeleteFinances')
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!allowed) {
      return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
    }

    const hasAccess = await verifyFinanceCompanyAccess(user, params.id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await prisma.finance.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting finance record:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

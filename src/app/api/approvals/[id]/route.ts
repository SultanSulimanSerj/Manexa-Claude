import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-api'
import { blockIfImpersonated } from '@/lib/impersonation-guard'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/lib/permissions'
import { verifyApprovalCompanyAccess } from '@/lib/access-control'
import { checkPermission } from '@/lib/auth-middleware'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let where: any = {
      id: params.id,
      // Проверяем, что согласование принадлежит компании пользователя
      creator: {
        companyId: user.companyId
      }
    }

    // OWNER и ADMIN видят все согласования компании
    if (user.role === UserRole.OWNER || user.role === UserRole.ADMIN) {
      // Никаких дополнительных ограничений
    } else {
      // MANAGER и USER видят только согласования:
      where.OR = [
        // Пользователь является создателем согласования
        { creatorId: user.id },
        // Пользователь является участником согласования
        { assignments: { some: { userId: user.id } } },
        // Согласование привязано к проекту, где пользователь участвует
        {
          project: {
            OR: [
              { creatorId: user.id },
              { users: { some: { userId: user.id } } }
            ]
          }
        },
        // Согласование не привязано к проекту
        { projectId: null }
      ]
    }

    const approval = await prisma.approval.findFirst({
      where,
      include: {
        creator: {
          select: { id: true, name: true, email: true }
        },
        project: {
          select: { id: true, name: true }
        },
        document: {
          select: { id: true, title: true, isPublished: true }
        },
        assignments: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        comments: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        attachments: {
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: {
            comments: true,
            attachments: true
          }
        }
      }
    })

    if (!approval) {
      return NextResponse.json({ error: 'Approval not found or access denied' }, { status: 404 })
    }

    return NextResponse.json(approval)
  } catch (error) {
    console.error('Error fetching approval:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { status, comment } = body

    // Сначала проверяем, что пользователь имеет право обновлять это согласование
    let where: any = {
      id: params.id,
      // Проверяем, что согласование принадлежит компании пользователя
      creator: {
        companyId: user.companyId
      }
    }

    // OWNER и ADMIN могут обновлять все согласования компании
    if (user.role === UserRole.OWNER || user.role === UserRole.ADMIN) {
      // Никаких дополнительных ограничений
    } else {
      // MANAGER и USER могут обновлять только согласования:
      where.OR = [
        // Пользователь является создателем согласования
        { creatorId: user.id },
        // Пользователь является участником согласования
        { assignments: { some: { userId: user.id } } },
        // Согласование привязано к проекту, где пользователь участвует
        {
          project: {
            OR: [
              { creatorId: user.id },
              { users: { some: { userId: user.id } } }
            ]
          }
        }
      ]
    }

    const existingApproval = await prisma.approval.findFirst({
      where
    })

    if (!existingApproval) {
      return NextResponse.json({ error: 'Approval not found or access denied' }, { status: 404 })
    }

    const approval = await prisma.approval.update({
      where: { id: params.id },
      data: {
        status,
        ...(status === 'APPROVED' && { approvedAt: new Date() }),
        ...(status === 'REJECTED' && { rejectedAt: new Date() }),
        updatedAt: new Date()
      },
      include: {
        document: {
          select: {
            id: true,
            title: true
          }
        },
        project: {
          select: {
            id: true,
            name: true
          }
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    })

    return NextResponse.json(approval)
  } catch (error) {
    console.error('Error updating approval:', error)
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

    const { allowed, user, error } = await checkPermission(request, 'canDeleteApprovals')
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!allowed) {
      return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
    }

    const hasAccess = await verifyApprovalCompanyAccess(user, params.id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await prisma.$transaction([
      // Удаляем назначения
      prisma.approvalAssignment.deleteMany({
        where: { approvalId: params.id }
      }),
      // Удаляем комментарии
      prisma.approvalComment.deleteMany({
        where: { approvalId: params.id }
      }),
      // Удаляем вложения
      prisma.approvalAttachment.deleteMany({
        where: { approvalId: params.id }
      }),
      // Удаляем историю
      prisma.approvalHistory.deleteMany({
        where: { approvalId: params.id }
      }),
      // Удаляем само согласование
      prisma.approval.delete({
        where: { id: params.id }
      })
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting approval:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

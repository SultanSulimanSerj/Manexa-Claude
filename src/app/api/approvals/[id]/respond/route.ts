import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-api'
import { blockIfImpersonated } from '@/lib/impersonation-guard'
import { prisma } from '@/lib/prisma'
import { generateId } from '@/lib/id-generator'

// POST /api/approvals/[id]/respond - Ответить на согласование (одобрить/отклонить)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Согласование/подпись — юр-значимое действие, запрещено под impersonation
    const blocked = await blockIfImpersonated(request)
    if (blocked) return blocked

    const body = await request.json()
    const { status, comment } = body

    if (!status || (status !== 'APPROVED' && status !== 'REJECTED')) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Сначала проверяем, что пользователь является участником этого согласования
    const existingAssignment = await prisma.approvalAssignment.findFirst({
      where: {
        approvalId: params.id,
        userId: user.id
      },
      include: {
        approval: {
          include: {
            creator: true
          }
        }
      }
    })

    if (!existingAssignment) {
      return NextResponse.json({ error: 'You are not assigned to this approval' }, { status: 403 })
    }

    // Дополнительно проверяем, что согласование принадлежит компании пользователя
    if (existingAssignment.approval.creator.companyId !== user.companyId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Обновляем ApprovalAssignment
    const assignment = await prisma.approvalAssignment.updateMany({
      where: {
        approvalId: params.id,
        userId: user.id
      },
      data: {
        status,
        comment: comment || null
      }
    })

    if (assignment.count === 0) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    // Получаем согласование
    const approval = await prisma.approval.findUnique({
      where: { id: params.id },
      include: {
        assignments: true,
        document: true
      }
    })

    if (!approval) {
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 })
    }

    // Проверяем, все ли согласовали (если требуется согласие всех)
    const allApproved = approval.assignments.every(a => a.status === 'APPROVED')
    const anyRejected = approval.assignments.some(a => a.status === 'REJECTED')

    let newApprovalStatus = approval.status

    if (approval.requireAllApprovals) {
      // Требуется согласие всех
      if (allApproved) {
        newApprovalStatus = 'APPROVED'
      } else if (anyRejected) {
        newApprovalStatus = 'REJECTED'
      }
    } else {
      // Достаточно одного согласия
      if (anyRejected) {
        newApprovalStatus = 'REJECTED'
      } else if (approval.assignments.some(a => a.status === 'APPROVED')) {
        newApprovalStatus = 'APPROVED'
      }
    }

    // Обновляем статус согласования
    const updatedApproval = await prisma.approval.update({
      where: { id: params.id },
      data: {
        status: newApprovalStatus,
        ...(newApprovalStatus === 'APPROVED' && { approvedAt: new Date() }),
        ...(newApprovalStatus === 'REJECTED' && { rejectedAt: new Date() })
      },
      include: {
        document: true,
        project: true,
        creator: {
          select: { id: true, name: true, email: true }
        },
        assignments: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    })

    // Если согласование одобрено, обрабатываем документы и вложения
    if (newApprovalStatus === 'APPROVED') {
      // Если есть связанный документ, публикуем его
      if (approval.document && approval.autoPublishOnApproval) {
        await prisma.document.update({
          where: { id: approval.documentId! },
          data: {
            isPublished: true,
            publishedAt: new Date()
          }
        })
      }

      // Добавляем все вложения согласования в документацию проекта
      if (approval.projectId) {
        const attachments = await prisma.approvalAttachment.findMany({
          where: { approvalId: params.id }
        })

        // Создаем документы из вложений
        for (const attachment of attachments) {
          await prisma.document.create({
            data: {
              id: generateId(),
              title: attachment.fileName,
              description: `Документ из согласования: ${approval.title}`,
              filePath: attachment.filePath,
              fileName: attachment.fileName,
              fileSize: attachment.fileSize,
              mimeType: attachment.mimeType,
              version: 1,
              documentNumber: `DOC-${Date.now()}`,
              projectId: approval.projectId,
              creatorId: user.id,
              isPublished: true,
              publishedAt: new Date(),
              category: 'LEGAL',
              updatedAt: new Date()
            }
          })
        }
      }
    }

    // Добавляем запись в историю
    await prisma.approvalHistory.create({
      data: {
        id: generateId(),
        action: status === 'APPROVED' ? 'approved' : 'rejected',
        changes: {
          status,
          comment,
          userId: user.id
        },
        approvalId: params.id,
        userId: user.id
      }
    })

    return NextResponse.json(updatedApproval)
  } catch (error) {
    console.error('Error responding to approval:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/auth-middleware'
import { verifyUserCompanyAccess } from '@/lib/access-control'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/lib/permissions'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canEditUsers')
    
    if (!user) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 401 })
    }
    
    // Пользователь может редактировать только свой профиль (без изменения роли)
    const isSelfEdit = params.id === user.id

    if (!isSelfEdit && !(await verifyUserCompanyAccess(user, params.id))) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    }
    
    if (!allowed && !isSelfEdit) {
      return NextResponse.json({ error: error || 'Недостаточно прав' }, { status: 403 })
    }

    const body = await request.json()
    const { name, email, role, position, password, phone, address, isActive } = body

    // Деактивировать себя нельзя
    if (isSelfEdit && isActive === false) {
      return NextResponse.json({ error: 'Нельзя деактивировать самого себя' }, { status: 400 })
    }

    // Пользователь не может изменять свою роль
    if (isSelfEdit && role && role !== user.role) {
      return NextResponse.json({ error: 'Нельзя изменять свою роль' }, { status: 403 })
    }

    // Проверяем права на изменение роли других пользователей
    if (!isSelfEdit && role && role !== user.role) {
      if (role === UserRole.OWNER && user.role !== UserRole.OWNER) {
        return NextResponse.json({ error: 'Недостаточно прав для изменения роли на владельца' }, { status: 403 })
      }
      
      // Нельзя изменить роль OWNER
      const targetUser = await prisma.user.findUnique({ where: { id: params.id } })
      if (targetUser?.role === UserRole.OWNER && user.role !== UserRole.OWNER) {
        return NextResponse.json({ error: 'Недостаточно прав для изменения роли владельца' }, { status: 403 })
      }
    }

    // Prepare update data
    const updateData: any = {
      ...(name && { name }),
      ...(email && { email }),
      ...(phone !== undefined && { phone }),
      ...(address !== undefined && { address }),
      ...(!isSelfEdit && role && { role }),
      ...(position !== undefined && { position }),
      ...(!isSelfEdit && typeof isActive === 'boolean' && { isActive }),
      updatedAt: new Date()
    }

    // Only update password if provided
    if (password && password.trim() !== '') {
      const bcrypt = require('bcryptjs')
      updateData.password = await bcrypt.hash(password, 10)
    }

    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        position: true,
        phone: true,
        address: true,
        createdAt: true,
        _count: {
          select: {
            createdProjects: true,
            createdTasks: true
          }
        }
      }
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canDeleteUsers')
    
    if (!allowed || !user) {
      return NextResponse.json({ error: error || 'Недостаточно прав' }, { status: 403 })
    }

    // Don't allow deleting yourself
    if (params.id === user.id) {
      return NextResponse.json({ error: 'Нельзя удалить самого себя' }, { status: 400 })
    }

    if (!(await verifyUserCompanyAccess(user, params.id))) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    }

    // Проверяем, что нельзя удалить владельца
    const targetUser = await prisma.user.findUnique({ where: { id: params.id } })
    if (targetUser?.role === UserRole.OWNER) {
      return NextResponse.json({ error: 'Нельзя удалить владельца компании' }, { status: 403 })
    }

    // Контент, который нельзя удалять вместе с пользователем (история компании)
    const [
      createdProjects,
      createdTasks,
      createdDocuments,
      createdApprovals,
      createdEstimates,
      finances,
      chatMessages,
      taskComments,
      approvalComments,
      uploadedPhotos,
      approvalHistory,
      approvalAttachments,
    ] = await prisma.$transaction([
      prisma.project.count({ where: { creatorId: params.id } }),
      prisma.task.count({ where: { creatorId: params.id } }),
      prisma.document.count({ where: { creatorId: params.id } }),
      prisma.approval.count({ where: { creatorId: params.id } }),
      prisma.estimate.count({ where: { creatorId: params.id } }),
      prisma.finance.count({ where: { creatorId: params.id } }),
      prisma.chatMessage.count({ where: { userId: params.id } }),
      prisma.taskComment.count({ where: { userId: params.id } }),
      prisma.approvalComment.count({ where: { userId: params.id } }),
      prisma.stagePhoto.count({ where: { uploadedById: params.id } }),
      prisma.approvalHistory.count({ where: { userId: params.id } }),
      prisma.approvalAttachment.count({ where: { uploadedById: params.id } }),
    ])

    const blockers: string[] = []
    if (createdProjects) blockers.push(`проекты: ${createdProjects}`)
    if (createdTasks) blockers.push(`задачи: ${createdTasks}`)
    if (createdDocuments) blockers.push(`документы: ${createdDocuments}`)
    if (createdApprovals) blockers.push(`согласования: ${createdApprovals}`)
    if (createdEstimates) blockers.push(`сметы: ${createdEstimates}`)
    if (finances) blockers.push(`финансовые записи: ${finances}`)
    if (chatMessages) blockers.push(`сообщения в чате: ${chatMessages}`)
    if (taskComments) blockers.push(`комментарии к задачам: ${taskComments}`)
    if (approvalComments) blockers.push(`комментарии к согласованиям: ${approvalComments}`)
    if (uploadedPhotos) blockers.push(`фото этапов: ${uploadedPhotos}`)
    if (approvalHistory) blockers.push(`история согласований: ${approvalHistory}`)
    if (approvalAttachments) blockers.push(`вложения согласований: ${approvalAttachments}`)

    if (blockers.length > 0) {
      return NextResponse.json(
        {
          error: `Пользователь создал данные в системе (${blockers.join(', ')}). Удаление уничтожит историю — вместо этого деактивируйте пользователя (он потеряет доступ, но данные сохранятся).`,
          canDeactivate: true,
        },
        { status: 409 }
      )
    }

    // Безопасные связи (назначения, уведомления) удаляем, опциональные ссылки обнуляем
    await prisma.$transaction([
      prisma.projectUser.deleteMany({ where: { userId: params.id } }),
      prisma.taskAssignment.deleteMany({ where: { userId: params.id } }),
      prisma.approvalAssignment.deleteMany({ where: { userId: params.id } }),
      prisma.notification.deleteMany({ where: { userId: params.id } }),
      prisma.timesheet.deleteMany({ where: { userId: params.id } }),
      prisma.workStage.updateMany({
        where: { responsibleId: params.id },
        data: { responsibleId: null },
      }),
      prisma.checklistItem.updateMany({
        where: { completedById: params.id },
        data: { completedById: null },
      }),
      prisma.finance.updateMany({
        where: { paidById: params.id },
        data: { paidById: null },
      }),
      prisma.user.delete({ where: { id: params.id } }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

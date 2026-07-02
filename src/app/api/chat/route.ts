import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-api'
import { verifyProjectCompanyAccess } from '@/lib/access-control'
import { prisma } from '@/lib/prisma'
import { generateId } from '@/lib/id-generator'
import { notifyChatMentions } from '@/lib/chat-mentions'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const rawPage = parseInt(searchParams.get('page') || '1')
    const rawLimit = parseInt(searchParams.get('limit') || '50')
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage
    const limit = isNaN(rawLimit) || rawLimit < 1 ? 50 : Math.min(rawLimit, 100)

    const where = projectId 
      ? {
          projectId,
          project: {
            OR: [
              { creatorId: user.id }, // Пользователь создал проект
              { users: { some: { userId: user.id } } } // Пользователь является участником проекта
            ]
          }
        }
      : {
          projectId: null, // Общий чат - сообщения без проекта
          user: {
            companyId: user.companyId // Только пользователи той же компании
          }
        }

    const [messages, total] = await Promise.all([
      prisma.chatMessage.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          project: {
            select: {
              id: true,
              name: true
            }
          },
          attachments: {
            select: { id: true, fileName: true, fileSize: true, mimeType: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.chatMessage.count({ where })
    ])

    return NextResponse.json({
      messages: messages.reverse(), // Показываем старые сообщения первыми
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching chat messages:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { content, projectId, mentions, attachments } = body

    // Валидация вложений (метаданные из /api/chat/attachments)
    const validAttachments = Array.isArray(attachments)
      ? attachments
          .filter(
            (a: any) =>
              a && typeof a.filePath === 'string' && typeof a.fileName === 'string' && typeof a.mimeType === 'string'
          )
          .slice(0, 10)
          .map((a: any) => ({
            fileName: String(a.fileName).slice(0, 200),
            filePath: String(a.filePath),
            fileSize: Number(a.fileSize) || 0,
            mimeType: String(a.mimeType),
          }))
      : []

    // Пустое сообщение без вложений не принимаем
    if ((!content || !content.trim()) && validAttachments.length === 0) {
      return NextResponse.json({ error: 'Пустое сообщение' }, { status: 400 })
    }

    if (projectId) {
      const hasAccess = await verifyProjectCompanyAccess(user, projectId)
      if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const message = await prisma.chatMessage.create({
      data: {
        id: generateId(),
        content: content || '',
        projectId: projectId || null,
        userId: user.id,
        companyId: user.companyId || null,
        updatedAt: new Date(),
        ...(validAttachments.length > 0 && { attachments: { create: validAttachments } }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        project: {
          select: {
            id: true,
            name: true
          }
        },
        attachments: {
          select: { id: true, fileName: true, fileSize: true, mimeType: true }
        }
      }
    })

    // Отправляем через WebSocket
    try {
      const io = (global as any).io
      if (io) {
        if (projectId) {
          // Отправка в комнату проекта
          io.to(`project:${projectId}`).emit('new-message', message)
          console.log(`📨 Сообщение отправлено через WebSocket в проект ${projectId}`)
        } else if (user.companyId) {
          io.to(`company:${user.companyId}`).emit('new-message', message)
          console.log(`📨 Сообщение отправлено в общий чат компании ${user.companyId}`)
        } else {
          io.emit('new-message', message)
        }
      }
    } catch (socketError) {
      console.error('Ошибка отправки через WebSocket:', socketError)
    }

    try {
      const mentionNotifications = await notifyChatMentions({
        content,
        senderId: user.id,
        senderName: user.name || 'Пользователь',
        companyId: user.companyId,
        projectId: projectId || null,
        projectName: message.project?.name || null,
        messageId: message.id,
        mentionNames: mentions,
      })
      if (mentionNotifications.length > 0) {
        console.log(`🔔 Отправлены уведомления об упоминании для ${mentionNotifications.length} пользователей`)
      }
    } catch (notificationError) {
      console.error('Ошибка отправки уведомлений об упоминании:', notificationError)
    }

    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    console.error('Error creating chat message:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from './prisma'
import { UserRole, isPlatformRole, hasPermission, type Permissions } from './permissions'

// Сессия платформенных ролей живёт меньше обычной
export const PLATFORM_SESSION_MAX_AGE_SEC = 4 * 60 * 60 // 4 часа

export interface PlatformUserContext {
  id: string
  email: string
  name: string
  role: UserRole
}

/**
 * Проверка доступа к /api/platform/*.
 * Только платформенные роли; сессия не старше 4 часов; пользователь активен.
 */
export async function checkPlatformPermission(
  request: NextRequest,
  permission?: keyof Permissions
): Promise<{ allowed: boolean; user: PlatformUserContext | null; error?: string }> {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
    if (!token?.sub) {
      return { allowed: false, user: null, error: 'Не аутентифицирован' }
    }

    const role = token.role as string
    if (!isPlatformRole(role)) {
      return { allowed: false, user: null, error: 'Не найдено' }
    }

    // Ограничение времени жизни сессии платформенных ролей
    const loginAt = typeof token.loginAt === 'number' ? token.loginAt : null
    if (!loginAt || Date.now() - loginAt > PLATFORM_SESSION_MAX_AGE_SEC * 1000) {
      return { allowed: false, user: null, error: 'Сессия истекла, войдите заново' }
    }

    // Живая проверка активности (роль могли отозвать)
    const user = await prisma.user.findUnique({
      where: { id: token.sub },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    })
    if (!user || !user.isActive || !isPlatformRole(user.role)) {
      return { allowed: false, user: null, error: 'Доступ отозван' }
    }

    if (permission && !hasPermission(user.role as UserRole, permission)) {
      return { allowed: false, user: null, error: 'Недостаточно прав' }
    }

    return {
      allowed: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || '',
        role: user.role as UserRole,
      },
    }
  } catch (error) {
    console.error('Error checking platform permission:', error)
    return { allowed: false, user: null, error: 'Ошибка проверки прав' }
  }
}

interface AuditParams {
  actorId: string
  actorEmail?: string | null
  action: string
  targetType?: string
  targetId?: string
  metadata?: Record<string, unknown>
  request?: NextRequest
}

/** Запись действия платформенного пользователя в аудит. Никогда не бросает исключений. */
export async function logPlatformAction(params: AuditParams): Promise<void> {
  try {
    const ip =
      params.request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      params.request?.headers.get('x-real-ip') ||
      null

    await prisma.platformAuditLog.create({
      data: {
        actorId: params.actorId,
        actorEmail: params.actorEmail || null,
        action: params.action,
        targetType: params.targetType || null,
        targetId: params.targetId || null,
        metadata: params.metadata ? (params.metadata as object) : undefined,
        ip,
      },
    })
  } catch (error) {
    console.error('Failed to write platform audit log:', error)
  }
}

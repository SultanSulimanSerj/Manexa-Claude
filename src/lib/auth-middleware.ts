import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from './auth-api'
import { prisma } from './prisma'
import { UserRole, hasPermission, hasAllPermissions, hasAnyPermission, canAccessProject, isPlatformRole } from './permissions'
import { getCompanyAccessStatus } from './subscription-guard'

export const COMPANY_SUSPENDED_ERROR = 'COMPANY_SUSPENDED'

// Интерфейс для контекста пользователя
export interface UserContext {
  id: string
  email: string
  role: UserRole
  companyId: string
  projectRole?: string
  isProjectOwner?: boolean
}

// Функция для получения контекста пользователя
export async function getUserContext(request: NextRequest): Promise<UserContext | null> {
  try {
    const user = await authenticateUser(request)
    if (!user) return null

    return {
      id: user.id,
      email: user.email,
      role: (user.role || 'USER') as UserRole, // По умолчанию USER
      companyId: user.companyId!
    }
  } catch (error) {
    console.error('Error getting user context:', error)
    return null
  }
}

// Функция для получения контекста пользователя с ролью в проекте
export async function getUserProjectContext(
  request: NextRequest, 
  projectId: string
): Promise<UserContext | null> {
  try {
    const user = await authenticateUser(request)
    if (!user) return null

    // Получаем роль пользователя в проекте
    const projectMember = await prisma.projectUser.findFirst({
      where: {
        projectId,
        userId: user.id
      },
      include: {
        project: true
      }
    })

    const isProjectOwner = projectMember?.project?.creatorId === user.id
    const projectRole = projectMember?.role

    return {
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      companyId: user.companyId!,
      projectRole,
      isProjectOwner
    }
  } catch (error) {
    console.error('Error getting user project context:', error)
    return null
  }
}

// Основная функция проверки прав
export async function checkPermission(
  request: NextRequest,
  permission: keyof import('./permissions').Permissions,
  projectId?: string
): Promise<{ allowed: boolean; user: UserContext | null; error?: string }> {
  try {
    const user = projectId 
      ? await getUserProjectContext(request, projectId)
      : await getUserContext(request)
    
    if (!user) {
      return { allowed: false, user: null, error: 'Пользователь не аутентифицирован' }
    }

    // Платформенные роли не работают с API компаний (изоляция уровней)
    if (isPlatformRole(user.role)) {
      return { allowed: false, user, error: 'Недостаточно прав для выполнения операции' }
    }

    // Блокировка компании (архив или приостановленная подписка)
    if (user.companyId) {
      const access = await getCompanyAccessStatus(user.companyId)
      if (access.blocked) {
        return { allowed: false, user, error: COMPANY_SUSPENDED_ERROR }
      }
    }

    const hasAccess = hasPermission(user.role, permission, user.projectRole as any)
    
    if (!hasAccess) {
      return { 
        allowed: false, 
        user, 
        error: 'Недостаточно прав для выполнения операции' 
      }
    }

    return { allowed: true, user }
  } catch (error) {
    console.error('Error checking permission:', error)
    return { 
      allowed: false, 
      user: null, 
      error: 'Ошибка при проверке прав доступа' 
    }
  }
}

// Функция для проверки множественных прав (все должны быть true)
export async function checkAllPermissions(
  request: NextRequest,
  permissions: (keyof import('./permissions').Permissions)[],
  projectId?: string
): Promise<{ allowed: boolean; user: UserContext | null; error?: string }> {
  try {
    const user = projectId 
      ? await getUserProjectContext(request, projectId)
      : await getUserContext(request)
    
    if (!user) {
      return { allowed: false, user: null, error: 'Пользователь не аутентифицирован' }
    }

    const hasAccess = hasAllPermissions(user.role, permissions, user.projectRole as any)
    
    if (!hasAccess) {
      return { 
        allowed: false, 
        user, 
        error: 'Недостаточно прав для выполнения операции' 
      }
    }

    return { allowed: true, user }
  } catch (error) {
    console.error('Error checking permissions:', error)
    return { 
      allowed: false, 
      user: null, 
      error: 'Ошибка при проверке прав доступа' 
    }
  }
}

// Функция для проверки множественных прав (хотя бы одно должно быть true)
export async function checkAnyPermission(
  request: NextRequest,
  permissions: (keyof import('./permissions').Permissions)[],
  projectId?: string
): Promise<{ allowed: boolean; user: UserContext | null; error?: string }> {
  try {
    const user = projectId 
      ? await getUserProjectContext(request, projectId)
      : await getUserContext(request)
    
    if (!user) {
      return { allowed: false, user: null, error: 'Пользователь не аутентифицирован' }
    }

    const hasAccess = hasAnyPermission(user.role, permissions, user.projectRole as any)
    
    if (!hasAccess) {
      return { 
        allowed: false, 
        user, 
        error: 'Недостаточно прав для выполнения операции' 
      }
    }

    return { allowed: true, user }
  } catch (error) {
    console.error('Error checking permissions:', error)
    return { 
      allowed: false, 
      user: null, 
      error: 'Ошибка при проверке прав доступа' 
    }
  }
}

// Функция для проверки доступа к проекту
export async function checkProjectAccess(
  request: NextRequest,
  projectId: string
): Promise<{ allowed: boolean; user: UserContext | null; error?: string }> {
  try {
    const user = await getUserProjectContext(request, projectId)
    
    if (!user) {
      return { allowed: false, user: null, error: 'Пользователь не аутентифицирован' }
    }

    const hasAccess = canAccessProject(
      user.role, 
      user.projectRole as any, 
      user.isProjectOwner
    )
    
    if (!hasAccess) {
      return { 
        allowed: false, 
        user, 
        error: 'Нет доступа к проекту' 
      }
    }

    return { allowed: true, user }
  } catch (error) {
    console.error('Error checking project access:', error)
    return { 
      allowed: false, 
      user: null, 
      error: 'Ошибка при проверке доступа к проекту' 
    }
  }
}

// Функция для проверки роли
export async function checkRole(
  request: NextRequest,
  allowedRoles: UserRole[]
): Promise<{ allowed: boolean; user: UserContext | null; error?: string }> {
  try {
    const user = await getUserContext(request)
    
    if (!user) {
      return { allowed: false, user: null, error: 'Пользователь не аутентифицирован' }
    }

    const hasAccess = allowedRoles.includes(user.role)
    
    if (!hasAccess) {
      return { 
        allowed: false, 
        user, 
        error: 'Недостаточно прав для выполнения операции' 
      }
    }

    return { allowed: true, user }
  } catch (error) {
    console.error('Error checking role:', error)
    return { 
      allowed: false, 
      user: null, 
      error: 'Ошибка при проверке роли' 
    }
  }
}

// Декоратор для API routes
export function withPermission(
  permission: keyof import('./permissions').Permissions,
  projectId?: string
) {
  return function (handler: (request: NextRequest, context: { user: UserContext }) => Promise<NextResponse>) {
    return async function (request: NextRequest) {
      const { allowed, user, error } = await checkPermission(request, permission, projectId)
      
      if (!allowed || !user) {
        return NextResponse.json({ error: error || 'Недостаточно прав' }, { status: 403 })
      }
      
      return handler(request, { user })
    }
  }
}

// Декоратор для проверки роли
export function withRole(allowedRoles: UserRole[]) {
  return function (handler: (request: NextRequest, context: { user: UserContext }) => Promise<NextResponse>) {
    return async function (request: NextRequest) {
      const { allowed, user, error } = await checkRole(request, allowedRoles)
      
      if (!allowed || !user) {
        return NextResponse.json({ error: error || 'Недостаточно прав' }, { status: 403 })
      }
      
      return handler(request, { user })
    }
  }
}

// Функция для фильтрации данных по правам
export function filterDataByPermissions<T extends { creatorId?: string; userId?: string }>(
  data: T[],
  user: UserContext,
  permission: keyof import('./permissions').Permissions
): T[] {
  // OWNER и ADMIN видят все данные
  if (user.role === UserRole.OWNER || user.role === UserRole.ADMIN) {
    return data
  }
  
  // MANAGER видит данные своих проектов
  if (user.role === UserRole.MANAGER) {
    // Здесь можно добавить логику фильтрации по проектам
    return data
  }
  
  // USER видит только свои данные
  if (user.role === UserRole.USER) {
    return data.filter(item => 
      item.creatorId === user.id || item.userId === user.id
    )
  }
  
  return []
}

// Вспомогательная функция для проверки доступа пользователя к проекту
export async function canUserAccessProject(
  userId: string,
  projectId: string,
  companyId: string,
  userRole: UserRole
): Promise<boolean> {
  try {
    // OWNER и ADMIN видят все проекты своей компании
    if (userRole === UserRole.OWNER || userRole === UserRole.ADMIN) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, companyId }
      })
      return !!project
    }

    // Для остальных проверяем, является ли пользователь создателем или участником
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        companyId,
        OR: [
          { creatorId: userId },
          { users: { some: { userId } } }
        ]
      }
    })

    return !!project
  } catch (error) {
    console.error('Error checking project access:', error)
    return false
  }
}

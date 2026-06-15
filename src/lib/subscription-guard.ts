import { prisma } from './prisma'

export type CompanyBlockReason = 'COMPANY_ARCHIVED' | 'SUBSCRIPTION_SUSPENDED' | null

interface AccessStatus {
  blocked: boolean
  reason: CompanyBlockReason
}

const cache = new Map<string, { status: AccessStatus; expiresAt: number }>()
const CACHE_TTL_MS = 60_000

/**
 * Доступ компании к системе.
 * Блокировка: компания в архиве (isActive=false) или подписка SUSPENDED.
 * Компании без записи Subscription (созданные до внедрения биллинга) не блокируются.
 */
export async function getCompanyAccessStatus(companyId: string): Promise<AccessStatus> {
  const cached = cache.get(companyId)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.status
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      isActive: true,
      subscription: { select: { status: true } },
    },
  })

  let status: AccessStatus = { blocked: false, reason: null }
  if (!company || company.isActive === false) {
    status = { blocked: true, reason: 'COMPANY_ARCHIVED' }
  } else if (company.subscription?.status === 'SUSPENDED') {
    status = { blocked: true, reason: 'SUBSCRIPTION_SUSPENDED' }
  }

  cache.set(companyId, { status, expiresAt: Date.now() + CACHE_TTL_MS })
  return status
}

/** Сброс кэша (после ручной блокировки/разблокировки из панели). */
export function invalidateCompanyAccessCache(companyId?: string) {
  if (companyId) {
    cache.delete(companyId)
  } else {
    cache.clear()
  }
}

/**
 * Проверка лимита тарифа перед созданием сущности.
 * Компании без подписки (созданные до биллинга) — без лимитов.
 */
export async function checkPlanLimit(
  companyId: string,
  resource: 'users' | 'projects'
): Promise<{ allowed: boolean; limit?: number; current?: number }> {
  const subscription = await prisma.subscription.findUnique({
    where: { companyId },
    select: { plan: { select: { maxUsers: true, maxProjects: true } } },
  })
  if (!subscription) return { allowed: true }

  const limit = resource === 'users' ? subscription.plan.maxUsers : subscription.plan.maxProjects
  if (limit === null || limit === undefined) return { allowed: true }

  const current =
    resource === 'users'
      ? await prisma.user.count({ where: { companyId, isActive: true } })
      : await prisma.project.count({ where: { companyId } })

  return { allowed: current < limit, limit, current }
}

export const PLAN_LIMIT_MESSAGES: Record<'users' | 'projects', string> = {
  users: 'Достигнут лимит пользователей по вашему тарифу. Обратитесь к менеджеру Manexa для повышения тарифа.',
  projects: 'Достигнут лимит проектов по вашему тарифу. Обратитесь к менеджеру Manexa для повышения тарифа.',
}

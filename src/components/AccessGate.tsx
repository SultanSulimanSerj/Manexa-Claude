'use client'

import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { usePathname, useRouter } from 'next/navigation'
import { Eye } from 'lucide-react'

const PLATFORM_ROLES = ['PLATFORM_ADMIN', 'PLATFORM_MANAGER']
// Страницы, доступные без проверок
const EXEMPT_PREFIXES = ['/auth', '/suspended', '/api']

/**
 * Клиентский гейт доступа:
 * - mustChangePassword → принудительная смена пароля
 * - платформенные роли → всегда в /platform
 * - заблокированная компания → /suspended
 */
export function AccessGate({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const [companyBlocked, setCompanyBlocked] = useState(false)

  const role = (session?.user as any)?.role as string | undefined
  const mustChangePassword = Boolean((session?.user as any)?.mustChangePassword)
  const totpEnabled = Boolean((session?.user as any)?.totpEnabled)
  const impersonatedBy = (session?.user as any)?.impersonatedBy as string | null
  const isPlatform = role ? PLATFORM_ROLES.includes(role) : false
  const exempt = EXEMPT_PREFIXES.some((p) => pathname?.startsWith(p))

  // Проверка блокировки компании (для обычных пользователей)
  useEffect(() => {
    if (status !== 'authenticated' || isPlatform || !session?.user) return
    let cancelled = false
    fetch('/api/subscription/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setCompanyBlocked(Boolean(data.blocked))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [status, isPlatform, session?.user, pathname])

  useEffect(() => {
    if (status !== 'authenticated' || !pathname) return

    // Принудительная смена пароля — приоритетнее всего
    if (mustChangePassword && pathname !== '/auth/change-password') {
      router.replace('/auth/change-password')
      return
    }

    // Платформенные роли живут только в /platform
    if (isPlatform && !pathname.startsWith('/platform') && !pathname.startsWith('/auth')) {
      router.replace('/platform')
      return
    }

    // 2FA обязательна для платформенных ролей
    if (isPlatform && !totpEnabled && pathname.startsWith('/platform') && pathname !== '/platform/setup-2fa') {
      router.replace('/platform/setup-2fa')
      return
    }

    // Обычный пользователь не должен попасть в /platform (страница сама отдаст 404, но подстрахуем)
    if (!isPlatform && pathname.startsWith('/platform')) {
      router.replace('/')
      return
    }

    if (companyBlocked && !exempt) {
      router.replace('/suspended')
    }
  }, [status, pathname, mustChangePassword, isPlatform, totpEnabled, companyBlocked, exempt, router])

  return (
    <>
      {impersonatedBy && (
        <div className="sticky top-0 z-[60] flex items-center justify-center gap-3 bg-purple-700 px-4 py-1.5 text-sm text-white">
          <Eye className="h-4 w-4" />
          <span>
            Режим поддержки: вы вошли как <strong>{session?.user?.name || session?.user?.email}</strong>.
            Действия выполняются от имени пользователя.
          </span>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="rounded border border-white/40 px-2 py-0.5 text-xs hover:bg-white/10"
          >
            Завершить сессию
          </button>
        </div>
      )}
      {children}
    </>
  )
}

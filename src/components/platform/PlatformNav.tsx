'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { Clock, LogOut } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/platform', label: 'Дашборд', exact: true },
  { href: '/platform/companies', label: 'Компании' },
  { href: '/platform/billing', label: 'Тарифы' },
  { href: '/platform/payments', label: 'Платежи' },
  { href: '/platform/announcements', label: 'Анонсы' },
  { href: '/platform/users', label: 'Пользователи' },
  { href: '/platform/audit', label: 'Аудит' },
]

function useSessionCountdown(endsAt?: number) {
  const [left, setLeft] = useState<number>(() => (endsAt ? endsAt - Date.now() : 0))
  useEffect(() => {
    if (!endsAt) return
    const t = setInterval(() => setLeft(endsAt - Date.now()), 30_000)
    setLeft(endsAt - Date.now())
    return () => clearInterval(t)
  }, [endsAt])
  if (!endsAt || left <= 0) return null
  const totalMin = Math.floor(left / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`
}

export function PlatformNav({
  userName,
  role,
  sessionEndsAt,
}: {
  userName: string
  role: string
  sessionEndsAt?: number
}) {
  const pathname = usePathname()
  const timeLeft = useSessionCountdown(sessionEndsAt)

  return (
    <header className="sticky top-0 z-30 bg-[#1e1e24]">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-5 px-4">
        {/* Лого + маркер контекста */}
        <Link href="/platform" className="flex shrink-0 items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-700 text-sm font-bold text-white">M</span>
          <span className="text-sm font-semibold text-white">Manexa</span>
          <span className="rounded-full border border-indigo-700 px-2 py-0.5 text-[11px] font-medium text-indigo-300">
            Платформа
          </span>
        </Link>

        {/* Табы */}
        <nav className="flex items-center gap-0.5 overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const active = item.exact ? pathname === item.href : pathname?.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  active
                    ? 'bg-white/[.14] text-white'
                    : 'text-neutral-400 hover:bg-white/[.08] hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          {timeLeft && (
            <span
              className="hidden items-center gap-1.5 rounded-lg bg-white/[.08] px-2.5 py-1.5 text-[12px] font-medium text-neutral-300 sm:inline-flex"
              title="До конца сессии администратора"
            >
              <Clock className="h-3.5 w-3.5" />
              Сессия · {timeLeft}
            </span>
          )}
          <div className="hidden text-right md:block">
            <p className="text-[13px] font-medium leading-tight text-white">{userName}</p>
            <p className="text-[11px] text-neutral-400">
              {role === 'PLATFORM_ADMIN' ? 'Администратор' : 'Менеджер'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-white/[.08] hover:text-white"
            title="Выйти"
            aria-label="Выйти"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}

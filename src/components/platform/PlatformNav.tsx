'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Building2, LayoutDashboard, CreditCard, Users, ScrollText, LogOut } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/platform', label: 'Дашборд', icon: LayoutDashboard, exact: true },
  { href: '/platform/companies', label: 'Компании', icon: Building2 },
  { href: '/platform/billing', label: 'Подписки', icon: CreditCard },
  { href: '/platform/users', label: 'Пользователи', icon: Users },
  { href: '/platform/audit', label: 'Аудит', icon: ScrollText },
]

export function PlatformNav({ userName, role }: { userName: string; role: string }) {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
        <Link href="/platform" className="flex items-center gap-2">
          <span className="rounded bg-indigo-600 px-2 py-0.5 text-sm font-bold text-white">M</span>
          <span className="text-sm font-bold text-gray-900">
            Manexa <span className="font-normal text-indigo-600">Платформа</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname?.startsWith(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${
                  active
                    ? 'bg-indigo-50 font-medium text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{userName}</p>
            <p className="text-xs text-gray-500">
              {role === 'PLATFORM_ADMIN' ? 'Администратор платформы' : 'Менеджер платформы'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50"
            title="Выйти"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}

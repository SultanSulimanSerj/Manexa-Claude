'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Home,
  FolderOpen,
  FileText,
  DollarSign,
  CheckCircle,
  MessageSquare,
  File,
  Flag,
  Package,
  BarChart3,
  Users,
  Settings,
  Menu,
  X,
  LogOut,
  Search,
  Plus,
} from 'lucide-react'
import { UserRole, getAvailableNavigationSections } from '@/lib/permissions'
import Notifications from '@/components/notifications'
import { GlobalSearch } from '@/components/global-search'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { signOut } from 'next-auth/react'

interface NavigationItem {
  name: string
  href: string
  icon: any
  permission?: string
}

interface NavigationGroup {
  title: string
  items: NavigationItem[]
}

// Группировка меню по смыслу (дизайн-хендофф: 4 секции)
const NAV_GROUPS: NavigationGroup[] = [
  {
    title: 'Работа',
    items: [
      { name: 'Главная', href: '/', icon: Home },
      { name: 'Проекты', href: '/projects', icon: FolderOpen },
      { name: 'Задачи', href: '/tasks', icon: Flag, permission: 'canViewAllTasks' },
      { name: 'Согласования', href: '/approvals', icon: CheckCircle },
      { name: 'Чат', href: '/chat', icon: MessageSquare },
    ],
  },
  {
    title: 'Финансы',
    items: [
      { name: 'Финансы', href: '/finance', icon: DollarSign, permission: 'canViewFinances' },
      { name: 'Материалы', href: '/materials', icon: Package, permission: 'canViewFinances' },
      { name: 'Отчеты', href: '/reports', icon: BarChart3, permission: 'canViewReports' },
    ],
  },
  {
    title: 'Документы',
    items: [
      { name: 'Документы', href: '/documents', icon: FileText },
      { name: 'Шаблоны', href: '/templates', icon: File, permission: 'canManageProjectMembers' },
    ],
  },
  {
    title: 'Администрирование',
    items: [
      { name: 'Пользователи', href: '/users', icon: Users, permission: 'canManageUsers' },
      { name: 'Настройки', href: '/settings', icon: Settings },
    ],
  },
]

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false)
  const [userRole, setUserRole] = useState<UserRole>(UserRole.USER)
  const [userInfo, setUserInfo] = useState<{ name: string; email: string } | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [pendingApprovals, setPendingApprovals] = useState(0)
  const pathname = usePathname()
  const router = useRouter()

  // Получаем информацию о пользователе
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await fetch('/api/users/me')
        if (response.ok) {
          const data = await response.json()
          setUserInfo({ name: data.name, email: data.email })
          setUserRole(data.role || UserRole.USER)
        } else {
          console.error('Failed to fetch user info, status:', response.status)
          setUserInfo({ name: 'Пользователь', email: 'user@example.com' })
        }
      } catch (error) {
        console.error('Failed to fetch user info:', error)
        setUserInfo({ name: 'Пользователь', email: 'user@example.com' })
      }
    }

    fetchUserInfo()
  }, [])

  // Счётчик ожидающих согласований (лёгкий запрос: только total)
  useEffect(() => {
    fetch('/api/approvals?status=PENDING&limit=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setPendingApprovals(d?.pagination?.total || 0))
      .catch(() => {})
  }, [pathname])

  // Хоткей ⌘K / Ctrl+K — глобальный поиск
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Фильтруем навигацию по правам доступа
  const availableSections = getAvailableNavigationSections(userRole)
  const canSee = (item: NavigationItem) => {
    if (!item.permission) return true
    const sectionName = item.href.replace('/', '') || 'dashboard'
    return availableSections.includes(sectionName)
  }
  const visibleGroups = NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter(canSee) }))
    .filter((g) => g.items.length > 0)

  const canCreateProjects = userRole === UserRole.OWNER || userRole === UserRole.ADMIN || userRole === UserRole.MANAGER

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/auth/signin' })
  }

  return (
    <>
      {/* Топ-бар: глобальный поиск + быстрое создание + уведомления */}
      <div className="lg:pl-64 fixed top-0 right-0 left-0 h-16 bg-white border-b border-neutral-200 z-30 flex items-center gap-3 pl-16 pr-4 lg:px-6">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="flex w-full max-w-[420px] items-center gap-2.5 rounded-lg border border-neutral-200 bg-neutral-100 px-3 py-2 text-left transition-colors hover:bg-neutral-50"
          aria-label="Глобальный поиск"
        >
          <Search className="h-[15px] w-[15px] shrink-0 text-neutral-400" />
          <span className="hidden sm:block flex-1 truncate text-[13.5px] text-neutral-400">
            Поиск по проектам, задачам, документам…
          </span>
          <kbd className="hidden sm:inline-flex shrink-0 items-center rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-neutral-500">
            ⌘K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-neutral-700"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Создать</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canCreateProjects && (
                <DropdownMenuItem onClick={() => router.push('/projects?create=1')}>
                  <FolderOpen className="h-4 w-4 text-neutral-400" />
                  Проект
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => router.push('/tasks?create=1')}>
                <Flag className="h-4 w-4 text-neutral-400" />
                Задача
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/documents/new')}>
                <FileText className="h-4 w-4 text-neutral-400" />
                Документ
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Notifications />
        </div>
      </div>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-3.5 left-3 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="bg-white/80 backdrop-blur-sm"
          aria-label={isOpen ? 'Закрыть меню' : 'Открыть меню'}
          aria-expanded={isOpen}
        >
          {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Сайдбар */}
      <nav className={`
        fixed top-0 left-0 h-full w-64 bg-white border-r border-neutral-200 z-40 transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto px-4 pt-6">
            <div className="mb-6 px-2">
              <Image
                src="/manexa-logo.png"
                alt="Manexa"
                width={120}
                height={0}
                style={{ height: 'auto' }}
                className="mb-1.5"
                priority
              />
              <p className="text-xs text-neutral-500">Управление проектами</p>
            </div>

            {visibleGroups.map((group, gi) => (
              <div key={group.title}>
                <p className={`px-2.5 pb-1 text-[10.5px] font-semibold uppercase tracking-[.08em] text-neutral-400 ${gi === 0 ? 'pt-1' : 'pt-4'}`}>
                  {group.title}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive =
                      item.href === '/'
                        ? pathname === '/'
                        : pathname === item.href || pathname.startsWith(`${item.href}/`)
                    const badge = item.href === '/approvals' && pendingApprovals > 0 ? pendingApprovals : null
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className={`
                          flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] transition-colors
                          ${isActive
                            ? 'bg-neutral-200/60 font-semibold text-neutral-900 shadow-[inset_3px_0_0_theme(colors.neutral.900)]'
                            : 'font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                          }
                        `}
                      >
                        <item.icon className={`h-[17px] w-[17px] shrink-0 ${isActive ? 'text-neutral-900' : 'text-neutral-400'}`} />
                        <span className="flex-1 truncate">{item.name}</span>
                        {badge !== null && (
                          <span className="rounded-full bg-blue-50 px-[7px] py-px text-[11px] font-semibold text-blue-700">
                            {badge}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
            <div className="h-4" />
          </div>

          {/* Профиль внизу */}
          <div className="mt-auto border-t border-neutral-200">
            {userInfo && (
              <div className="p-4">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-neutral-900">
                    <span className="text-sm font-medium text-white">
                      {userInfo.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">{userInfo.name}</p>
                    <p className="truncate text-xs text-neutral-500">{userInfo.email}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                >
                  <LogOut className="h-4 w-4" />
                  Выйти
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
    </>
  )
}

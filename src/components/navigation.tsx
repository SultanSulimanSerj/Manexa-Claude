'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
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
  BarChart3,
  Users,
  Settings,
  Menu,
  X,
  LogOut
} from 'lucide-react'
import { UserRole, getAvailableNavigationSections } from '@/lib/permissions'
import Notifications from '@/components/notifications'
import { signOut } from 'next-auth/react'

interface NavigationItem {
  name: string
  href: string
  icon: any
  permission?: string
  roles?: UserRole[]
}

const navigation: NavigationItem[] = [
  { name: 'Главная', href: '/', icon: Home },
  { name: 'Проекты', href: '/projects', icon: FolderOpen },
  { name: 'Задачи', href: '/tasks', icon: Flag },
  { name: 'Документы', href: '/documents', icon: FileText },
  { name: 'Финансы', href: '/finance', icon: DollarSign },
  { name: 'Согласования', href: '/approvals', icon: CheckCircle },
  { name: 'Чат', href: '/chat', icon: MessageSquare },
  { name: 'Шаблоны', href: '/templates', icon: File },
  { 
    name: 'Отчеты', 
    href: '/reports', 
    icon: BarChart3,
    permission: 'canViewReports'
  },
  { 
    name: 'Пользователи', 
    href: '/users', 
    icon: Users,
    permission: 'canManageUsers'
  },
  { 
    name: 'Настройки', 
    href: '/settings', 
    icon: Settings
    // Убрали permission - теперь доступно всем
  },
]

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false)
  const [userRole, setUserRole] = useState<UserRole>(UserRole.USER)
  const [userInfo, setUserInfo] = useState<{ name: string; email: string } | null>(null)
  const pathname = usePathname()

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
          // Если API не работает, показываем заглушку
          console.error('Failed to fetch user info, status:', response.status)
          setUserInfo({ name: 'Пользователь', email: 'user@example.com' })
        }
      } catch (error) {
        console.error('Failed to fetch user info:', error)
        // Показываем заглушку при ошибке
        setUserInfo({ name: 'Пользователь', email: 'user@example.com' })
      }
    }

    fetchUserInfo()
  }, [])

  // Фильтруем навигацию по правам доступа
  const availableSections = getAvailableNavigationSections(userRole)
  const filteredNavigation = navigation.filter(item => {
    // Если нет ограничений по правам, показываем всем
    if (!item.permission) return true
    
    // Проверяем доступность раздела
    const sectionName = item.href.replace('/', '') || 'dashboard'
    return availableSections.includes(sectionName)
  })

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/auth/signin' })
  }

  return (
    <>
      {/* Top bar with notifications */}
      <div className="lg:pl-64 fixed top-0 right-0 left-0 h-16 bg-white border-b border-gray-200 z-30 flex items-center justify-end px-6">
        <Notifications />
      </div>

      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="bg-white/80 backdrop-blur-sm"
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

      {/* Navigation */}
      <nav className={`
        fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-40 transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <div className="flex flex-col h-full">
          <div className="p-6">
            <div className="mb-8">
              <Image 
                src="/manexa-logo.png" 
                alt="Manexa" 
                width={120}
                height={0}
                style={{ height: 'auto' }}
                className="mb-2"
                priority
              />
              <p className="text-sm text-gray-600">Управление проектами</p>
            </div>

            <div className="space-y-2">
              {filteredNavigation.map((item) => {
                // Раздел активен и на вложенных страницах (например /projects/[id]),
                // но «Главная» — только на точном «/».
                const isActive =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname === item.href || pathname.startsWith(`${item.href}/`)
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                      ${isActive 
                        ? 'bg-blue-50 text-blue-600' 
                        : 'text-gray-700 hover:bg-gray-50'
                      }
                    `}
                  >
                    <item.icon className={`h-5 w-5 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
                    <span className="text-sm font-medium">{item.name}</span>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* User Profile at Bottom */}
          <div className="mt-auto border-t border-gray-200">
            {userInfo && (
              <div className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 font-medium text-sm">
                      {userInfo.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{userInfo.name}</p>
                    <p className="text-xs text-gray-600 truncate">{userInfo.email}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
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

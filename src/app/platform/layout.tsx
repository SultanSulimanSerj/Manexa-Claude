import { getServerSession } from 'next-auth'
import { notFound, redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { PLATFORM_SESSION_MAX_AGE_SEC } from '@/lib/platform-auth'
import { PlatformNav } from '@/components/platform/PlatformNav'

const PLATFORM_ROLES = ['PLATFORM_ADMIN', 'PLATFORM_MANAGER']

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as { role?: string } | undefined)?.role

  // Для всех, кроме платформенных ролей, раздела не существует
  if (!role || !PLATFORM_ROLES.includes(role)) {
    notFound()
  }

  // Платформенная сессия живёт ограниченно — если истекла, сразу на вход
  const loginAt = (session?.user as { loginAt?: number } | undefined)?.loginAt
  if (!loginAt || Date.now() - loginAt > PLATFORM_SESSION_MAX_AGE_SEC * 1000) {
    redirect('/auth/signin?expired=1')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PlatformNav
        userName={(session!.user as { name?: string }).name || ''}
        role={role}
      />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  )
}

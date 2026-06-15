'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Search, Plus, KeyRound, UserX, UserCheck } from 'lucide-react'

interface FoundUser {
  id: string
  name: string | null
  email: string
  role: string
  isActive: boolean
  createdAt: string
  company: { id: string; name: string; isActive: boolean } | null
}

interface Manager {
  id: string
  name: string | null
  email: string
  role: string
  isActive: boolean
  totpEnabled: boolean
  createdAt: string
}

const ROLE_LABELS: Record<string, string> = {
  PLATFORM_ADMIN: 'Админ платформы',
  PLATFORM_MANAGER: 'Менеджер платформы',
  OWNER: 'Директор',
  ADMIN: 'Администратор',
  MANAGER: 'Менеджер',
  USER: 'Сотрудник',
}

export default function PlatformUsersPage() {
  const { data: session } = useSession()
  const isAdmin = (session?.user as any)?.role === 'PLATFORM_ADMIN'

  const [search, setSearch] = useState('')
  const [results, setResults] = useState<FoundUser[]>([])
  const [searching, setSearching] = useState(false)
  const [managers, setManagers] = useState<Manager[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', email: '', role: 'PLATFORM_MANAGER' })
  const [tempPassword, setTempPassword] = useState<{ email: string; password: string } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const fetchManagers = () => {
    fetch('/api/platform/users?managers=1')
      .then((res) => (res.ok ? res.json() : { users: [] }))
      .then((data) => setManagers(data.users || []))
      .catch(() => {})
  }

  useEffect(fetchManagers, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const doSearch = async () => {
    if (search.trim().length < 3) {
      setToast('Минимум 3 символа')
      return
    }
    setSearching(true)
    try {
      const res = await fetch(`/api/platform/users?search=${encodeURIComponent(search.trim())}`)
      const data = await res.json()
      setResults(data.users || [])
    } finally {
      setSearching(false)
    }
  }

  const createManager = async () => {
    const res = await fetch('/api/platform/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createForm),
    })
    const data = await res.json()
    if (!res.ok) {
      setToast(data.error || 'Ошибка')
      return
    }
    setTempPassword({ email: data.user.email, password: data.tempPassword })
    setShowCreateForm(false)
    setCreateForm({ name: '', email: '', role: 'PLATFORM_MANAGER' })
    fetchManagers()
  }

  const managerAction = async (userId: string, action: string, email: string) => {
    const texts: Record<string, string> = {
      deactivate: `Отозвать доступ у ${email}?`,
      activate: `Восстановить доступ для ${email}?`,
      'reset-password': `Сбросить пароль и 2FA для ${email}?`,
    }
    if (!confirm(texts[action])) return
    const res = await fetch('/api/platform/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action }),
    })
    const data = await res.json()
    if (!res.ok) {
      setToast(data.error || 'Ошибка')
      return
    }
    if (data.tempPassword) {
      setTempPassword({ email, password: data.tempPassword })
    } else {
      setToast('Готово')
    }
    fetchManagers()
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed right-4 top-16 z-50 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      <h1 className="text-xl font-bold text-gray-900">Пользователи</h1>

      {tempPassword && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-medium text-gray-900">
            Временный пароль для {tempPassword.email}:{' '}
            <span className="font-mono font-bold">{tempPassword.password}</span>
          </p>
          <p className="mt-1 text-xs text-amber-700">Показывается один раз.</p>
        </div>
      )}

      {/* Сквозной поиск */}
      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Поиск пользователя (поддержка)</h2>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doSearch()}
              placeholder="Email или имя (минимум 3 символа)…"
              className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={doSearch}
            disabled={searching}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {searching ? 'Поиск…' : 'Найти'}
          </button>
        </div>

        {results.length > 0 && (
          <table className="mt-3 w-full text-sm">
            <tbody>
              {results.map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="py-2.5 pr-4">
                    <p className="font-medium text-gray-900">{u.name || '—'}</p>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </td>
                  <td className="py-2.5 pr-4 text-gray-600">{ROLE_LABELS[u.role] || u.role}</td>
                  <td className="py-2.5 pr-4">
                    {u.company ? (
                      <Link
                        href={`/platform/companies/${u.company.id}`}
                        className="text-indigo-600 hover:underline"
                      >
                        {u.company.name}
                      </Link>
                    ) : (
                      <span className="text-gray-400">Платформа</span>
                    )}
                  </td>
                  <td className="py-2.5">
                    {u.isActive ? (
                      <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">Активен</span>
                    ) : (
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Деактивирован</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Платформенные менеджеры */}
      <div className="rounded-xl border bg-white">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Команда платформы ({managers.length})</h2>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowCreateForm((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50"
            >
              <Plus className="h-4 w-4" />
              Добавить менеджера
            </button>
          )}
        </div>

        {showCreateForm && (
          <div className="space-y-2 border-b bg-gray-50 p-4">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <input
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="Имя"
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <input
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="Email"
                type="email"
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                <option value="PLATFORM_MANAGER">Менеджер платформы</option>
                <option value="PLATFORM_ADMIN">Админ платформы</option>
              </select>
            </div>
            <button
              type="button"
              onClick={createManager}
              disabled={!createForm.name || !createForm.email}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Создать (временный пароль будет показан)
            </button>
          </div>
        )}

        <table className="w-full text-sm">
          <tbody>
            {managers.map((m) => (
              <tr key={m.id} className="border-b last:border-0">
                <td className="px-4 py-2.5">
                  <p className="font-medium text-gray-900">{m.name || '—'}</p>
                  <p className="text-xs text-gray-500">{m.email}</p>
                </td>
                <td className="px-4 py-2.5 text-gray-600">{ROLE_LABELS[m.role]}</td>
                <td className="px-4 py-2.5">
                  {m.totpEnabled ? (
                    <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">2FA вкл.</span>
                  ) : (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">2FA нет</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {m.isActive ? (
                    <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">Активен</span>
                  ) : (
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Отключён</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {isAdmin && (
                    <div className="inline-flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => managerAction(m.id, 'reset-password', m.email)}
                        title="Сбросить пароль и 2FA"
                        className="rounded border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-50"
                      >
                        <KeyRound className="h-4 w-4" />
                      </button>
                      {m.isActive ? (
                        <button
                          type="button"
                          onClick={() => managerAction(m.id, 'deactivate', m.email)}
                          title="Отозвать доступ"
                          className="rounded border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                        >
                          <UserX className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => managerAction(m.id, 'activate', m.email)}
                          title="Восстановить доступ"
                          className="rounded border border-green-200 p-1.5 text-green-600 hover:bg-green-50"
                        >
                          <UserCheck className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { KeyRound } from 'lucide-react'

export default function ChangePasswordPage() {
  const { data: session, update } = useSession()
  const router = useRouter()
  const mustChange = Boolean((session?.user as any)?.mustChangePassword)
  const isPlatform = ['PLATFORM_ADMIN', 'PLATFORM_MANAGER'].includes(
    ((session?.user as any)?.role as string) || ''
  )

  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (form.newPassword !== form.confirm) {
      setError('Пароли не совпадают')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Не удалось сменить пароль')
        return
      }
      // Обновляем сессию, чтобы снять флаг mustChangePassword из токена
      await update()
      router.replace(isPlatform ? '/platform' : '/')
    } catch {
      setError('Ошибка запроса')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-xl border bg-white p-8 shadow-sm">
        <div className="text-center">
          <KeyRound className="mx-auto h-10 w-10 text-indigo-500" />
          <h1 className="mt-3 text-xl font-bold text-gray-900">Смена пароля</h1>
          {mustChange && (
            <p className="mt-1 text-sm text-amber-600">
              Вам выдан временный пароль — для продолжения работы установите свой.
            </p>
          )}
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm">
            <span className="text-gray-600">{mustChange ? 'Временный пароль' : 'Текущий пароль'}</span>
            <input
              type="password"
              value={form.currentPassword}
              onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
              required
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">Новый пароль (мин. 8 символов, буквы и цифры)</span>
            <input
              type="password"
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              required
              minLength={8}
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">Повторите новый пароль</span>
            <input
              type="password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              required
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? 'Сохранение…' : 'Сменить пароль'}
          </button>

          {!mustChange && (
            <button
              type="button"
              onClick={() => router.back()}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Отмена
            </button>
          )}
          {mustChange && (
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/auth/signin' })}
              className="w-full text-center text-xs text-gray-500 hover:text-gray-700"
            >
              Выйти из аккаунта
            </button>
          )}
        </form>
      </div>
    </div>
  )
}

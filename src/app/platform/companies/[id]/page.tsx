'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useSession, signIn } from 'next-auth/react'
import { ArrowLeft, Archive, ArchiveRestore, KeyRound, UserX, UserCheck, Eye } from 'lucide-react'

interface CompanyDetail {
  id: string
  name: string
  legalName: string | null
  inn: string | null
  kpp: string | null
  ogrn: string | null
  legalAddress: string | null
  directorName: string | null
  contactPhone: string | null
  contactEmail: string | null
  isActive: boolean
  createdAt: string
  subscription: {
    id: string
    status: string
    currentPeriodStart: string
    currentPeriodEnd: string
    plan: { id: string; code: string; name: string; priceMonthly: string }
    payments: {
      id: string
      amount: string
      paidAt: string
      comment: string | null
      invoiceNumber: string | null
    }[]
  } | null
  users: {
    id: string
    name: string | null
    email: string
    role: string
    position: string | null
    isActive: boolean
  }[]
  _count: { projects: number; documents: number; tasks: number; estimates: number; finances: number }
}

const SUB_STATUS: Record<string, { label: string; className: string }> = {
  TRIAL: { label: 'Триал', className: 'bg-blue-100 text-blue-800' },
  ACTIVE: { label: 'Активна', className: 'bg-green-100 text-green-800' },
  PAST_DUE: { label: 'Просрочена', className: 'bg-amber-100 text-amber-800' },
  SUSPENDED: { label: 'Заблокирована', className: 'bg-red-100 text-red-800' },
  CANCELED: { label: 'Отменена', className: 'bg-gray-100 text-gray-600' },
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Директор',
  ADMIN: 'Администратор',
  MANAGER: 'Менеджер',
  USER: 'Сотрудник',
}

export default function PlatformCompanyPage() {
  const params = useParams<{ id: string }>()
  const companyId = params.id
  const { data: session } = useSession()
  const canImpersonate = (session?.user as any)?.role === 'PLATFORM_ADMIN'
  const [company, setCompany] = useState<CompanyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [tempPassword, setTempPassword] = useState<{ email: string; password: string } | null>(null)
  const [paymentForm, setPaymentForm] = useState({ months: '1', amount: '', invoiceNumber: '', comment: '' })
  const [plans, setPlans] = useState<{ code: string; name: string; priceMonthly: string }[]>([])
  const [busy, setBusy] = useState(false)

  const fetchCompany = useCallback(() => {
    fetch(`/api/platform/companies/${companyId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Компания не найдена'))))
      .then((data) => setCompany(data.company))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [companyId])

  useEffect(() => {
    fetchCompany()
    fetch('/api/platform/plans')
      .then((res) => (res.ok ? res.json() : { plans: [] }))
      .then((data) => setPlans((data.plans || []).filter((p: any) => p.isActive)))
      .catch(() => {})
  }, [fetchCompany])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const subscriptionAction = async (body: Record<string, unknown>, confirmText?: string) => {
    if (!company?.subscription) return
    if (confirmText && !confirm(confirmText)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/platform/subscriptions/${company.subscription.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setToast(data.error || 'Ошибка')
        return
      }
      setToast('Готово')
      fetchCompany()
    } finally {
      setBusy(false)
    }
  }

  const archiveAction = async (action: 'archive' | 'unarchive') => {
    const text =
      action === 'archive'
        ? `Архивировать «${company?.name}»? Все пользователи компании потеряют доступ, данные сохранятся.`
        : `Восстановить «${company?.name}» из архива?`
    if (!confirm(text)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/platform/companies/${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        setToast(action === 'archive' ? 'Компания в архиве' : 'Компания восстановлена')
        fetchCompany()
      }
    } finally {
      setBusy(false)
    }
  }

  const userAction = async (userId: string, action: string, email: string) => {
    const confirmTexts: Record<string, string> = {
      'reset-password': `Сбросить пароль для ${email}? Будет выдан временный пароль с обязательной сменой.`,
      deactivate: `Деактивировать ${email}? Пользователь потеряет доступ.`,
      activate: `Активировать ${email}?`,
    }
    if (!confirm(confirmTexts[action])) return
    setBusy(true)
    try {
      const res = await fetch(`/api/platform/companies/${companyId}/users`, {
        method: 'POST',
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
      fetchCompany()
    } finally {
      setBusy(false)
    }
  }

  const impersonate = async (userId: string, email: string) => {
    if (
      !confirm(
        `Войти как ${email}? Ваша текущая сессия платформы будет заменена сессией пользователя (действие записывается в аудит).`
      )
    )
      return
    setBusy(true)
    try {
      const res = await fetch('/api/platform/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setToast(data.error || 'Ошибка')
        return
      }
      const result = await signIn('credentials', {
        email: '__impersonation__',
        password: data.token,
        redirect: false,
      })
      if (result?.error) {
        setToast('Не удалось войти от имени пользователя')
        return
      }
      window.location.href = '/'
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Загрузка…</p>
  if (error || !company) return <p className="text-sm text-red-600">{error || 'Не найдено'}</p>

  const sub = company.subscription
  const badge = sub ? SUB_STATUS[sub.status] : null

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed right-4 top-16 z-50 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      <Link
        href="/platform/companies"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Компании
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">{company.name}</h1>
          {!company.isActive && (
            <span className="rounded bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">Архив</span>
          )}
          {badge && company.isActive && (
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${badge.className}`}>{badge.label}</span>
          )}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => archiveAction(company.isActive ? 'archive' : 'unarchive')}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm ${
            company.isActive
              ? 'border-red-300 text-red-700 hover:bg-red-50'
              : 'border-green-300 text-green-700 hover:bg-green-50'
          }`}
        >
          {company.isActive ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
          {company.isActive ? 'Архивировать' : 'Восстановить'}
        </button>
      </div>

      {/* Временный пароль (одноразовый показ) */}
      {tempPassword && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-medium text-gray-900">
            Временный пароль для {tempPassword.email}:{' '}
            <span className="font-mono font-bold">{tempPassword.password}</span>
          </p>
          <p className="mt-1 text-xs text-amber-700">
            Показывается один раз — передайте пользователю. При входе потребуется смена пароля.
          </p>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(
                `Email: ${tempPassword.email}\nВременный пароль: ${tempPassword.password}`
              )
              setToast('Скопировано')
            }}
            className="mt-2 rounded border border-amber-400 px-3 py-1 text-xs text-amber-800 hover:bg-amber-100"
          >
            Скопировать
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Реквизиты */}
        <div className="rounded-xl border bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Реквизиты</h2>
          <dl className="space-y-1.5 text-sm">
            {[
              ['Юр. название', company.legalName],
              ['ИНН', company.inn],
              ['КПП', company.kpp],
              ['ОГРН', company.ogrn],
              ['Юр. адрес', company.legalAddress],
              ['Директор', company.directorName],
              ['Телефон', company.contactPhone],
              ['Email', company.contactEmail],
            ].map(([label, value]) => (
              <div key={label as string} className="flex justify-between gap-2">
                <dt className="shrink-0 text-gray-500">{label}</dt>
                <dd className="text-right text-gray-900">{value || '—'}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-2 border-t pt-1.5">
              <dt className="text-gray-500">Создана</dt>
              <dd className="text-gray-900">{new Date(company.createdAt).toLocaleDateString('ru-RU')}</dd>
            </div>
          </dl>
        </div>

        {/* Подписка */}
        <div className="rounded-xl border bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Подписка</h2>
          {!sub ? (
            <p className="text-sm text-gray-500">Без подписки (компания создана до внедрения биллинга)</p>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Тариф</span>
                <select
                  value={sub.plan.code}
                  disabled={busy}
                  onChange={(e) =>
                    subscriptionAction(
                      { action: 'change-plan', planCode: e.target.value },
                      `Сменить тариф на ${e.target.value}?`
                    )
                  }
                  className="rounded border px-2 py-0.5 text-sm"
                >
                  {plans.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Период до</span>
                <span className="font-medium text-gray-900">
                  {new Date(sub.currentPeriodEnd).toLocaleDateString('ru-RU')}
                </span>
              </div>

              <div className="space-y-2 rounded-lg bg-gray-50 p-3">
                <p className="text-xs font-medium text-gray-700">Зафиксировать оплату</p>
                <div className="flex gap-2">
                  <select
                    value={paymentForm.months}
                    onChange={(e) => setPaymentForm({ ...paymentForm, months: e.target.value })}
                    className="rounded border px-2 py-1 text-sm"
                  >
                    {[1, 3, 6, 12].map((m) => (
                      <option key={m} value={m}>
                        {m} мес.
                      </option>
                    ))}
                  </select>
                  <input
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    placeholder={`${Number(sub.plan.priceMonthly) * Number(paymentForm.months)} ₽`}
                    className="w-full rounded border px-2 py-1 text-sm"
                  />
                </div>
                <input
                  value={paymentForm.invoiceNumber}
                  onChange={(e) => setPaymentForm({ ...paymentForm, invoiceNumber: e.target.value })}
                  placeholder="Номер счёта (опционально)"
                  className="w-full rounded border px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    subscriptionAction(
                      {
                        action: 'payment',
                        months: paymentForm.months,
                        ...(paymentForm.amount && { amount: paymentForm.amount }),
                        ...(paymentForm.invoiceNumber && { invoiceNumber: paymentForm.invoiceNumber }),
                      },
                      `Зафиксировать оплату и продлить на ${paymentForm.months} мес.?`
                    )
                  }
                  className="w-full rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Оплачено — продлить
                </button>
              </div>

              {sub.status !== 'SUSPENDED' ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    subscriptionAction(
                      { action: 'suspend' },
                      'Заблокировать доступ компании? Пользователи увидят страницу блокировки.'
                    )
                  }
                  className="w-full rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                >
                  Заблокировать доступ
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => subscriptionAction({ action: 'activate' }, 'Разблокировать доступ компании?')}
                  className="w-full rounded-lg border border-green-300 px-3 py-1.5 text-sm text-green-700 hover:bg-green-50"
                >
                  Разблокировать доступ
                </button>
              )}

              {sub.payments.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-gray-700">Последние платежи</p>
                  <ul className="space-y-1 text-xs text-gray-600">
                    {sub.payments.slice(0, 5).map((p) => (
                      <li key={p.id} className="flex justify-between">
                        <span>{new Date(p.paidAt).toLocaleDateString('ru-RU')}</span>
                        <span className="font-medium">{Number(p.amount).toLocaleString('ru-RU')} ₽</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Использование */}
        <div className="rounded-xl border bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Использование</h2>
          <dl className="space-y-1.5 text-sm">
            {[
              ['Пользователи', company.users.length],
              ['Проекты', company._count.projects],
              ['Документы', company._count.documents],
              ['Задачи', company._count.tasks],
              ['Сметы', company._count.estimates],
              ['Финансовые записи', company._count.finances],
            ].map(([label, value]) => (
              <div key={label as string} className="flex justify-between">
                <dt className="text-gray-500">{label}</dt>
                <dd className="font-medium text-gray-900">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Пользователи */}
      <div className="rounded-xl border bg-white">
        <h2 className="border-b px-4 py-3 text-sm font-semibold text-gray-900">
          Пользователи ({company.users.length})
        </h2>
        <table className="w-full text-sm">
          <tbody>
            {company.users.map((u) => (
              <tr key={u.id} className="border-b last:border-0">
                <td className="px-4 py-2.5">
                  <p className="font-medium text-gray-900">{u.name || '—'}</p>
                  <p className="text-xs text-gray-500">{u.email}</p>
                </td>
                <td className="px-4 py-2.5 text-gray-600">{ROLE_LABELS[u.role] || u.role}</td>
                <td className="px-4 py-2.5">
                  {u.isActive ? (
                    <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">Активен</span>
                  ) : (
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Деактивирован</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="inline-flex gap-1.5">
                    {canImpersonate && u.isActive && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => impersonate(u.id, u.email)}
                        title="Войти как пользователь"
                        className="rounded border border-purple-300 p-1.5 text-purple-600 hover:bg-purple-50"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => userAction(u.id, 'reset-password', u.email)}
                      title="Сбросить пароль"
                      className="rounded border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-50"
                    >
                      <KeyRound className="h-4 w-4" />
                    </button>
                    {u.role !== 'OWNER' &&
                      (u.isActive ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => userAction(u.id, 'deactivate', u.email)}
                          title="Деактивировать"
                          className="rounded border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                        >
                          <UserX className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => userAction(u.id, 'activate', u.email)}
                          title="Активировать"
                          className="rounded border border-green-200 p-1.5 text-green-600 hover:bg-green-50"
                        >
                          <UserCheck className="h-4 w-4" />
                        </button>
                      ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

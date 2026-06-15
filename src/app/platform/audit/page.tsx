'use client'

import { useEffect, useState } from 'react'

interface AuditEntry {
  id: string
  actorEmail: string | null
  action: string
  targetType: string | null
  targetId: string | null
  metadata: Record<string, unknown> | null
  ip: string | null
  createdAt: string
}

const ACTION_LABELS: Record<string, string> = {
  COMPANY_CREATE: 'Создание компании',
  COMPANY_UPDATE: 'Изменение компании',
  COMPANY_ARCHIVE: 'Архивирование компании',
  COMPANY_UNARCHIVE: 'Восстановление компании',
  PASSWORD_RESET: 'Сброс пароля',
  USER_ACTIVATE: 'Активация пользователя',
  USER_DEACTIVATE: 'Деактивация пользователя',
  SUBSCRIPTION_PAYMENT: 'Фиксация оплаты',
  SUBSCRIPTION_PLAN_CHANGE: 'Смена тарифа',
  SUBSCRIPTION_SUSPEND: 'Блокировка подписки',
  SUBSCRIPTION_ACTIVATE: 'Разблокировка подписки',
  PLAN_UPSERT: 'Изменение тарифа',
  PLATFORM_MANAGER_CREATE: 'Создание менеджера платформы',
  PLATFORM_MANAGER_ACTIVATE: 'Восстановление менеджера',
  PLATFORM_MANAGER_DEACTIVATE: 'Отзыв доступа менеджера',
  PLATFORM_MANAGER_PASSWORD_RESET: 'Сброс пароля менеджера',
  IMPERSONATE_START: 'Вход от имени пользователя',
}

export default function PlatformAuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [actionFilter, setActionFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: '50' })
    if (actionFilter) params.set('action', actionFilter)
    setLoading(true)
    fetch(`/api/platform/audit?${params}`)
      .then((res) => (res.ok ? res.json() : { entries: [], pagination: { pages: 1 } }))
      .then((data) => {
        setEntries(data.entries || [])
        setPages(data.pagination?.pages || 1)
      })
      .finally(() => setLoading(false))
  }, [page, actionFilter])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">Журнал аудита</h1>
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value)
            setPage(1)
          }}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">Все действия</option>
          {Object.entries(ACTION_LABELS).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Загрузка…</p>
      ) : entries.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-white p-8 text-center text-sm text-gray-500">
          Записей нет
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                <th className="px-4 py-3">Когда</th>
                <th className="px-4 py-3">Кто</th>
                <th className="px-4 py-3">Действие</th>
                <th className="px-4 py-3">Детали</th>
                <th className="px-4 py-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">
                    {new Date(e.createdAt).toLocaleString('ru-RU')}
                  </td>
                  <td className="px-4 py-2.5 text-gray-900">{e.actorEmail || e.id}</td>
                  <td className="px-4 py-2.5">
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {ACTION_LABELS[e.action] || e.action}
                    </span>
                  </td>
                  <td className="max-w-md px-4 py-2.5 text-xs text-gray-500">
                    {e.metadata ? JSON.stringify(e.metadata) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-400">{e.ip || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded border px-3 py-1 disabled:opacity-40"
          >
            Назад
          </button>
          <span className="text-gray-600">
            {page} / {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border px-3 py-1 disabled:opacity-40"
          >
            Вперёд
          </button>
        </div>
      )}
    </div>
  )
}

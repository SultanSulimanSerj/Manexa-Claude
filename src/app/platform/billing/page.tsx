'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface SubRow {
  id: string
  status: string
  currentPeriodEnd: string
  company: { id: string; name: string; inn: string | null; isActive: boolean }
  plan: { code: string; name: string; priceMonthly: string }
  payments: { paidAt: string; amount: string }[]
}

interface PlanRow {
  id: string
  code: string
  name: string
  priceMonthly: string
  maxUsers: number | null
  maxProjects: number | null
  maxStorageMb: number | null
  isActive: boolean
  _count: { subscriptions: number }
}

const STATUS: Record<string, { label: string; className: string }> = {
  TRIAL: { label: 'Триал', className: 'bg-blue-100 text-blue-800' },
  ACTIVE: { label: 'Активна', className: 'bg-green-100 text-green-800' },
  PAST_DUE: { label: 'Просрочена', className: 'bg-amber-100 text-amber-800' },
  SUSPENDED: { label: 'Заблокирована', className: 'bg-red-100 text-red-800' },
  CANCELED: { label: 'Отменена', className: 'bg-gray-100 text-gray-600' },
}

export default function PlatformBillingPage() {
  const [subscriptions, setSubscriptions] = useState<SubRow[]>([])
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = statusFilter ? `?status=${statusFilter}` : ''
    setLoading(true)
    Promise.all([
      fetch(`/api/platform/subscriptions${params}`).then((res) => (res.ok ? res.json() : { subscriptions: [] })),
      fetch('/api/platform/plans').then((res) => (res.ok ? res.json() : { plans: [] })),
    ])
      .then(([subs, pl]) => {
        setSubscriptions(subs.subscriptions || [])
        setPlans(pl.plans || [])
      })
      .finally(() => setLoading(false))
  }, [statusFilter])

  const now = Date.now()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">Подписки</h1>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">Все статусы</option>
          <option value="TRIAL">Триал</option>
          <option value="ACTIVE">Активные</option>
          <option value="PAST_DUE">Просроченные</option>
          <option value="SUSPENDED">Заблокированные</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Загрузка…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                <th className="px-4 py-3">Компания</th>
                <th className="px-4 py-3">Тариф</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Период до</th>
                <th className="px-4 py-3">Последний платёж</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((s) => {
                const badge = STATUS[s.status]
                const expired = new Date(s.currentPeriodEnd).getTime() < now
                return (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/platform/companies/${s.company.id}`}
                        className="font-medium text-indigo-600 hover:underline"
                      >
                        {s.company.name}
                      </Link>
                      {s.company.inn && <p className="text-xs text-gray-400">ИНН {s.company.inn}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {s.plan.name} · {Number(s.plan.priceMonthly).toLocaleString('ru-RU')} ₽/мес
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${badge?.className}`}>
                        {badge?.label}
                      </span>
                    </td>
                    <td className={`px-4 py-3 ${expired ? 'font-medium text-red-600' : 'text-gray-600'}`}>
                      {new Date(s.currentPeriodEnd).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {s.payments[0]
                        ? `${new Date(s.payments[0].paidAt).toLocaleDateString('ru-RU')} · ${Number(
                            s.payments[0].amount
                          ).toLocaleString('ru-RU')} ₽`
                        : '—'}
                    </td>
                  </tr>
                )
              })}
              {subscriptions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Подписок нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-bold text-gray-900">Тарифы</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => (
            <div key={p.id} className={`rounded-xl border bg-white p-4 ${!p.isActive ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">{p.name}</h3>
                <span className="text-xs text-gray-400">{p.code}</span>
              </div>
              <p className="mt-1 text-xl font-bold text-gray-900">
                {Number(p.priceMonthly).toLocaleString('ru-RU')} ₽
                <span className="text-sm font-normal text-gray-500">/мес</span>
              </p>
              <ul className="mt-2 space-y-1 text-xs text-gray-600">
                <li>Пользователей: {p.maxUsers ?? 'безлимит'}</li>
                <li>Проектов: {p.maxProjects ?? 'безлимит'}</li>
                <li>
                  Хранилище: {p.maxStorageMb ? `${Math.round(p.maxStorageMb / 1024)} ГБ` : 'безлимит'}
                </li>
              </ul>
              <p className="mt-2 text-xs text-gray-400">Подписок: {p._count.subscriptions}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Изменение тарифов — через API `/api/platform/plans` или скрипт `npm run platform:seed-plans`.
        </p>
      </div>
    </div>
  )
}

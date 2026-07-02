'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, Users, CreditCard, AlertTriangle } from 'lucide-react'

interface SubLite {
  id: string
  companyId: string
  companyName: string
  planName: string
  currentPeriodEnd: string
  status: string
}

interface Stats {
  companies: { total: number; active: number; archived: number; newLast30Days: number }
  subscriptions: { trial: number; active: number; pastDue: number; suspended: number }
  users: { total: number; active: number }
  payments: { last30DaysAmount: string; last30DaysCount: number }
  expiringSoon: SubLite[]
  overdue: SubLite[]
}

interface Metrics {
  mrr: string
  arr: string
  arpu: string
  payingCompanies: number
  conversion: { rate: number; paid: number; total: number }
  churn: { rate: number; count: number }
  months: { label: string; newCompanies: number; paymentsSum: string; paymentsCount: number }[]
}

export default function PlatformDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)

  useEffect(() => {
    fetch('/api/platform/stats')
      .then(async (res) => {
        if (res.ok) return res.json()
        if ([401, 403, 404].includes(res.status)) {
          setSessionExpired(true)
          throw new Error('expired')
        }
        throw new Error('Ошибка загрузки')
      })
      .then(setStats)
      .catch((err) => {
        if (err.message !== 'expired') setError(err.message)
      })
    fetch('/api/platform/metrics')
      .then((res) => (res.ok ? res.json() : null))
      .then(setMetrics)
      .catch(() => {})
  }, [])

  if (sessionExpired) {
    return (
      <div className="rounded-xl border bg-white p-6 text-center">
        <p className="text-sm text-gray-700">Сессия администратора истекла (лимит 4 часа для панели платформы).</p>
        <a
          href="/auth/signin"
          className="mt-3 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Войти заново
        </a>
      </div>
    )
  }
  if (error) {
    return <p className="text-sm text-red-600">{error}</p>
  }
  if (!stats) {
    return <p className="text-sm text-gray-500">Загрузка…</p>
  }

  const needAttention = stats.subscriptions.pastDue + stats.subscriptions.suspended

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Дашборд платформы</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/platform/companies" className="rounded-xl border bg-white p-4 hover:shadow-md">
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 text-indigo-500" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.companies.active}</p>
              <p className="text-sm text-gray-500">Активных компаний</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Всего: {stats.companies.total}, новых за месяц: {stats.companies.newLast30Days}
          </p>
        </Link>

        <Link href="/platform/users" className="rounded-xl border bg-white p-4 hover:shadow-md">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.users.active}</p>
              <p className="text-sm text-gray-500">Активных пользователей</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-400">Всего: {stats.users.total}</p>
        </Link>

        <Link href="/platform/billing" className="rounded-xl border bg-white p-4 hover:shadow-md">
          <div className="flex items-center gap-3">
            <CreditCard className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {Number(stats.payments.last30DaysAmount).toLocaleString('ru-RU')} ₽
              </p>
              <p className="text-sm text-gray-500">Оплат за 30 дней</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-400">Платежей: {stats.payments.last30DaysCount}</p>
        </Link>

        <Link
          href="/platform/billing"
          className={`rounded-xl border p-4 hover:shadow-md ${
            needAttention > 0 ? 'border-amber-300 bg-amber-50' : 'bg-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle
              className={`h-8 w-8 ${needAttention > 0 ? 'text-amber-500' : 'text-gray-300'}`}
            />
            <div>
              <p className="text-2xl font-bold text-gray-900">{needAttention}</p>
              <p className="text-sm text-gray-500">Требуют внимания</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Просрочено: {stats.subscriptions.pastDue}, заблокировано: {stats.subscriptions.suspended}
          </p>
        </Link>
      </div>

      {/* Бизнес-метрики (числами) */}
      {metrics && (
        <div className="rounded-xl border bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Метрики</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <p className="text-xs text-gray-500">MRR</p>
              <p className="text-xl font-bold text-gray-900">{Number(metrics.mrr).toLocaleString('ru-RU')} ₽</p>
              <p className="text-xs text-gray-400">в месяц</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">ARR</p>
              <p className="text-xl font-bold text-gray-900">{Number(metrics.arr).toLocaleString('ru-RU')} ₽</p>
              <p className="text-xs text-gray-400">в год</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">ARPU</p>
              <p className="text-xl font-bold text-gray-900">{Number(metrics.arpu).toLocaleString('ru-RU')} ₽</p>
              <p className="text-xs text-gray-400">на компанию/мес</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Платящих компаний</p>
              <p className="text-xl font-bold text-gray-900">{metrics.payingCompanies}</p>
              <p className="text-xs text-gray-400">активные подписки</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Конверсия в платные</p>
              <p className="text-xl font-bold text-gray-900">{metrics.conversion.rate}%</p>
              <p className="text-xs text-gray-400">{metrics.conversion.paid} из {metrics.conversion.total}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Отток за 30 дней</p>
              <p className="text-xl font-bold text-gray-900">{metrics.churn.rate}%</p>
              <p className="text-xs text-gray-400">{metrics.churn.count} компаний</p>
            </div>
          </div>

          {/* Помесячная динамика */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-gray-500">
                  <th className="py-2 pr-4">Месяц</th>
                  <th className="py-2 pr-4 text-right">Новых компаний</th>
                  <th className="py-2 pr-4 text-right">Платежей</th>
                  <th className="py-2 text-right">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {metrics.months.map((m) => (
                  <tr key={m.label} className="border-b last:border-0">
                    <td className="py-2 pr-4 capitalize text-gray-700">{m.label}</td>
                    <td className="py-2 pr-4 text-right text-gray-600">{m.newCompanies}</td>
                    <td className="py-2 pr-4 text-right text-gray-600">{m.paymentsCount}</td>
                    <td className="py-2 text-right font-medium text-gray-900">
                      {Number(m.paymentsSum).toLocaleString('ru-RU')} ₽
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Истекают в ближайшие 7 дней */}
        <div className="rounded-xl border bg-white">
          <h2 className="border-b px-4 py-3 text-sm font-semibold text-gray-900">
            Истекают в ближайшие 7 дней ({stats.expiringSoon.length})
          </h2>
          {stats.expiringSoon.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">Нет</p>
          ) : (
            <ul className="divide-y">
              {stats.expiringSoon.map((s) => (
                <li key={s.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <Link href={`/platform/companies/${s.companyId}`} className="font-medium text-indigo-600 hover:underline">
                    {s.companyName}
                  </Link>
                  <span className="text-gray-500">
                    {s.planName} · до {new Date(s.currentPeriodEnd).toLocaleDateString('ru-RU')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Просрочены / заблокированы */}
        <div className="rounded-xl border bg-white">
          <h2 className="border-b px-4 py-3 text-sm font-semibold text-gray-900">
            Просрочены и заблокированы ({stats.overdue.length})
          </h2>
          {stats.overdue.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">Нет</p>
          ) : (
            <ul className="divide-y">
              {stats.overdue.map((s) => (
                <li key={s.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <Link href={`/platform/companies/${s.companyId}`} className="font-medium text-indigo-600 hover:underline">
                    {s.companyName}
                  </Link>
                  <span className="font-medium text-red-600">
                    {new Date(s.currentPeriodEnd).toLocaleDateString('ru-RU')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Подписки по статусам</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-center">
          <div className="rounded-lg bg-blue-50 p-3">
            <p className="text-xl font-bold text-blue-700">{stats.subscriptions.trial}</p>
            <p className="text-xs text-blue-600">Триал</p>
          </div>
          <div className="rounded-lg bg-green-50 p-3">
            <p className="text-xl font-bold text-green-700">{stats.subscriptions.active}</p>
            <p className="text-xs text-green-600">Активны</p>
          </div>
          <div className="rounded-lg bg-amber-50 p-3">
            <p className="text-xl font-bold text-amber-700">{stats.subscriptions.pastDue}</p>
            <p className="text-xs text-amber-600">Просрочены</p>
          </div>
          <div className="rounded-lg bg-red-50 p-3">
            <p className="text-xl font-bold text-red-700">{stats.subscriptions.suspended}</p>
            <p className="text-xs text-red-600">Заблокированы</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Link
          href="/platform/companies/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Завести компанию
        </Link>
        <Link
          href="/platform/audit"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Журнал аудита
        </Link>
      </div>
    </div>
  )
}

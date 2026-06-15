'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, Users, CreditCard, AlertTriangle } from 'lucide-react'

interface Stats {
  companies: { total: number; active: number; archived: number; newLast30Days: number }
  subscriptions: { trial: number; active: number; pastDue: number; suspended: number }
  users: { total: number; active: number }
  payments: { last30DaysAmount: string; last30DaysCount: number }
}

export default function PlatformDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/platform/stats')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Ошибка загрузки'))))
      .then(setStats)
      .catch((err) => setError(err.message))
  }, [])

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

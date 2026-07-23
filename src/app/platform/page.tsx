'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight } from 'lucide-react'

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

const rub = (v: string | number) => `${new Intl.NumberFormat('ru-RU').format(Math.round(Number(v)))} ₽`
const short = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)} млн` : new Intl.NumberFormat('ru-RU').format(Math.round(v)))

function relDays(iso: string) {
  const d = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000)
  if (d < 0) return { text: `просрочено ${Math.abs(d)} дн.`, tone: 'red' as const }
  if (d === 0) return { text: 'истекает сегодня', tone: 'amber' as const }
  if (d <= 7) return { text: `через ${d} дн.`, tone: 'amber' as const }
  return { text: `через ${d} дн.`, tone: 'gray' as const }
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
        <p className="text-sm text-neutral-700">Сессия администратора истекла.</p>
        <a href="/auth/signin" className="mt-3 inline-block rounded-lg bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800">
          Войти заново
        </a>
      </div>
    )
  }
  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!stats) return <p className="text-sm text-neutral-500">Загрузка…</p>

  const needAttention = stats.subscriptions.pastDue + stats.subscriptions.suspended
  const maxPay = Math.max(1, ...(metrics?.months.map((m) => Number(m.paymentsSum)) || [1]))

  const kpi = metrics
    ? [
        { label: 'MRR', value: rub(metrics.mrr), hint: `${metrics.payingCompanies} платящих` },
        { label: 'ARR', value: rub(metrics.arr), hint: 'в год' },
        { label: 'ARPU', value: rub(metrics.arpu), hint: 'на компанию' },
        { label: 'Конверсия', value: `${metrics.conversion.rate}%`, hint: `${metrics.conversion.paid} из ${metrics.conversion.total}` },
        { label: 'Отток 30 дн.', value: `${metrics.churn.rate}%`, hint: `${metrics.churn.count} компаний` },
      ]
    : []

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-neutral-900">Дашборд платформы</h1>
      </div>

      {/* Алерт дня */}
      {needAttention > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
            <p className="text-sm font-medium text-amber-900">
              {needAttention} {needAttention === 1 ? 'подписка требует' : 'подписок требуют'} действий
              <span className="font-normal text-amber-700"> · просрочено {stats.subscriptions.pastDue}, заблокировано {stats.subscriptions.suspended}</span>
            </p>
          </div>
          <Link
            href="/platform/billing"
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
          >
            Разобраться <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* KPI-ряд */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpi.map((k) => (
          <div key={k.label} className="rounded-xl border border-neutral-200 bg-white p-4">
            <p className="text-[12px] font-medium text-neutral-400">{k.label}</p>
            <p className="mt-1 text-[26px] font-bold leading-none tabular-nums text-neutral-900">{k.value}</p>
            <p className="mt-1.5 text-[12px] text-neutral-400">{k.hint}</p>
          </div>
        ))}
      </div>

      {/* Списки с действиями */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white">
          <h2 className="border-b border-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-900">
            Истекают в 7 дней <span className="text-neutral-400">({stats.expiringSoon.length})</span>
          </h2>
          {stats.expiringSoon.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-neutral-400">Нет</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {stats.expiringSoon.map((s) => {
                const r = relDays(s.currentPeriodEnd)
                return (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/platform/companies/${s.companyId}`} className="block truncate text-sm font-medium text-neutral-900 hover:underline">
                        {s.companyName}
                      </Link>
                      <p className="text-[12px] text-neutral-400">
                        {s.planName} · <span className={r.tone === 'amber' ? 'text-amber-700' : ''}>{r.text}</span>
                      </p>
                    </div>
                    <Link
                      href={`/platform/companies/${s.companyId}`}
                      className="shrink-0 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[13px] font-medium text-indigo-700 hover:bg-indigo-100"
                    >
                      Продлить
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white">
          <h2 className="border-b border-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-900">
            Просрочены и заблокированы <span className="text-neutral-400">({stats.overdue.length})</span>
          </h2>
          {stats.overdue.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-neutral-400">Нет</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {stats.overdue.map((s) => {
                const r = relDays(s.currentPeriodEnd)
                return (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/platform/companies/${s.companyId}`} className="block truncate text-sm font-medium text-neutral-900 hover:underline">
                        {s.companyName}
                      </Link>
                      <p className="text-[12px] font-medium text-red-600">{r.text}</p>
                    </div>
                    <Link
                      href={`/platform/companies/${s.companyId}`}
                      className="shrink-0 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-[13px] font-medium text-green-700 hover:bg-green-100"
                    >
                      Разблокировать
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Платежи по месяцам + статусы подписок */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-neutral-900">Платежи по месяцам</h2>
          {metrics && (
            <>
              <div className="flex h-[160px] items-end gap-3">
                {metrics.months.map((m, i) => {
                  const isCurrent = i === metrics.months.length - 1
                  const isPrev = i === metrics.months.length - 2
                  const h = Math.round((Number(m.paymentsSum) / maxPay) * 140)
                  const color = isCurrent ? 'bg-indigo-700' : isPrev ? 'bg-indigo-400' : 'bg-indigo-200'
                  return (
                    <div key={m.label} className="flex flex-1 flex-col items-center gap-2">
                      <div
                        className={`w-full rounded-t-md ${color}`}
                        style={{ height: `${Math.max(4, h)}px` }}
                        title={rub(m.paymentsSum)}
                      />
                      <span className="text-[11px] capitalize text-neutral-400">{m.label}</span>
                    </div>
                  )
                })}
              </div>
              <div className="mt-3 border-t border-neutral-100 pt-3 text-sm text-neutral-500">
                Текущий месяц:{' '}
                <span className="font-semibold text-neutral-900">{rub(metrics.months.at(-1)?.paymentsSum || 0)}</span>
                {' · '}
                {metrics.months.at(-1)?.paymentsCount || 0} платежей
              </div>
            </>
          )}
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-neutral-900">Подписки по статусам</h2>
          <ul className="space-y-2.5">
            {[
              { label: 'Триал', n: stats.subscriptions.trial, dot: 'bg-blue-500' },
              { label: 'Активны', n: stats.subscriptions.active, dot: 'bg-green-500' },
              { label: 'Просрочены', n: stats.subscriptions.pastDue, dot: 'bg-amber-500' },
              { label: 'Заблокированы', n: stats.subscriptions.suspended, dot: 'bg-red-500' },
            ].map((row) => (
              <li key={row.label} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-neutral-600">
                  <span className={`h-2.5 w-2.5 rounded-full ${row.dot}`} />
                  {row.label}
                </span>
                <span className="font-semibold tabular-nums text-neutral-900">{row.n}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Счётчики */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link href="/platform/companies" className="rounded-xl border border-neutral-200 bg-white p-4 hover:border-neutral-300">
          <p className="text-[12px] font-medium text-neutral-400">Активных компаний</p>
          <p className="mt-1 flex items-center gap-2">
            <span className="text-2xl font-bold tabular-nums text-neutral-900">{stats.companies.active}</span>
            {stats.companies.newLast30Days > 0 && (
              <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                +{stats.companies.newLast30Days} за мес.
              </span>
            )}
          </p>
          <p className="mt-1 text-[12px] text-neutral-400">всего {stats.companies.total}</p>
        </Link>
        <Link href="/platform/users" className="rounded-xl border border-neutral-200 bg-white p-4 hover:border-neutral-300">
          <p className="text-[12px] font-medium text-neutral-400">Активных пользователей</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-neutral-900">{stats.users.active}</p>
          <p className="mt-1 text-[12px] text-neutral-400">всего {stats.users.total}</p>
        </Link>
        <Link href="/platform/payments" className="rounded-xl border border-neutral-200 bg-white p-4 hover:border-neutral-300">
          <p className="text-[12px] font-medium text-neutral-400">Оплат за 30 дней</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-neutral-900">{short(Number(stats.payments.last30DaysAmount))} ₽</p>
          <p className="mt-1 text-[12px] text-neutral-400">{stats.payments.last30DaysCount} платежей</p>
        </Link>
      </div>
    </div>
  )
}

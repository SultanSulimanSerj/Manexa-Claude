'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Search, MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'

interface CompanyRow {
  id: string
  name: string
  legalName: string | null
  inn: string | null
  isActive: boolean
  createdAt: string
  subscription: {
    status: string
    currentPeriodEnd: string
    plan: { code: string; name: string }
  } | null
  _count: { users: number; projects: number; documents: number }
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  TRIAL: { label: 'Триал', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  ACTIVE: { label: 'Активна', className: 'bg-green-50 text-green-700 border-green-200' },
  PAST_DUE: { label: 'Просрочена', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  SUSPENDED: { label: 'Заблокирована', className: 'bg-red-50 text-red-700 border-red-200' },
  CANCELED: { label: 'Отменена', className: 'bg-neutral-100 text-neutral-600 border-neutral-200' },
}

const SEGMENTS = [
  { v: '', label: 'Все' },
  { v: 'active', label: 'Активные' },
  { v: 'trial', label: 'Триал' },
  { v: 'past_due', label: 'Просроченные' },
  { v: 'archived', label: 'Архив' },
]

function periodHint(iso: string) {
  const d = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000)
  const date = new Date(iso).toLocaleDateString('ru-RU')
  if (d < 0) return { date, note: `${Math.abs(d)} дн. назад`, tone: 'text-red-600' }
  if (d <= 7) return { date, note: `через ${d} дн.`, tone: 'text-amber-700' }
  return { date, note: '', tone: 'text-neutral-500' }
}

export default function PlatformCompaniesPage() {
  const router = useRouter()
  const [companies, setCompanies] = useState<CompanyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [totals, setTotals] = useState<{ total: number; active: number } | null>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Подзаголовок: всего / активных (из stats)
  useEffect(() => {
    fetch('/api/platform/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setTotals({ total: d.companies.total, active: d.companies.active }))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => {
      setLoading(true)
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (statusFilter) params.set('status', statusFilter)
      fetch(`/api/platform/companies?${params}`)
        .then((res) => (res.ok ? res.json() : { companies: [] }))
        .then((data) => setCompanies(data.companies || []))
        .finally(() => setLoading(false))
    }, 300)
    return () => {
      if (debounce.current) clearTimeout(debounce.current)
    }
  }, [search, statusFilter])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Компании</h1>
          {totals && (
            <p className="text-sm text-neutral-500">
              {totals.total} всего · {totals.active} активных
            </p>
          )}
        </div>
        <Link
          href="/platform/companies/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800"
        >
          <Plus className="h-4 w-4" />
          Завести компанию
        </Link>
      </div>

      {/* Сегмент-контрол + поиск */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg bg-neutral-200/60 p-1">
          {SEGMENTS.map((s) => (
            <button
              key={s.v}
              type="button"
              onClick={() => setStatusFilter(s.v)}
              className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                statusFilter === s.v ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Название, юр. название или ИНН…"
            className="w-full rounded-lg border border-neutral-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500">Загрузка…</p>
      ) : companies.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-white p-8 text-center text-sm text-neutral-500">
          Компании не найдены
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 text-left text-[11.5px] font-semibold uppercase tracking-wide text-neutral-400">
                <th className="px-4 py-2.5">Компания</th>
                <th className="px-4 py-2.5">Тариф</th>
                <th className="px-4 py-2.5">Статус</th>
                <th className="px-4 py-2.5">Период до</th>
                <th className="px-4 py-2.5 text-right">Польз.</th>
                <th className="px-4 py-2.5 text-right">Проектов</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => {
                const badge = c.isActive
                  ? c.subscription
                    ? STATUS_BADGES[c.subscription.status]
                    : { label: 'Без подписки', className: 'bg-neutral-100 text-neutral-600 border-neutral-200' }
                  : { label: 'Архив', className: 'bg-neutral-200 text-neutral-700 border-neutral-300' }
                const ph = c.subscription ? periodHint(c.subscription.currentPeriodEnd) : null
                return (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/platform/companies/${c.id}`)}
                    className="group cursor-pointer border-t border-neutral-100 transition-colors hover:bg-neutral-50"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-neutral-900">{c.name}</div>
                      <div className="text-xs text-neutral-400">{c.inn ? `ИНН ${c.inn}` : c.legalName || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{c.subscription?.plan.name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${badge?.className}`}>
                        {badge?.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {ph ? (
                        <div>
                          <span className="text-neutral-600">{ph.date}</span>
                          {ph.note && <span className={`ml-1.5 text-xs font-medium ${ph.tone}`}>{ph.note}</span>}
                        </div>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-neutral-600">{c._count.users}</td>
                    <td className="px-4 py-3 text-right text-neutral-600">{c._count.projects}</td>
                    <td className="px-2 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-md text-neutral-500 opacity-0 transition-opacity hover:bg-neutral-100 focus-visible:opacity-100 group-hover:opacity-100"
                            aria-label={`Действия: ${c.name}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/platform/companies/${c.id}`)}>
                            Продлить подписку
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/platform/companies/${c.id}`)}>
                            Сменить тариф
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/platform/companies/${c.id}`)}>
                            Войти как компания
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => router.push(`/platform/companies/${c.id}`)}
                            className="text-red-600 focus:bg-red-50 focus:text-red-600"
                          >
                            {c.subscription?.status === 'SUSPENDED' ? 'Разблокировать' : 'Заблокировать'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

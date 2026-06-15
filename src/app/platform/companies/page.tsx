'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Search } from 'lucide-react'

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
  TRIAL: { label: 'Триал', className: 'bg-blue-100 text-blue-800' },
  ACTIVE: { label: 'Активна', className: 'bg-green-100 text-green-800' },
  PAST_DUE: { label: 'Просрочена', className: 'bg-amber-100 text-amber-800' },
  SUSPENDED: { label: 'Заблокирована', className: 'bg-red-100 text-red-800' },
  CANCELED: { label: 'Отменена', className: 'bg-gray-100 text-gray-600' },
}

export default function PlatformCompaniesPage() {
  const [companies, setCompanies] = useState<CompanyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const fetchCompanies = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (statusFilter) params.set('status', statusFilter)
    fetch(`/api/platform/companies?${params}`)
      .then((res) => (res.ok ? res.json() : { companies: [] }))
      .then((data) => setCompanies(data.companies || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchCompanies()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">Компании</h1>
        <Link
          href="/platform/companies/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Завести компанию
        </Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchCompanies()}
            placeholder="Название, юр. название или ИНН…"
            className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">Все статусы</option>
          <option value="active">Активные</option>
          <option value="trial">Триал</option>
          <option value="suspended">Заблокированные</option>
          <option value="archived">В архиве</option>
        </select>
        <button
          type="button"
          onClick={fetchCompanies}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        >
          Найти
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Загрузка…</p>
      ) : companies.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-white p-8 text-center text-sm text-gray-500">
          Компании не найдены
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                <th className="px-4 py-3">Компания</th>
                <th className="px-4 py-3">ИНН</th>
                <th className="px-4 py-3">Тариф</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Период до</th>
                <th className="px-4 py-3 text-right">Польз.</th>
                <th className="px-4 py-3 text-right">Проектов</th>
                <th className="px-4 py-3">Создана</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => {
                const badge = c.isActive
                  ? c.subscription
                    ? STATUS_BADGES[c.subscription.status]
                    : { label: 'Без подписки', className: 'bg-gray-100 text-gray-600' }
                  : { label: 'Архив', className: 'bg-gray-200 text-gray-700' }
                return (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/platform/companies/${c.id}`}
                        className="font-medium text-indigo-600 hover:underline"
                      >
                        {c.name}
                      </Link>
                      {c.legalName && <p className="text-xs text-gray-400">{c.legalName}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.inn || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{c.subscription?.plan.name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${badge?.className}`}>
                        {badge?.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.subscription
                        ? new Date(c.subscription.currentPeriodEnd).toLocaleDateString('ru-RU')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{c._count.users}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{c._count.projects}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(c.createdAt).toLocaleDateString('ru-RU')}
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

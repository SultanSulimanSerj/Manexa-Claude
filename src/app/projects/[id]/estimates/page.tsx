'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Layout from '@/components/layout'
import { SkeletonList } from '@/components/ui/skeleton'
import { ErrorBanner } from '@/components/ui/error-banner'
import { Plus, Search, MoreHorizontal } from 'lucide-react'

interface EstimateItem { id: string }
interface Estimate {
  id: string
  name: string
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'ARCHIVED'
  contractNumber: string | null
  total: number
  totalWithVat: number
  profit: number
  vatEnabled: boolean
  updatedAt: string
  creator: { name: string }
  items: EstimateItem[]
}

const STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'Черновик', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  PENDING: { label: 'На согласовании', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  APPROVED: { label: 'Утверждена', cls: 'bg-green-50 text-green-700 border-green-200' },
  ARCHIVED: { label: 'Архив', cls: 'bg-neutral-100 text-neutral-600 border-neutral-200' },
}

const fmt = (n: number) => new Intl.NumberFormat('ru-RU').format(Math.round(n)) + ' ₽'
const fmtMln = (n: number) => (Math.abs(n) >= 1_000_000 ? (n / 1_000_000).toFixed(1).replace('.', ',') + ' млн' : fmt(n))

const relDate = (iso: string) => {
  const d = new Date(iso)
  const today = new Date()
  const yest = new Date(today); yest.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'сегодня'
  if (d.toDateString() === yest.toDateString()) return 'вчера'
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

export default function EstimatesListPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params?.id as string

  const [projectName, setProjectName] = useState('')
  const [estimates, setEstimates] = useState<Estimate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [segment, setSegment] = useState<'all' | 'DRAFT' | 'PENDING' | 'APPROVED'>('all')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    try {
      const [pRes, eRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/projects/${projectId}/estimates`),
      ])
      if (pRes.ok) setProjectName((await pRes.json()).name || '')
      if (eRes.ok) {
        const data = await eRes.json()
        setEstimates(
          (Array.isArray(data) ? data : data.estimates || []).map((e: any) => ({
            ...e,
            total: Number(e.total),
            totalWithVat: Number(e.totalWithVat),
            profit: Number(e.profit),
          })),
        )
      } else {
        setError('Не удалось загрузить сметы')
      }
    } catch {
      setError('Ошибка при загрузке смет')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { load() }, [load])

  const createEstimate = async () => {
    if (creating) return
    setCreating(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/estimates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Новая смета' }),
      })
      if (res.ok) {
        const est = await res.json()
        router.push(`/projects/${projectId}/estimates/${est.id}`)
      } else {
        setError('Не удалось создать смету')
        setCreating(false)
      }
    } catch {
      setError('Ошибка при создании сметы')
      setCreating(false)
    }
  }

  const total = estimates.length
  const approvedSum = estimates.filter((e) => e.status === 'APPROVED').reduce((s, e) => s + e.totalWithVat, 0)
  const active = estimates.filter((e) => e.status !== 'ARCHIVED')
  const totalProfit = active.reduce((s, e) => s + e.profit, 0)
  const sumForMargin = active.reduce((s, e) => s + e.total, 0)
  const avgMargin = sumForMargin > 0 ? (totalProfit / sumForMargin) * 100 : 0

  const filtered = estimates.filter((e) => {
    if (segment !== 'all' && e.status !== segment) return false
    if (search.trim() && !e.name.toLowerCase().includes(search.trim().toLowerCase())) return false
    return true
  })

  const e_counts: Record<string, number> = {
    all: estimates.length,
    DRAFT: estimates.filter((e) => e.status === 'DRAFT').length,
    PENDING: estimates.filter((e) => e.status === 'PENDING').length,
    APPROVED: estimates.filter((e) => e.status === 'APPROVED').length,
  }
  const segLabel = (s: string) => e_counts[s] ?? 0

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6"><SkeletonList rows={6} /></div>
      </Layout>
    )
  }

  return (
    <Layout>
      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      <div className="space-y-5">
        {/* заголовок */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[12px] text-neutral-400">Проекты · {projectName || '—'}</div>
            <div className="mt-0.5 flex items-center gap-2 text-[22px] font-bold text-neutral-900">
              Сметы <span className="text-[16px] font-medium text-neutral-400">· {total}</span>
            </div>
          </div>
          <button
            onClick={createEstimate}
            disabled={creating}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" /> Новая смета
          </button>
        </div>

        {/* сводка */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-[18px]">
            <div className="text-[12px] font-medium text-neutral-400">Смет всего</div>
            <div className="mt-1.5 text-[26px] font-bold tabular-nums text-neutral-900">{total}</div>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-[18px]">
            <div className="text-[12px] font-medium text-neutral-400">Сумма (утверждённые)</div>
            <div className="mt-1.5 text-[26px] font-bold tabular-nums text-neutral-900">{fmtMln(approvedSum)}</div>
          </div>
          <div className="rounded-xl border border-green-200 bg-white p-[18px]">
            <div className="text-[12px] font-medium text-green-700">Прибыль</div>
            <div className="mt-1.5 text-[26px] font-bold tabular-nums text-green-700">
              {totalProfit >= 0 ? '+' : '−'}{fmtMln(Math.abs(totalProfit))}
            </div>
          </div>
          <div className="rounded-xl border border-green-200 bg-white p-[18px]">
            <div className="text-[12px] font-medium text-green-700">Средняя маржа</div>
            <div className="mt-1.5 text-[26px] font-bold tabular-nums text-green-700">{avgMargin.toFixed(1).replace('.', ',')}%</div>
          </div>
        </div>

        {/* поиск + сегменты */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13px] text-neutral-500">
            <Search className="h-4 w-4" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по смете…"
              className="w-48 bg-transparent outline-none placeholder:text-neutral-400"
            />
          </div>
          <div className="inline-flex rounded-lg bg-neutral-100 p-0.5">
            {([['all', 'Все'], ['DRAFT', 'Черновики'], ['PENDING', 'На согласовании'], ['APPROVED', 'Утверждённые']] as const).map(([s, l]) => (
              <button
                key={s}
                onClick={() => setSegment(s)}
                className={`rounded-md px-3 py-1.5 text-[12.5px] transition-colors ${
                  segment === s ? 'bg-white font-semibold text-neutral-900 shadow-sm' : 'font-medium text-neutral-500 hover:text-neutral-700'
                }`}
              >
                {l} <span className="text-neutral-400">{segLabel(s)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* таблица */}
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <div className="grid grid-cols-[2fr_1fr_0.6fr_1fr_1fr_0.7fr_40px] items-center border-b border-neutral-200 bg-neutral-50 px-4 text-[11.5px] font-semibold uppercase tracking-wide text-neutral-400">
            <div className="py-3">Смета</div>
            <div className="py-3">Статус</div>
            <div className="py-3 text-center">Позиций</div>
            <div className="py-3 text-right">Сумма с НДС</div>
            <div className="py-3 text-right">Прибыль</div>
            <div className="py-3 text-right">Обновлена</div>
            <div />
          </div>
          {filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-neutral-400">
              {estimates.length === 0 ? 'Смет пока нет. Нажмите «Новая смета».' : 'Ничего не найдено'}
            </div>
          ) : (
            filtered.map((e) => {
              const st = STATUS[e.status]
              const archived = e.status === 'ARCHIVED'
              const sub = archived
                ? 'Архив'
                : e.status === 'APPROVED' && e.contractNumber
                ? `Утверждена · в договоре ${e.contractNumber}`
                : `${st.label} · автор ${e.creator?.name || '—'}`
              return (
                <div
                  key={e.id}
                  onClick={() => router.push(`/projects/${projectId}/estimates/${e.id}`)}
                  className="grid cursor-pointer grid-cols-[2fr_1fr_0.6fr_1fr_1fr_0.7fr_40px] items-center border-t border-neutral-100 px-4 hover:bg-neutral-50"
                >
                  <div className="min-w-0 py-3 pr-2">
                    <div className="truncate text-[14px] font-semibold text-neutral-900">{e.name}</div>
                    <div className="truncate text-[11.5px] text-neutral-400">{sub}</div>
                  </div>
                  <div className="py-3">
                    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11.5px] font-medium ${st.cls}`}>{st.label}</span>
                  </div>
                  <div className="py-3 text-center text-[13px] tabular-nums text-neutral-700">{e.items.length}</div>
                  <div className="py-3 text-right text-[13px] font-medium tabular-nums text-neutral-900">{fmt(e.totalWithVat || e.total)}</div>
                  <div className={`py-3 text-right text-[13px] font-semibold tabular-nums ${archived ? 'text-neutral-300' : 'text-green-700'}`}>
                    {archived ? '—' : `${e.profit >= 0 ? '+' : '−'}${fmt(Math.abs(e.profit))}`}
                  </div>
                  <div className="py-3 text-right text-[12px] text-neutral-400">{relDate(e.updatedAt)}</div>
                  <div className="flex justify-center py-3 text-neutral-300"><MoreHorizontal className="h-4 w-4" /></div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </Layout>
  )
}

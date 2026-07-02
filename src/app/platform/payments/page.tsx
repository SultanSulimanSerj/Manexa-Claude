'use client'

import { confirm } from '@/components/ui/confirm'
import { toast } from '@/components/ui/use-toast'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Download, Undo2 } from 'lucide-react'

interface PaymentRow {
  id: string
  amount: string
  status: string
  method: string | null
  invoiceNumber: string | null
  comment: string | null
  paidAt: string
  periodStart: string | null
  periodEnd: string | null
  company: { id: string; name: string; inn: string | null } | null
  planName: string | null
}

interface Totals {
  completed: string
  refunded: string
  net: string
  count: number
}

const STATUS: Record<string, { label: string; className: string }> = {
  COMPLETED: { label: 'Проведён', className: 'bg-green-100 text-green-800' },
  PENDING: { label: 'Ожидает', className: 'bg-amber-100 text-amber-800' },
  REFUNDED: { label: 'Возврат', className: 'bg-gray-100 text-gray-600' },
}

export default function PlatformPaymentsPage() {
  const { data: session } = useSession()
  const isAdmin = (session?.user as any)?.role === 'PLATFORM_ADMIN'
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)

  const buildParams = () => {
    const p = new URLSearchParams()
    if (from) p.set('from', from)
    if (to) p.set('to', to)
    if (status) p.set('status', status)
    if (search.trim()) p.set('search', search.trim())
    return p
  }

  const fetchPayments = (goToPage = page) => {
    setLoading(true)
    const p = buildParams()
    p.set('page', String(goToPage))
    fetch(`/api/platform/payments?${p}`)
      .then((res) => (res.ok ? res.json() : { payments: [], totals: null }))
      .then((data) => {
        setPayments(data.payments || [])
        setTotals(data.totals || null)
        setPages(data.pagination?.pages || 1)
        setPage(data.pagination?.page || 1)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchPayments(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const exportCsv = () => {
    const p = buildParams()
    p.set('format', 'csv')
    window.open(`/api/platform/payments?${p}`, '_blank')
  }

  const refund = async (p: PaymentRow) => {
    if (
      !(await confirm(
        `Оформить возврат платежа ${Number(p.amount).toLocaleString('ru-RU')} ₽ (${p.company?.name})? Период подписки не откатывается автоматически.`
      ))
    )
      return
    setBusy(true)
    try {
      const res = await fetch(`/api/platform/payments/${p.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refund' }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Ошибка')
        return
      }
      toast.success('Возврат оформлен')
      fetchPayments()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">Платежи</h1>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <Download className="h-4 w-4" />
          Выгрузить CSV
        </button>
      </div>

      {/* Итоги */}
      {totals && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border bg-white p-3">
            <p className="text-xs text-gray-500">Проведено</p>
            <p className="text-lg font-bold text-gray-900">{Number(totals.completed).toLocaleString('ru-RU')} ₽</p>
          </div>
          <div className="rounded-xl border bg-white p-3">
            <p className="text-xs text-gray-500">Возвраты</p>
            <p className="text-lg font-bold text-gray-900">{Number(totals.refunded).toLocaleString('ru-RU')} ₽</p>
          </div>
          <div className="rounded-xl border bg-white p-3">
            <p className="text-xs text-gray-500">Чистыми</p>
            <p className="text-lg font-bold text-gray-900">{Number(totals.net).toLocaleString('ru-RU')} ₽</p>
          </div>
          <div className="rounded-xl border bg-white p-3">
            <p className="text-xs text-gray-500">Платежей</p>
            <p className="text-lg font-bold text-gray-900">{totals.count}</p>
          </div>
        </div>
      )}

      {/* Фильтры */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-500">С даты</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">По дату</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Статус</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
            <option value="">Все</option>
            <option value="COMPLETED">Проведённые</option>
            <option value="REFUNDED">Возвраты</option>
            <option value="PENDING">Ожидают</option>
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-xs text-gray-500">Поиск (компания / ИНН / счёт)</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchPayments(1)}
            placeholder="Введите и Enter…"
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => fetchPayments(1)}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        >
          Применить
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Загрузка…</p>
      ) : payments.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-white p-8 text-center text-sm text-gray-500">Платежей нет</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                <th className="px-4 py-3">Дата</th>
                <th className="px-4 py-3">Компания</th>
                <th className="px-4 py-3">Тариф</th>
                <th className="px-4 py-3 text-right">Сумма</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Счёт</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const badge = STATUS[p.status]
                return (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">
                      {new Date(p.paidAt).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-4 py-2.5">
                      {p.company ? (
                        <Link href={`/platform/companies/${p.company.id}`} className="font-medium text-indigo-600 hover:underline">
                          {p.company.name}
                        </Link>
                      ) : (
                        '—'
                      )}
                      {p.company?.inn && <p className="text-xs text-gray-400">ИНН {p.company.inn}</p>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{p.planName || '—'}</td>
                    <td className={`px-4 py-2.5 text-right font-medium ${p.status === 'REFUNDED' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                      {Number(p.amount).toLocaleString('ru-RU')} ₽
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${badge?.className || 'bg-gray-100 text-gray-600'}`}>
                        {badge?.label || p.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{p.invoiceNumber || '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      {isAdmin && p.status === 'COMPLETED' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => refund(p)}
                          title="Оформить возврат"
                          className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                          Возврат
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => fetchPayments(page - 1)}
            className="rounded border px-3 py-1 disabled:opacity-40"
          >
            Назад
          </button>
          <span className="text-gray-600">{page} / {pages}</span>
          <button
            type="button"
            disabled={page >= pages || loading}
            onClick={() => fetchPayments(page + 1)}
            className="rounded border px-3 py-1 disabled:opacity-40"
          >
            Вперёд
          </button>
        </div>
      )}
    </div>
  )
}

'use client'

import { confirm } from '@/components/ui/confirm'
import { toast } from '@/components/ui/use-toast'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

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
  sortOrder: number
  _count: { subscriptions: number }
}

interface PlanForm {
  code: string
  name: string
  description: string
  priceMonthly: string
  maxUsers: string
  maxProjects: string
  maxStorageGb: string
  isActive: boolean
  sortOrder: string
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
  const [editing, setEditing] = useState<PlanForm | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [savingPlan, setSavingPlan] = useState(false)

  const fetchPlans = () => {
    fetch('/api/platform/plans')
      .then((res) => (res.ok ? res.json() : { plans: [] }))
      .then((data) => setPlans(data.plans || []))
      .catch(() => {})
  }

  const startCreate = () => {
    setIsEditMode(false)
    setEditing({ code: '', name: '', description: '', priceMonthly: '', maxUsers: '', maxProjects: '', maxStorageGb: '', isActive: true, sortOrder: '0' })
  }

  const startEdit = (p: PlanRow) => {
    setIsEditMode(true)
    setEditing({
      code: p.code,
      name: p.name,
      description: '',
      priceMonthly: String(p.priceMonthly),
      maxUsers: p.maxUsers != null ? String(p.maxUsers) : '',
      maxProjects: p.maxProjects != null ? String(p.maxProjects) : '',
      maxStorageGb: p.maxStorageMb != null ? String(Math.round(p.maxStorageMb / 1024)) : '',
      isActive: p.isActive,
      sortOrder: String(p.sortOrder ?? 0),
    })
  }

  const savePlan = async () => {
    if (!editing) return
    if (!editing.code.trim() || !editing.name.trim() || editing.priceMonthly === '') {
      toast.error('Заполните код, название и цену')
      return
    }
    setSavingPlan(true)
    try {
      const res = await fetch('/api/platform/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: editing.code.trim().toUpperCase(),
          name: editing.name.trim(),
          description: editing.description || null,
          priceMonthly: Number(editing.priceMonthly),
          maxUsers: editing.maxUsers === '' ? null : Number(editing.maxUsers),
          maxProjects: editing.maxProjects === '' ? null : Number(editing.maxProjects),
          maxStorageMb: editing.maxStorageGb === '' ? null : Number(editing.maxStorageGb) * 1024,
          isActive: editing.isActive,
          sortOrder: Number(editing.sortOrder) || 0,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Ошибка сохранения')
        return
      }
      toast.success('Тариф сохранён')
      setEditing(null)
      fetchPlans()
    } finally {
      setSavingPlan(false)
    }
  }

  const deletePlan = async (p: PlanRow) => {
    if (p._count.subscriptions > 0) {
      toast.error(`На тарифе ${p._count.subscriptions} подписок — деактивируйте вместо удаления`)
      return
    }
    if (!(await confirm(`Удалить тариф «${p.name}»? Действие необратимо.`))) return
    const res = await fetch(`/api/platform/plans?id=${p.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Ошибка удаления')
      return
    }
    toast.success('Тариф удалён')
    fetchPlans()
  }

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
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Тарифы</h2>
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Создать тариф
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => (
            <div key={p.id} className={`rounded-xl border bg-white p-4 ${!p.isActive ? 'opacity-60' : ''}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">{p.name}</h3>
                <span className="text-xs text-gray-400">{p.code}</span>
              </div>
              {!p.isActive && (
                <span className="mt-1 inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Неактивен</span>
              )}
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
              <div className="mt-3 flex gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={() => startEdit(p)}
                  className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Изменить
                </button>
                <button
                  type="button"
                  onClick={() => deletePlan(p)}
                  className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Форма тарифа */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o && !savingPlan) setEditing(null) }}>
        {editing && (
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{isEditMode ? 'Изменить тариф' : 'Новый тариф'}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-gray-500">
                  Код (латиницей){isEditMode && ' — нельзя менять'}
                </label>
                <input
                  value={editing.code}
                  onChange={(e) => setEditing({ ...editing, code: e.target.value })}
                  placeholder="STANDARD"
                  disabled={isEditMode}
                  className="w-full rounded-lg border px-3 py-2 text-sm uppercase disabled:bg-gray-100 disabled:text-gray-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Название</label>
                <input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="Стандарт"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Цена, ₽/мес</label>
                <input
                  type="number"
                  value={editing.priceMonthly}
                  onChange={(e) => setEditing({ ...editing, priceMonthly: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Порядок</label>
                <input
                  type="number"
                  value={editing.sortOrder}
                  onChange={(e) => setEditing({ ...editing, sortOrder: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Польз. (пусто = безлимит)</label>
                <input
                  type="number"
                  value={editing.maxUsers}
                  onChange={(e) => setEditing({ ...editing, maxUsers: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Проектов (пусто = безлимит)</label>
                <input
                  type="number"
                  value={editing.maxProjects}
                  onChange={(e) => setEditing({ ...editing, maxProjects: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Хранилище, ГБ (пусто = безлимит)</label>
                <input
                  type="number"
                  value={editing.maxStorageGb}
                  onChange={(e) => setEditing({ ...editing, maxStorageGb: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={editing.isActive}
                    onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
                  />
                  Активен
                </label>
              </div>
            </div>
            <div className="col-span-2 mt-3">
              <label className="mb-1 block text-xs text-gray-500">Описание (опционально)</label>
              <input
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={savingPlan}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={savePlan}
                disabled={savingPlan}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {savingPlan ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}

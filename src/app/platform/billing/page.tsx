'use client'

import { confirm } from '@/components/ui/confirm'
import { toast } from '@/components/ui/use-toast'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, Pencil, Trash2, Eye, EyeOff, Check, AlertTriangle } from 'lucide-react'
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
  unlimitedUsers: boolean
  unlimitedProjects: boolean
  unlimitedStorage: boolean
  isActive: boolean
  sortOrder: string
}

const STATUS: Record<string, { label: string; className: string }> = {
  TRIAL: { label: 'Триал', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  ACTIVE: { label: 'Активна', className: 'bg-green-50 text-green-700 border-green-200' },
  PAST_DUE: { label: 'Просрочена', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  SUSPENDED: { label: 'Заблокирована', className: 'bg-red-50 text-red-700 border-red-200' },
  CANCELED: { label: 'Отменена', className: 'bg-neutral-100 text-neutral-600 border-neutral-200' },
}

const rub = (v: string | number) => `${new Intl.NumberFormat('ru-RU').format(Math.round(Number(v)))} ₽`

export default function PlatformBillingPage() {
  const [subscriptions, setSubscriptions] = useState<SubRow[]>([])
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<PlanForm | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [origPrice, setOrigPrice] = useState<number>(0)
  const [origSubs, setOrigSubs] = useState<number>(0)
  const [savingPlan, setSavingPlan] = useState(false)

  const fetchPlans = () => {
    fetch('/api/platform/plans')
      .then((res) => (res.ok ? res.json() : { plans: [] }))
      .then((data) => setPlans(data.plans || []))
      .catch(() => {})
  }

  const startCreate = () => {
    setIsEditMode(false)
    setOrigPrice(0)
    setOrigSubs(0)
    setEditing({
      code: '', name: '', description: '', priceMonthly: '',
      maxUsers: '10', maxProjects: '20', maxStorageGb: '5',
      unlimitedUsers: false, unlimitedProjects: false, unlimitedStorage: false,
      isActive: true, sortOrder: '0',
    })
  }

  const startEdit = (p: PlanRow) => {
    setIsEditMode(true)
    setOrigPrice(Number(p.priceMonthly))
    setOrigSubs(p._count.subscriptions)
    setEditing({
      code: p.code,
      name: p.name,
      description: '',
      priceMonthly: String(p.priceMonthly),
      maxUsers: p.maxUsers != null ? String(p.maxUsers) : '',
      maxProjects: p.maxProjects != null ? String(p.maxProjects) : '',
      maxStorageGb: p.maxStorageMb != null ? String(Math.round(p.maxStorageMb / 1024)) : '',
      unlimitedUsers: p.maxUsers == null,
      unlimitedProjects: p.maxProjects == null,
      unlimitedStorage: p.maxStorageMb == null,
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
          maxUsers: editing.unlimitedUsers ? null : Number(editing.maxUsers) || 0,
          maxProjects: editing.unlimitedProjects ? null : Number(editing.maxProjects) || 0,
          maxStorageMb: editing.unlimitedStorage ? null : (Number(editing.maxStorageGb) || 0) * 1024,
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

  const toggleVisibility = async (p: PlanRow) => {
    const res = await fetch('/api/platform/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: p.code, name: p.name, priceMonthly: Number(p.priceMonthly),
        maxUsers: p.maxUsers, maxProjects: p.maxProjects, maxStorageMb: p.maxStorageMb,
        isActive: !p.isActive, sortOrder: p.sortOrder,
      }),
    })
    if (res.ok) {
      toast.success(p.isActive ? 'Тариф скрыт с витрины' : 'Тариф вернулся на витрину')
      fetchPlans()
    } else {
      toast.error('Ошибка')
    }
  }

  const deletePlan = async (p: PlanRow) => {
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

  // Бизнес-агрегаты по тарифам
  const totalSubs = useMemo(() => plans.reduce((s, p) => s + p._count.subscriptions, 0), [plans])
  const mrrTotal = useMemo(
    () => plans.filter((p) => p.isActive).reduce((s, p) => s + Number(p.priceMonthly) * p._count.subscriptions, 0),
    [plans]
  )
  const maxSubs = Math.max(1, ...plans.map((p) => p._count.subscriptions))
  const popularId = useMemo(() => {
    const withSubs = plans.filter((p) => p._count.subscriptions > 0)
    if (withSubs.length === 0) return null
    return withSubs.reduce((a, b) => (b._count.subscriptions > a._count.subscriptions ? b : a)).id
  }, [plans])

  const priceChanged = isEditMode && editing && Number(editing.priceMonthly) !== origPrice && origSubs > 0

  return (
    <div className="space-y-6">
      {/* Тарифы */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">Тарифы</h1>
            <p className="text-sm text-neutral-500">
              {plans.length} тарифа · {totalSubs} подписок · MRR {rub(mrrTotal)}
            </p>
          </div>
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800"
          >
            <Plus className="h-4 w-4" />
            Создать тариф
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => {
            const subs = p._count.subscriptions
            const planMrr = Number(p.priceMonthly) * subs
            const share = Math.round((subs / maxSubs) * 100)
            const popular = p.id === popularId
            return (
              <div
                key={p.id}
                className={`relative rounded-xl bg-white p-4 ${
                  !p.isActive
                    ? 'border border-dashed border-neutral-300'
                    : popular
                    ? 'border-2 border-indigo-700'
                    : 'border border-neutral-200'
                }`}
              >
                {popular && p.isActive && (
                  <span className="absolute -top-2.5 left-4 rounded-full bg-indigo-700 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                    Самый популярный
                  </span>
                )}
                <div className="flex items-center justify-between">
                  <h3 className={`font-semibold ${p.isActive ? 'text-neutral-900' : 'text-neutral-500'}`}>{p.name}</h3>
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-400">{p.code}</span>
                </div>
                <p className={`mt-1 text-[28px] font-bold leading-none ${p.isActive ? 'text-neutral-900' : 'text-neutral-400'}`}>
                  {Number(p.priceMonthly).toLocaleString('ru-RU')}
                  <span className="text-sm font-normal text-neutral-400"> ₽/мес</span>
                </p>
                <ul className="mt-3 space-y-1 text-[13px] text-neutral-600">
                  <li className="flex justify-between"><span className="text-neutral-400">Пользователей</span><span>{p.maxUsers ?? '∞'}</span></li>
                  <li className="flex justify-between"><span className="text-neutral-400">Проектов</span><span>{p.maxProjects ?? '∞'}</span></li>
                  <li className="flex justify-between"><span className="text-neutral-400">Хранилище</span><span>{p.maxStorageMb ? `${Math.round(p.maxStorageMb / 1024)} ГБ` : '∞'}</span></li>
                </ul>

                {/* Бизнес-контекст */}
                <div className="mt-3 border-t border-neutral-100 pt-3">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-neutral-400">Подписок</span>
                    <span className="font-semibold text-neutral-900">{subs}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${share}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[12px]">
                    <span className="text-neutral-400">MRR тарифа</span>
                    <span className="font-semibold text-neutral-900">{rub(planMrr)}</span>
                  </div>
                </div>

                {!p.isActive && (
                  <p className="mt-2 text-[11.5px] text-neutral-400">
                    Скрыт: новые подключения закрыты, действующие работают.
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2 border-t border-neutral-100 pt-3">
                  <button
                    type="button"
                    onClick={() => startEdit(p)}
                    className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Изменить
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleVisibility(p)}
                    className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
                  >
                    {p.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {p.isActive ? 'Скрыть' : 'Вернуть'}
                  </button>
                  {subs === 0 && (
                    <button
                      type="button"
                      onClick={() => deletePlan(p)}
                      className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Удалить
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Подписки */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-neutral-900">Подписки</h2>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Все статусы</option>
            <option value="TRIAL">Триал</option>
            <option value="ACTIVE">Активные</option>
            <option value="PAST_DUE">Просроченные</option>
            <option value="SUSPENDED">Заблокированные</option>
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-neutral-500">Загрузка…</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 text-left text-[11.5px] font-semibold uppercase tracking-wide text-neutral-400">
                  <th className="px-4 py-2.5">Компания</th>
                  <th className="px-4 py-2.5">Тариф</th>
                  <th className="px-4 py-2.5">Статус</th>
                  <th className="px-4 py-2.5">Период до</th>
                  <th className="px-4 py-2.5">Последний платёж</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((s) => {
                  const badge = STATUS[s.status]
                  const expired = new Date(s.currentPeriodEnd).getTime() < now
                  return (
                    <tr key={s.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                      <td className="px-4 py-3">
                        <Link href={`/platform/companies/${s.company.id}`} className="font-medium text-neutral-900 hover:underline">
                          {s.company.name}
                        </Link>
                        {s.company.inn && <p className="text-xs text-neutral-400">ИНН {s.company.inn}</p>}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {s.plan.name} · {Number(s.plan.priceMonthly).toLocaleString('ru-RU')} ₽/мес
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${badge?.className}`}>
                          {badge?.label}
                        </span>
                      </td>
                      <td className={`px-4 py-3 ${expired ? 'font-medium text-red-600' : 'text-neutral-600'}`}>
                        {new Date(s.currentPeriodEnd).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {s.payments[0]
                          ? `${new Date(s.payments[0].paidAt).toLocaleDateString('ru-RU')} · ${Number(s.payments[0].amount).toLocaleString('ru-RU')} ₽`
                          : '—'}
                      </td>
                    </tr>
                  )
                })}
                {subscriptions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">Подписок нет</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Редактор тарифа + живое превью */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o && !savingPlan) setEditing(null) }}>
        {editing && (
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{isEditMode ? 'Изменить тариф' : 'Новый тариф'}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_300px]">
              {/* Форма */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-neutral-500">Код (латиницей)</label>
                    <input
                      value={editing.code}
                      onChange={(e) => setEditing({ ...editing, code: e.target.value })}
                      placeholder="STANDARD"
                      disabled={isEditMode}
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm uppercase disabled:bg-neutral-100 disabled:text-neutral-500"
                    />
                    {isEditMode && <p className="mt-1 text-[11px] text-neutral-400">Код нельзя менять</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-neutral-500">Название</label>
                    <input
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      placeholder="Стандарт"
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-neutral-500">Цена, ₽/мес</label>
                    <input
                      type="number"
                      value={editing.priceMonthly}
                      onChange={(e) => setEditing({ ...editing, priceMonthly: e.target.value })}
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-neutral-500">Порядок</label>
                    <input
                      type="number"
                      value={editing.sortOrder}
                      onChange={(e) => setEditing({ ...editing, sortOrder: e.target.value })}
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                {priceChanged && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    Изменение цены коснётся {origSubs} подписок при следующем продлении.
                  </div>
                )}

                {/* Лимиты с чекбоксом «Безлимит» */}
                {([
                  ['Пользователей', 'maxUsers', 'unlimitedUsers'],
                  ['Проектов', 'maxProjects', 'unlimitedProjects'],
                  ['Хранилище, ГБ', 'maxStorageGb', 'unlimitedStorage'],
                ] as const).map(([label, field, flag]) => (
                  <div key={field} className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="mb-1 block text-xs text-neutral-500">{label}</label>
                      <input
                        type="number"
                        value={editing[field]}
                        disabled={editing[flag]}
                        onChange={(e) => setEditing({ ...editing, [field]: e.target.value })}
                        className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm disabled:bg-neutral-100 disabled:text-neutral-400"
                      />
                    </div>
                    <label className="mt-5 flex shrink-0 items-center gap-1.5 text-[13px] text-neutral-600">
                      <input
                        type="checkbox"
                        checked={editing[flag]}
                        onChange={(e) => setEditing({ ...editing, [flag]: e.target.checked })}
                      />
                      Безлимит
                    </label>
                  </div>
                ))}

                <label className="flex items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={editing.isActive}
                    onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
                  />
                  Доступен на витрине
                </label>
              </div>

              {/* Живое превью «Как увидит клиент» */}
              <div>
                <p className="mb-2 text-xs font-medium text-neutral-400">Как увидит клиент</p>
                <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
                  <h4 className="font-semibold text-neutral-900">{editing.name || 'Название тарифа'}</h4>
                  <p className="mt-1 text-2xl font-bold text-neutral-900">
                    {editing.priceMonthly ? Number(editing.priceMonthly).toLocaleString('ru-RU') : '0'}
                    <span className="text-sm font-normal text-neutral-400"> ₽/мес</span>
                  </p>
                  <ul className="mt-3 space-y-2 text-[13px] text-neutral-600">
                    {[
                      `${editing.unlimitedUsers ? 'Без лимита' : editing.maxUsers || '0'} пользователей`,
                      `${editing.unlimitedProjects ? 'Без лимита' : editing.maxProjects || '0'} проектов`,
                      `${editing.unlimitedStorage ? 'Без лимита' : `${editing.maxStorageGb || '0'} ГБ`} хранилища`,
                    ].map((b) => (
                      <li key={b} className="flex items-center gap-2">
                        <Check className="h-4 w-4 shrink-0 text-green-600" />
                        {b}
                      </li>
                    ))}
                  </ul>
                  <button type="button" disabled className="mt-4 w-full rounded-lg bg-neutral-900 py-2 text-sm font-medium text-white opacity-90">
                    Выбрать тариф
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={savingPlan}
                className="rounded-lg border border-neutral-200 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={savePlan}
                disabled={savingPlan}
                className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800 disabled:opacity-50"
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

/**
 * Финансовый блок проекта: реестр доходов (счета — оплачено/нет) +
 * простой список расходов с пометкой «по смете» и фильтрами.
 */

import React, { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus, FileText, CreditCard, Download, Search, ChevronRight, ChevronDown, Pencil, Trash2 } from 'lucide-react'

export interface IncomeItem {
  id: string
  number: string
  amount: number
  date: string
  dueDate?: string | null
  isPaid?: boolean
  status: 'paid' | 'pending' | 'overdue'
  description?: string
  counterparty?: string | null
}

export interface ExpenseRow {
  id: string
  date: string
  amount: number
  category: string
  description?: string
  counterparty?: string
  isPaid: boolean
  purchasedBy?: string
  receiptKeys: string[]
  estimateItemName: string | null
  inEstimate: boolean
}

interface Props {
  incomeList?: IncomeItem[]
  expenses?: ExpenseRow[]
  onAddOperation?: () => void
  onCreateInvoice?: () => void
  onCreatePayment?: () => void
  onMarkPaid?: (financeId: string, isPaid: boolean) => void
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
  onUpdateReceipts?: (id: string, keys: string[]) => void
}

const fmt = (v: number) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
const fmtDate = (d: string) => (d ? new Date(d).toLocaleDateString('ru-RU') : '—')

export function BudgetCategoriesWithOperations({
  incomeList = [],
  expenses = [],
  onAddOperation,
  onCreateInvoice,
  onCreatePayment,
  onMarkPaid,
  onEdit,
  onDelete,
  onUpdateReceipts,
}: Props) {
  const [tab, setTab] = useState<'income' | 'expense'>('expense')
  const [mode, setMode] = useState<'all' | 'noEstimate' | 'unpaid'>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [incSearch, setIncSearch] = useState('')
  const [incMode, setIncMode] = useState<'all' | 'unpaid'>('all')
  const [openRow, setOpenRow] = useState<string | null>(null)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)
  const toggleRow = (id: string) => setOpenRow((cur) => (cur === id ? null : id))

  const uploadReceipt = async (e: React.ChangeEvent<HTMLInputElement>, row: ExpenseRow) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !onUpdateReceipts) return
    setUploadingFor(row.id)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/finance/receipts', { method: 'POST', body: fd })
      if (res.ok) {
        const data = await res.json()
        onUpdateReceipts(row.id, [...row.receiptKeys, data.key])
      }
    } finally {
      setUploadingFor(null)
    }
  }

  const totalIncome = incomeList.reduce((s, i) => s + i.amount, 0)
  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0)
  const incomePaid = incomeList.filter((i) => i.isPaid).reduce((s, i) => s + i.amount, 0)
  const incomeUnpaid = totalIncome - incomePaid
  const expensePaid = expenses.filter((e) => e.isPaid).reduce((s, e) => s + e.amount, 0)
  const expenseUnpaid = totalExpense - expensePaid

  const filteredIncome = useMemo(
    () =>
      incomeList.filter((i) => {
        if (incMode === 'unpaid' && i.isPaid) return false
        if (incSearch) {
          const hay = `${i.number} ${i.description || ''} ${i.counterparty || ''}`.toLowerCase()
          if (!hay.includes(incSearch.toLowerCase())) return false
        }
        return true
      }),
    [incomeList, incMode, incSearch]
  )

  const categories = useMemo(
    () => Array.from(new Set(expenses.map((e) => e.category))).sort((a, b) => a.localeCompare(b, 'ru')),
    [expenses]
  )

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (mode === 'noEstimate' && e.inEstimate) return false
      if (mode === 'unpaid' && e.isPaid) return false
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false
      if (search) {
        const hay = `${e.description || ''} ${e.counterparty || ''} ${e.category} ${e.purchasedBy || ''}`.toLowerCase()
        if (!hay.includes(search.toLowerCase())) return false
      }
      return true
    })
  }, [expenses, mode, categoryFilter, search])

  const filteredTotal = filteredExpenses.reduce((s, e) => s + e.amount, 0)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border border-gray-200 p-0.5">
            <button
              onClick={() => setTab('income')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === 'income' ? 'bg-neutral-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              Доходы ({incomeList.length})
            </button>
            <button
              onClick={() => setTab('expense')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === 'expense' ? 'bg-neutral-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              Расходы ({expenses.length})
            </button>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {tab === 'income' && onCreateInvoice && (
              <Button onClick={onCreateInvoice} size="sm" variant="outline" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Добавить счёт
              </Button>
            )}
            {tab === 'expense' && onAddOperation && (
              <Button onClick={onAddOperation} size="sm" variant="secondary" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Добавить расход
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Доходы / счета */}
        {tab === 'income' && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <h3 className="text-sm font-semibold text-gray-700">
                Доходы — всего {fmt(totalIncome)}
                <span className="font-normal text-gray-500"> · оплачено {fmt(incomePaid)} · не оплачено {fmt(incomeUnpaid)}</span>
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-gray-200 p-0.5">
                  {([['all', 'Все'], ['unpaid', 'Не оплачено']] as const).map(([key, label]) => (
                    <button key={key} onClick={() => setIncMode(key)} className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${incMode === key ? 'bg-neutral-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{label}</button>
                  ))}
                </div>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input value={incSearch} onChange={(e) => setIncSearch(e.target.value)} placeholder="Поиск" className="pl-7 pr-2 py-1.5 text-xs border border-gray-300 rounded-lg w-40 focus:outline-none focus:ring-2 focus:ring-ring/55" />
                </div>
              </div>
            </div>
            {filteredIncome.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500 rounded-lg bg-gray-50 border border-dashed">
                {incomeList.length === 0 ? 'Счетов пока нет. Нажмите «Добавить счёт».' : 'Ничего не найдено.'}
              </div>
            ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-50/70 border-b">
                    <th className="w-8 py-2 px-2"></th>
                    <th className="text-left py-2 px-3 font-medium text-neutral-500">Дата</th>
                    <th className="text-left py-2 px-3 font-medium text-neutral-500">Описание / контрагент</th>
                    <th className="text-right py-2 px-3 font-medium text-neutral-500">Сумма</th>
                    <th className="text-center py-2 px-3 font-medium text-neutral-500">Статус</th>
                    {onMarkPaid && <th className="py-2 px-3"></th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredIncome.map((item) => {
                    const open = openRow === `inc-${item.id}`
                    return (
                      <React.Fragment key={item.id}>
                        <tr className="border-b last:border-0 hover:bg-neutral-50 cursor-pointer" onClick={() => toggleRow(`inc-${item.id}`)}>
                          <td className="py-2 px-2 text-gray-400">{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                          <td className="py-2 px-3 text-gray-600 whitespace-nowrap">{fmtDate(item.date)}</td>
                          <td className="py-2 px-3 text-gray-700 max-w-[220px] truncate" title={[item.description, item.counterparty].filter(Boolean).join(' / ')}>
                            {item.description || item.counterparty || '—'}
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-green-600 tabular-nums">{fmt(item.amount)}</td>
                          <td className="py-2 px-3 text-center">
                            {item.status === 'paid' && <Badge className="bg-green-100 text-green-800">Оплачен</Badge>}
                            {item.status === 'pending' && <Badge variant="secondary">Ожидает</Badge>}
                            {item.status === 'overdue' && <Badge variant="destructive">Просрочен</Badge>}
                          </td>
                          {onMarkPaid && (
                            <td className="py-2 px-3 text-right whitespace-nowrap">
                              <button
                                onClick={(ev) => { ev.stopPropagation(); onMarkPaid(item.id, !item.isPaid) }}
                                className={`text-xs font-medium rounded-md px-2.5 py-1 border transition-colors ${
                                  item.isPaid ? 'border-gray-200 text-gray-500 hover:bg-gray-50' : 'border-green-200 text-green-700 hover:bg-green-50'
                                }`}
                              >
                                {item.isPaid ? 'Снять оплату' : 'Оплатить'}
                              </button>
                            </td>
                          )}
                        </tr>
                        {open && (
                          <tr className="bg-neutral-50/50 border-b last:border-0">
                            <td colSpan={onMarkPaid ? 6 : 5} className="px-4 py-3">
                              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
                                <div className="flex justify-between gap-3"><dt className="text-gray-500">Счёт №</dt><dd className="font-medium text-gray-900">{item.number}</dd></div>
                                <div className="flex justify-between gap-3"><dt className="text-gray-500">Контрагент</dt><dd className="text-gray-900">{item.counterparty || '—'}</dd></div>
                                <div className="flex justify-between gap-3"><dt className="text-gray-500">Срок оплаты</dt><dd className="text-gray-900">{item.dueDate ? fmtDate(item.dueDate) : '—'}</dd></div>
                                <div className="flex justify-between gap-3"><dt className="text-gray-500">Оплата</dt><dd className="text-gray-900">{item.isPaid ? `Оплачено по счёту ${item.number}` : 'Не оплачено'}</dd></div>
                                {item.description && <div className="sm:col-span-2"><dt className="text-gray-500">Описание</dt><dd className="text-gray-900">{item.description}</dd></div>}
                              </dl>
                              {(onEdit || onDelete) && (
                                <div className="mt-3 flex gap-2">
                                  {onEdit && (
                                    <button onClick={() => onEdit(item.id)} className="inline-flex items-center gap-1.5 text-xs font-medium rounded-md px-2.5 py-1 border border-gray-200 text-gray-600 hover:bg-gray-50">
                                      <Pencil className="h-3.5 w-3.5" /> Изменить
                                    </button>
                                  )}
                                  {onDelete && (
                                    <button onClick={() => onDelete(item.id)} className="inline-flex items-center gap-1.5 text-xs font-medium rounded-md px-2.5 py-1 border border-red-200 text-red-600 hover:bg-red-50">
                                      <Trash2 className="h-3.5 w-3.5" /> Удалить
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
            )}
          </div>
        )}

        {/* Расходы — простой список */}
        {tab === 'expense' && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <h3 className="text-sm font-semibold text-gray-700">
              Расходы — всего {fmt(totalExpense)}
              <span className="font-normal text-gray-500"> · оплачено {fmt(expensePaid)} · к оплате {fmt(expenseUnpaid)}</span>
              {filteredExpenses.length !== expenses.length && (
                <span className="font-normal text-gray-500"> · показано {fmt(filteredTotal)}</span>
              )}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-gray-200 p-0.5">
                {([
                  ['all', 'Все'],
                  ['noEstimate', 'Вне сметы'],
                  ['unpaid', 'Не оплачено'],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setMode(key)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      mode === key ? 'bg-neutral-900 text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-ring/55"
              >
                <option value="all">Все категории</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск"
                  className="pl-7 pr-2 py-1.5 text-xs border border-gray-300 rounded-lg w-40 focus:outline-none focus:ring-2 focus:ring-ring/55"
                />
              </div>
            </div>
          </div>

          {filteredExpenses.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500 rounded-lg bg-gray-50 border border-dashed">
              {expenses.length === 0 ? 'Расходов пока нет. Нажмите «Добавить расход».' : 'Ничего не найдено по фильтрам.'}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-50/70 border-b">
                    <th className="w-8 py-2 px-2"></th>
                    <th className="text-left py-2 px-3 font-medium text-neutral-500">Дата</th>
                    <th className="text-left py-2 px-3 font-medium text-neutral-500">Категория</th>
                    <th className="text-left py-2 px-3 font-medium text-neutral-500">Описание / контрагент</th>
                    <th className="text-left py-2 px-3 font-medium text-neutral-500">По смете</th>
                    <th className="text-right py-2 px-3 font-medium text-neutral-500">Сумма</th>
                    <th className="text-center py-2 px-3 font-medium text-neutral-500">Оплата</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((e) => {
                    const open = openRow === `exp-${e.id}`
                    return (
                      <React.Fragment key={e.id}>
                        <tr className="border-b last:border-0 hover:bg-neutral-50 cursor-pointer" onClick={() => toggleRow(`exp-${e.id}`)}>
                          <td className="py-2 px-2 text-gray-400">{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                          <td className="py-2 px-3 text-gray-600 whitespace-nowrap">{fmtDate(e.date)}</td>
                          <td className="py-2 px-3 text-gray-700">{e.category}</td>
                          <td className="py-2 px-3 text-gray-700 max-w-[220px] truncate" title={[e.description, e.counterparty].filter(Boolean).join(' / ')}>
                            {e.description || e.counterparty || '—'}
                          </td>
                          <td className="py-2 px-3">
                            {e.inEstimate ? (
                              <Badge variant="secondary" className="max-w-[160px] truncate" title={e.estimateItemName || ''}>
                                {e.estimateItemName || 'По смете'}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">Вне сметы</Badge>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-red-600 tabular-nums whitespace-nowrap">{fmt(e.amount)}</td>
                          <td className="py-2 px-3 text-center">
                            {onMarkPaid ? (
                              <button
                                onClick={(ev) => { ev.stopPropagation(); onMarkPaid(e.id, !e.isPaid) }}
                                className={`text-xs font-medium rounded-md px-2.5 py-1 border transition-colors ${
                                  e.isPaid ? 'border-green-200 text-green-700 bg-green-50' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                                }`}
                              >
                                {e.isPaid ? 'Оплачено' : 'Оплатить'}
                              </button>
                            ) : e.isPaid ? (
                              <Badge className="bg-green-100 text-green-800">Оплачено</Badge>
                            ) : (
                              <Badge variant="secondary">Не оплачено</Badge>
                            )}
                          </td>
                        </tr>
                        {open && (
                          <tr className="bg-neutral-50/50 border-b last:border-0">
                            <td colSpan={7} className="px-4 py-3">
                              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-sm mb-3">
                                <div className="flex justify-between gap-3"><dt className="text-gray-500">Кто купил</dt><dd className="font-medium text-gray-900">{e.purchasedBy || '—'}</dd></div>
                                <div className="flex justify-between gap-3"><dt className="text-gray-500">Контрагент</dt><dd className="text-gray-900">{e.counterparty || '—'}</dd></div>
                                <div className="flex justify-between gap-3"><dt className="text-gray-500">По смете</dt><dd className="text-gray-900">{e.inEstimate ? (e.estimateItemName || 'Да') : 'Вне сметы'}</dd></div>
                                {e.description && <div className="sm:col-span-2"><dt className="text-gray-500">Описание</dt><dd className="text-gray-900">{e.description}</dd></div>}
                              </dl>
                              <div>
                                <p className="text-xs text-gray-500 mb-1.5">Чеки</p>
                                <div className="flex flex-wrap gap-2">
                                  {e.receiptKeys.map((k, i) => {
                                    const href = `/api/finance/receipts?key=${encodeURIComponent(k)}`
                                    return (
                                      <div key={i} className="relative group">
                                        <a href={href} target="_blank" rel="noopener noreferrer">
                                          <img src={href} alt={`Чек ${i + 1}`} className="h-20 w-20 rounded-md border border-gray-200 object-cover hover:opacity-90" />
                                        </a>
                                        <a
                                          href={`${href}&dl=1`}
                                          download
                                          className="absolute bottom-1 right-1 h-6 w-6 rounded-md bg-white/90 border border-gray-200 flex items-center justify-center text-gray-600 hover:text-neutral-900"
                                          title="Скачать"
                                        >
                                          <Download className="h-3.5 w-3.5" />
                                        </a>
                                        {onUpdateReceipts && (
                                          <button
                                            onClick={() => onUpdateReceipts(e.id, e.receiptKeys.filter((_, idx) => idx !== i))}
                                            className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-neutral-900 text-white text-xs flex items-center justify-center"
                                            title="Удалить чек"
                                          >
                                            ×
                                          </button>
                                        )}
                                      </div>
                                    )
                                  })}
                                  {onUpdateReceipts && (
                                    <label className="h-20 w-20 rounded-md border border-dashed border-gray-300 flex items-center justify-center cursor-pointer text-gray-400 hover:bg-gray-100">
                                      {uploadingFor === e.id ? '…' : <Plus className="h-5 w-5" />}
                                      <input type="file" accept="image/*" className="hidden" disabled={uploadingFor === e.id} onChange={(ev) => uploadReceipt(ev, e)} />
                                    </label>
                                  )}
                                  {e.receiptKeys.length === 0 && !onUpdateReceipts && <p className="text-sm text-gray-400">Чеков нет</p>}
                                </div>
                              </div>
                              {(onEdit || onDelete) && (
                                <div className="mt-3 flex gap-2">
                                  {onEdit && (
                                    <button onClick={() => onEdit(e.id)} className="inline-flex items-center gap-1.5 text-xs font-medium rounded-md px-2.5 py-1 border border-gray-200 text-gray-600 hover:bg-gray-50">
                                      <Pencil className="h-3.5 w-3.5" /> Изменить
                                    </button>
                                  )}
                                  {onDelete && (
                                    <button onClick={() => onDelete(e.id)} className="inline-flex items-center gap-1.5 text-xs font-medium rounded-md px-2.5 py-1 border border-red-200 text-red-600 hover:bg-red-50">
                                      <Trash2 className="h-3.5 w-3.5" /> Удалить
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        )}
      </CardContent>
    </Card>
  )
}

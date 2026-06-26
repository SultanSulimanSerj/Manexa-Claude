/**
 * Финансовый блок проекта: реестр доходов (счета — оплачено/нет) +
 * простой список расходов с пометкой «по смете» и фильтрами.
 */

import React, { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus, FileText, CreditCard, Paperclip, Search } from 'lucide-react'

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
}: Props) {
  const [mode, setMode] = useState<'all' | 'noEstimate' | 'unpaid'>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [search, setSearch] = useState('')

  const totalIncome = incomeList.reduce((s, i) => s + i.amount, 0)
  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0)

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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle>Доходы и расходы</CardTitle>
          <div className="flex flex-wrap gap-2 shrink-0">
            {onCreateInvoice && (
              <Button onClick={onCreateInvoice} size="sm" variant="outline" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Добавить счёт
              </Button>
            )}
            {onAddOperation && (
              <Button onClick={onAddOperation} size="sm" variant="secondary" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Добавить расход
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Доходы / счета */}
        {incomeList.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Доходы (счета) — всего {fmt(totalIncome)}
            </h3>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-50/70 border-b">
                    <th className="text-left py-2 px-3 font-medium text-neutral-500">№ счёта</th>
                    <th className="text-left py-2 px-3 font-medium text-neutral-500">Дата</th>
                    <th className="text-left py-2 px-3 font-medium text-neutral-500">Описание / контрагент</th>
                    <th className="text-right py-2 px-3 font-medium text-neutral-500">Сумма</th>
                    <th className="text-left py-2 px-3 font-medium text-neutral-500">Срок оплаты</th>
                    <th className="text-center py-2 px-3 font-medium text-neutral-500">Статус</th>
                    {onMarkPaid && <th className="py-2 px-3"></th>}
                  </tr>
                </thead>
                <tbody>
                  {incomeList.map((item) => (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-neutral-50">
                      <td className="py-2 px-3 tabular-nums">{item.number}</td>
                      <td className="py-2 px-3 text-gray-600 whitespace-nowrap">{fmtDate(item.date)}</td>
                      <td className="py-2 px-3 text-gray-700 max-w-[200px] truncate" title={[item.description, item.counterparty].filter(Boolean).join(' / ')}>
                        {item.description || item.counterparty || '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-green-600 tabular-nums">{fmt(item.amount)}</td>
                      <td className="py-2 px-3 text-gray-600 whitespace-nowrap">{item.dueDate ? fmtDate(item.dueDate) : '—'}</td>
                      <td className="py-2 px-3 text-center">
                        {item.status === 'paid' && <Badge className="bg-green-100 text-green-800">Оплачен</Badge>}
                        {item.status === 'pending' && <Badge variant="secondary">Ожидает</Badge>}
                        {item.status === 'overdue' && <Badge variant="destructive">Просрочен</Badge>}
                      </td>
                      {onMarkPaid && (
                        <td className="py-2 px-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => onMarkPaid(item.id, !item.isPaid)}
                            className={`text-xs font-medium rounded-md px-2.5 py-1 border transition-colors ${
                              item.isPaid ? 'border-gray-200 text-gray-500 hover:bg-gray-50' : 'border-green-200 text-green-700 hover:bg-green-50'
                            }`}
                          >
                            {item.isPaid ? 'Снять оплату' : 'Оплатить'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Расходы — простой список */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <h3 className="text-sm font-semibold text-gray-700">
              Расходы — всего {fmt(totalExpense)}
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
                    <th className="text-left py-2 px-3 font-medium text-neutral-500">Дата</th>
                    <th className="text-left py-2 px-3 font-medium text-neutral-500">Категория</th>
                    <th className="text-left py-2 px-3 font-medium text-neutral-500">Описание / контрагент</th>
                    <th className="text-left py-2 px-3 font-medium text-neutral-500">По смете</th>
                    <th className="text-left py-2 px-3 font-medium text-neutral-500">Кто купил</th>
                    <th className="text-center py-2 px-3 font-medium text-neutral-500">Чек</th>
                    <th className="text-right py-2 px-3 font-medium text-neutral-500">Сумма</th>
                    <th className="text-center py-2 px-3 font-medium text-neutral-500">Оплата</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((e) => (
                    <tr key={e.id} className="border-b last:border-0 hover:bg-neutral-50">
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
                      <td className="py-2 px-3 text-gray-700 whitespace-nowrap">{e.purchasedBy || '—'}</td>
                      <td className="py-2 px-3 text-center">
                        {e.receiptKeys.length > 0 ? (
                          <div className="flex items-center justify-center gap-1">
                            {e.receiptKeys.map((k, i) => (
                              <a
                                key={i}
                                href={`/api/finance/receipts?key=${encodeURIComponent(k)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-500 hover:text-neutral-900"
                                title={`Чек ${i + 1}`}
                              >
                                <Paperclip className="h-4 w-4" />
                              </a>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-red-600 tabular-nums whitespace-nowrap">{fmt(e.amount)}</td>
                      <td className="py-2 px-3 text-center">
                        {onMarkPaid ? (
                          <button
                            onClick={() => onMarkPaid(e.id, !e.isPaid)}
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

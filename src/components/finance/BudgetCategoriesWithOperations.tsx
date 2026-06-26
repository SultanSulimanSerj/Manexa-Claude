/**
 * План/факт по статьям с раскрытием: под каждой статьёй — список платежей (операций) по этой категории.
 * В одном блоке: поступления (счета) + расходы по статьям с детализацией.
 */

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus, Info, ChevronDown, ChevronRight, FileText, CreditCard } from 'lucide-react'

export interface CategoryRow {
  id: string
  category: string
  plan: number
  fact: number
  percentage: number
}

export interface ExpenseOperation {
  id: string
  date: string
  amount: number
  description?: string | null
  counterparty?: string | null
  invoiceNumber?: string | null
}

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

interface BudgetCategoriesWithOperationsProps {
  categoriesData: CategoryRow[]
  operationsByCategory: Record<string, ExpenseOperation[]>
  incomeList?: IncomeItem[]
  onAddOperation?: () => void
  onCreateInvoice?: () => void
  onCreatePayment?: () => void
  onMarkPaid?: (financeId: string, isPaid: boolean) => void
}

export function BudgetCategoriesWithOperations({
  categoriesData,
  operationsByCategory,
  incomeList = [],
  onAddOperation,
  onCreateInvoice,
  onCreatePayment,
  onMarkPaid
}: BudgetCategoriesWithOperationsProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('ru-RU')

  const getPercentageBadge = (percentage: number, plan: number) => {
    if (plan === 0) return <Badge variant="outline" className="bg-gray-50">Только факт</Badge>
    if (percentage >= 100) return <Badge variant="destructive">Перерасход</Badge>
    if (percentage >= 80) return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Близко к лимиту</Badge>
    return <Badge variant="default" className="bg-green-100 text-green-800">В пределах плана</Badge>
  }

  const totalPlan = categoriesData.reduce((s, i) => s + i.plan, 0)
  const totalFact = categoriesData.reduce((s, i) => s + i.fact, 0)
  const totalPct = totalPlan > 0 ? (totalFact / totalPlan) * 100 : 0
  const totalRemainder = totalPlan - totalFact
  const totalIncome = incomeList.reduce((s, i) => s + i.amount, 0)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>План/факт по статьям и платежи</CardTitle>
            <CardDescription className="mt-1 flex items-center gap-1.5 text-sm">
              <Info className="h-4 w-4 shrink-0" />
              План — себестоимость по смете по категориям. Факт — расходы по проекту. Раскройте статью, чтобы увидеть список платежей по ней.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {onCreateInvoice && (
              <Button onClick={onCreateInvoice} size="sm" variant="outline" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Создать счёт
              </Button>
            )}
            {onCreatePayment && (
              <Button onClick={onCreatePayment} size="sm" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Добавить платёж
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
      <CardContent className="space-y-6">
        {/* Поступления (счета) */}
        {incomeList.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Поступления по проекту — всего {formatCurrency(totalIncome)}
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
                      <td className="py-2 px-3 text-gray-600 whitespace-nowrap">{formatDate(item.date)}</td>
                      <td className="py-2 px-3 text-gray-700 max-w-[200px] truncate" title={[item.description, item.counterparty].filter(Boolean).join(' / ')}>
                        {item.description || item.counterparty || '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-green-600 tabular-nums">{formatCurrency(item.amount)}</td>
                      <td className="py-2 px-3 text-gray-600 whitespace-nowrap">{item.dueDate ? formatDate(item.dueDate) : '—'}</td>
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
                              item.isPaid
                                ? 'border-gray-200 text-gray-500 hover:bg-gray-50'
                                : 'border-green-200 text-green-700 hover:bg-green-50'
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

        {/* Расходы по статьям с раскрытием */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Расходы по статьям (план / факт)</h3>
          {!categoriesData.length ? (
            <div className="py-8 text-center text-sm text-gray-500 rounded-lg bg-gray-50 border border-dashed">
              Нет данных по статьям. Добавьте смету к проекту и/или запишите расходы по категориям.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="w-10 py-3 px-2"></th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Статья (категория)</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">План (себестоимость)</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Факт расходов</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Остаток</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Факт / план</th>
                  </tr>
                </thead>
                <tbody>
                  {categoriesData.map((item) => {
                    const isExpanded = expandedCategory === item.category
                    const operations = operationsByCategory[item.category] || []
                    const remainder = item.plan - item.fact
                    return (
                      <React.Fragment key={item.id}>
                        <tr
                          key={item.id}
                          className="border-b hover:bg-gray-50 cursor-pointer"
                          onClick={() => setExpandedCategory(isExpanded ? null : item.category)}
                        >
                          <td className="py-3 px-2 text-gray-500">
                            {operations.length > 0 ? (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : null}
                          </td>
                          <td className="py-3 px-4 font-medium text-gray-900">
                            {item.category}
                            {operations.length > 0 && (
                              <span className="ml-2 text-xs text-gray-500">({operations.length} {operations.length === 1 ? 'платёж' : 'платежей'})</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right text-gray-700">{formatCurrency(item.plan)}</td>
                          <td className="py-3 px-4 text-right font-medium">{formatCurrency(item.fact)}</td>
                          <td className="py-3 px-4 text-right">
                            <span className={remainder >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {remainder >= 0 ? '' : '−'}{formatCurrency(Math.abs(remainder))}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className="font-medium">{item.plan > 0 ? `${item.percentage.toFixed(1)}%` : '—'}</span>
                              {getPercentageBadge(item.percentage, item.plan)}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && operations.length > 0 && (
                          <tr key={`${item.id}-expanded`} className="bg-gray-50/80">
                            <td colSpan={6} className="py-3 px-4">
                              <div className="pl-6 border-l-2 border-gray-200">
                                <p className="text-xs font-medium text-gray-500 mb-2">Платежи по статье «{item.category}»</p>
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-gray-500">
                                      <th className="text-left py-1.5 px-2 font-medium">Дата</th>
                                      <th className="text-left py-1.5 px-2 font-medium">Контрагент</th>
                                      <th className="text-left py-1.5 px-2 font-medium">№ счёта</th>
                                      <th className="text-left py-1.5 px-2 font-medium">Описание</th>
                                      <th className="text-right py-1.5 px-2 font-medium">Сумма</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {operations.map((op) => (
                                      <tr key={op.id} className="border-t border-gray-100 hover:bg-white/50">
                                        <td className="py-1.5 px-2 text-gray-600">{formatDate(op.date)}</td>
                                        <td className="py-1.5 px-2 text-gray-700 max-w-[120px] truncate" title={op.counterparty || undefined}>{op.counterparty || '—'}</td>
                                        <td className="py-1.5 px-2 text-gray-600">{op.invoiceNumber || '—'}</td>
                                        <td className="py-1.5 px-2 text-gray-600 max-w-[180px] truncate" title={op.description || undefined}>{op.description || '—'}</td>
                                        <td className="py-1.5 px-2 text-right font-medium text-red-600">{formatCurrency(op.amount)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-gray-50 font-semibold">
                    <td className="py-3 px-2"></td>
                    <td className="py-3 px-4 text-gray-900">Итого</td>
                    <td className="py-3 px-4 text-right text-gray-700">{formatCurrency(totalPlan)}</td>
                    <td className="py-3 px-4 text-right">{formatCurrency(totalFact)}</td>
                    <td className="py-3 px-4 text-right">
                      <span className={totalRemainder >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {totalRemainder >= 0 ? '' : '−'}{formatCurrency(Math.abs(totalRemainder))}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">{totalPlan > 0 ? `${totalPct.toFixed(1)}%` : '—'}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

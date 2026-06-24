'use client'

import { Plus, Trash2, Copy } from 'lucide-react'
import type { UpdEditableLineItem } from '@/lib/document-editor/types'
import { Tooltip } from '@/components/ui/tooltip'

interface UpdLineItemsTableProps {
  items: UpdEditableLineItem[]
  onChange: (items: UpdEditableLineItem[]) => void
  errors?: Record<string, string>
  readOnly?: boolean
}

export function UpdLineItemsTable({ items, onChange, errors = {}, readOnly }: UpdLineItemsTableProps) {
  const updateItem = (id: string, field: keyof UpdEditableLineItem, value: string | number) => {
    onChange(
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    )
  }

  const removeItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id))
  }

  const duplicateItem = (id: string) => {
    const source = items.find((i) => i.id === id)
    if (!source) return
    const copy: UpdEditableLineItem = {
      ...source,
      id: `line-dup-${Date.now()}`,
      name: `${source.name} (копия)`,
    }
    const idx = items.findIndex((i) => i.id === id)
    const next = [...items]
    next.splice(idx + 1, 0, copy)
    onChange(next)
  }

  const addItem = () => {
    onChange([
      ...items,
      {
        id: `line-new-${Date.now()}`,
        lineNumber: items.length + 1,
        name: '',
        quantity: 1,
        unit: 'шт.',
        unitPriceWithoutVat: 0,
        totalWithoutVat: 0,
        vatRate: 22,
        vatAmount: 0,
        totalWithVat: 0,
      },
    ])
  }

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-900">Позиции</h3>
        {!readOnly && (
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Добавить строку
          </button>
        )}
      </div>

      {errors.items && (
        <p className="px-4 py-2 text-sm text-red-600 bg-red-50">{errors.items}</p>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-2 py-2 text-left w-10">№</th>
              <th className="px-2 py-2 text-left w-[260px]">Наименование</th>
              <th className="px-2 py-2 text-left w-20">Ед.</th>
              <th className="px-2 py-2 text-right w-24">Кол-во</th>
              <th className="px-2 py-2 text-right w-28">Цена без НДС</th>
              <th className="px-2 py-2 text-right w-20">НДС %</th>
              <th className="px-2 py-2 text-right w-28">Сумма без НДС</th>
              <th className="px-2 py-2 text-right w-24">НДС</th>
              <th className="px-2 py-2 text-right w-28">Всего</th>
              <th className="px-2 py-2 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                  Нет позиций. Добавьте строку или выберите сметы при создании.
                </td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-2 py-2 text-gray-500">{index + 1}</td>
                  <td className="px-2 py-2 w-[260px] max-w-[260px]">
                    <Tooltip content={item.name || undefined} className="block w-full min-w-0">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                        disabled={readOnly}
                        className="w-full min-w-0 border border-gray-200 rounded px-2 py-1 text-sm disabled:bg-gray-50"
                        placeholder="Наименование работ/услуг"
                      />
                    </Tooltip>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={item.unit}
                      onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                      disabled={readOnly}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-sm disabled:bg-gray-50"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(item.id, 'quantity', Number(e.target.value) || 0)
                      }
                      disabled={readOnly}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-right disabled:bg-gray-50"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.unitPriceWithoutVat}
                      onChange={(e) =>
                        updateItem(item.id, 'unitPriceWithoutVat', Number(e.target.value) || 0)
                      }
                      disabled={readOnly}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-right disabled:bg-gray-50"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="1"
                      value={item.vatRate}
                      onChange={(e) =>
                        updateItem(item.id, 'vatRate', Number(e.target.value) || 0)
                      }
                      disabled={readOnly}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-right disabled:bg-gray-50"
                    />
                  </td>
                  <td className="px-2 py-2 text-right text-gray-700">
                    {item.totalWithoutVat.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-2 py-2 text-right text-gray-700">
                    {item.vatAmount.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-2 py-2 text-right font-medium text-gray-900">
                    {item.totalWithVat.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-2 py-2">
                    {!readOnly && (
                      <div className="flex gap-0.5">
                        <button
                          type="button"
                          onClick={() => duplicateItem(item.id)}
                          className="p-1 text-gray-400 hover:text-blue-600"
                          title="Дублировать"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="p-1 text-gray-400 hover:text-red-600"
                          title="Удалить"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

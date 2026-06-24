'use client'

import type { CommercialOfferDocumentContent } from '@/lib/document-editor/types'
import type { CommercialOfferData } from '@/lib/commercial-offer-generator'
import type { SpecificationItem } from '@/lib/specification-appendix'
import { recalculateCommercialOfferData } from '@/lib/document-editor/commercial-offer-calculations'
import { Plus, Trash2 } from 'lucide-react'
import { Tooltip } from '@/components/ui/tooltip'

interface CommercialOfferEditorProps {
  content: CommercialOfferDocumentContent
  onChange: (content: CommercialOfferDocumentContent) => void
  readOnly?: boolean
}

function formatMoney(value: number): string {
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const emptyItem = (): SpecificationItem => ({
  name: '',
  quantity: 1,
  unit: 'шт',
  unitPrice: 0,
  total: 0,
  category: 'materials',
})

export function CommercialOfferEditor({ content, onChange, readOnly }: CommercialOfferEditorProps) {
  const data = content.data

  const commitData = (next: CommercialOfferData) => {
    onChange({ ...content, data: recalculateCommercialOfferData(next) })
  }

  const updateData = (patch: Partial<CommercialOfferData>) => {
    if (readOnly) return
    commitData({ ...data, ...patch })
  }

  const updateItem = (index: number, patch: Partial<SpecificationItem>) => {
    if (readOnly) return
    const items = data.items.map((item, i) => (i === index ? { ...item, ...patch } : item))
    commitData({ ...data, items })
  }

  const addItem = () => {
    if (readOnly) return
    commitData({ ...data, items: [...data.items, emptyItem()] })
  }

  const removeItem = (index: number) => {
    if (readOnly) return
    commitData({ ...data, items: data.items.filter((_, i) => i !== index) })
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Коммерческое предложение</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-sm">
            <span className="text-gray-600">Номер</span>
            <input
              type="text"
              value={data.offerNumber}
              onChange={(e) => updateData({ offerNumber: e.target.value })}
              readOnly={readOnly}
              className="mt-1 w-full border rounded-lg px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="text-gray-600">Дата</span>
            <input
              type="text"
              value={data.offerDate}
              onChange={(e) => updateData({ offerDate: e.target.value })}
              readOnly={readOnly}
              className="mt-1 w-full border rounded-lg px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="text-gray-600">Действительно до</span>
            <input
              type="text"
              value={data.validUntil}
              onChange={(e) => updateData({ validUntil: e.target.value })}
              readOnly={readOnly}
              className="mt-1 w-full border rounded-lg px-3 py-2"
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div className="bg-white rounded-lg border p-4">
          <p className="font-medium text-gray-700 mb-1">Исполнитель</p>
          <p>{data.executorLegalName || data.executorName}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="font-medium text-gray-700 mb-1">Заказчик</p>
          <p>{data.clientLegalName || data.clientName}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-x-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-sm font-semibold text-gray-900">Позиции</h3>
          {!readOnly && (
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800"
            >
              <Plus className="h-4 w-4" />
              Добавить строку
            </button>
          )}
        </div>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left w-10">№</th>
              <th className="px-3 py-2 text-left w-[260px]">Наименование</th>
              <th className="px-3 py-2 text-right w-24">Кол-во</th>
              <th className="px-3 py-2 text-left w-20">Ед.</th>
              <th className="px-3 py-2 text-right w-28">Цена</th>
              <th className="px-3 py-2 text-right w-28">Сумма</th>
              {!readOnly && <th className="px-3 py-2 w-10" />}
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, index) => (
              <tr key={index} className="border-t">
                <td className="px-3 py-2">{index + 1}</td>
                <td className="px-3 py-2 w-[260px] max-w-[260px]">
                  <Tooltip content={item.name || undefined} className="block w-full min-w-0">
                    {readOnly ? (
                      <span className="block truncate">{item.name}</span>
                    ) : (
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateItem(index, { name: e.target.value })}
                        className="w-full min-w-0 border rounded px-2 py-1"
                      />
                    )}
                  </Tooltip>
                </td>
                <td className="px-3 py-2 text-right">
                  {readOnly ? (
                    item.quantity
                  ) : (
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(index, { quantity: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full border rounded px-2 py-1 text-right"
                    />
                  )}
                </td>
                <td className="px-3 py-2">
                  {readOnly ? (
                    item.unit
                  ) : (
                    <input
                      type="text"
                      value={item.unit}
                      onChange={(e) => updateItem(index, { unit: e.target.value })}
                      className="w-full border rounded px-2 py-1"
                    />
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {readOnly ? (
                    formatMoney(item.unitPrice)
                  ) : (
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) =>
                        updateItem(index, { unitPrice: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full border rounded px-2 py-1 text-right"
                    />
                  )}
                </td>
                <td className="px-3 py-2 text-right">{formatMoney(item.total)}</td>
                {!readOnly && (
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="p-1 text-gray-400 hover:text-red-600"
                      title="Удалить строку"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 text-sm text-right border-t space-y-1">
          <p>Итого без НДС: {formatMoney(data.total)} ₽</p>
          {data.vatEnabled && (
            <p>
              НДС ({data.vatRate}%): {formatMoney(data.vatAmount)} ₽
            </p>
          )}
          <p className="font-medium">Итого: {formatMoney(data.totalWithVat)} ₽</p>
        </div>
      </div>
    </div>
  )
}

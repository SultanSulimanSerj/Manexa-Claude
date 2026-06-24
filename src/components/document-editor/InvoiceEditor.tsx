'use client'

import type { InvoiceDocumentContent } from '@/lib/document-editor/types'
import type { InvoiceDocumentData } from '@/lib/document-renderer/fns-form-types'
import { Tooltip } from '@/components/ui/tooltip'

interface InvoiceEditorProps {
  content: InvoiceDocumentContent
  onChange: (content: InvoiceDocumentContent) => void
  readOnly?: boolean
}

function formatMoney(value: number): string {
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function InvoiceEditor({ content, onChange, readOnly }: InvoiceEditorProps) {
  const data = content.data

  const updateData = (patch: Partial<InvoiceDocumentData>) => {
    if (readOnly) return
    onChange({ ...content, data: { ...data, ...patch } })
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Счёт на оплату</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-sm">
            <span className="text-gray-600">Номер</span>
            <input
              type="text"
              value={data.documentNumber}
              onChange={(e) => updateData({ documentNumber: e.target.value })}
              readOnly={readOnly}
              className="mt-1 w-full border rounded-lg px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="text-gray-600">Дата</span>
            <input
              type="text"
              value={data.documentDate}
              onChange={(e) => updateData({ documentDate: e.target.value })}
              readOnly={readOnly}
              className="mt-1 w-full border rounded-lg px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="text-gray-600">Оплатить до</span>
            <input
              type="text"
              value={data.dueDate || ''}
              onChange={(e) => updateData({ dueDate: e.target.value || undefined })}
              readOnly={readOnly}
              placeholder="ДД.ММ.ГГГГ"
              className="mt-1 w-full border rounded-lg px-3 py-2"
            />
          </label>
        </div>
        <label className="text-sm block mt-3">
          <span className="text-gray-600">Назначение платежа</span>
          <textarea
            value={data.paymentPurpose || ''}
            onChange={(e) => updateData({ paymentPurpose: e.target.value || undefined })}
            readOnly={readOnly}
            rows={2}
            className="mt-1 w-full border rounded-lg px-3 py-2"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border p-4 text-sm">
          <p className="font-medium text-gray-700 mb-1">Поставщик</p>
          <p>{data.seller.legalName || data.seller.name}</p>
          <p className="text-gray-500">ИНН {data.seller.inn}</p>
        </div>
        <div className="bg-white rounded-lg border p-4 text-sm">
          <p className="font-medium text-gray-700 mb-1">Покупатель</p>
          <p>{data.buyer.legalName || data.buyer.name}</p>
          <p className="text-gray-500">ИНН {data.buyer.inn}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">№</th>
              <th className="px-3 py-2 text-left w-[260px]">Наименование</th>
              <th className="px-3 py-2 text-right">Кол-во</th>
              <th className="px-3 py-2 text-left">Ед.</th>
              <th className="px-3 py-2 text-right">Сумма</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.lineNumber} className="border-t">
                <td className="px-3 py-2">{item.lineNumber}</td>
                <td className="px-3 py-2 w-[260px] max-w-[260px]">
                  <Tooltip content={item.name || undefined} className="block max-w-full">
                    <span className="block truncate">{item.name}</span>
                  </Tooltip>
                </td>
                <td className="px-3 py-2 text-right">{item.quantity}</td>
                <td className="px-3 py-2">{item.unit}</td>
                <td className="px-3 py-2 text-right">{formatMoney(item.totalWithVat)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-4 py-3 text-sm font-medium text-right border-t">
          Итого: {formatMoney(data.totals.totalWithVat)} руб.
        </p>
      </div>
    </div>
  )
}

'use client'

import type { DocumentContent } from '@/lib/document-editor/types'
import { getDocumentTypeDefinition } from '@/lib/document-editor/registry'

interface FnsDraftPreviewProps {
  content: DocumentContent
}

function formatMoney(value: number): string {
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function FnsDraftPreview({ content }: FnsDraftPreviewProps) {
  const typeDef = getDocumentTypeDefinition(content.type)
  const data = content.data as {
    documentNumber: string
    documentDate: string
    projectName: string
    seller: { legalName?: string; name: string; inn: string }
    buyer: { legalName?: string; name: string; inn: string }
    objectName?: string
    contractBasis?: string
    basisText?: string
    items: Array<{
      lineNumber: number
      name: string
      quantity: number
      unit: string
      totalWithVat: number
    }>
    totals: { totalWithVat: number }
    paymentPurpose?: string
  }

  return (
    <div className="bg-white rounded-lg border p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{typeDef.label}</h2>
        <p className="text-sm text-gray-600 mt-1">
          № {data.documentNumber} от {data.documentDate} · {data.projectName}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div className="rounded-lg bg-gray-50 p-4">
          <p className="font-medium text-gray-700 mb-1">Исполнитель</p>
          <p>{data.seller.legalName || data.seller.name}</p>
          <p className="text-gray-500">ИНН {data.seller.inn}</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-4">
          <p className="font-medium text-gray-700 mb-1">Заказчик</p>
          <p>{data.buyer.legalName || data.buyer.name}</p>
          <p className="text-gray-500">ИНН {data.buyer.inn}</p>
        </div>
      </div>

      {data.objectName && (
        <p className="text-sm">
          <span className="font-medium">Объект:</span> {data.objectName}
        </p>
      )}
      {(data.contractBasis || data.basisText) && (
        <p className="text-sm">
          <span className="font-medium">Основание:</span> {data.basisText || data.contractBasis}
        </p>
      )}
      {data.paymentPurpose && (
        <p className="text-sm">
          <span className="font-medium">Назначение платежа:</span> {data.paymentPurpose}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left border-b">№</th>
              <th className="px-3 py-2 text-left border-b">Наименование</th>
              <th className="px-3 py-2 text-right border-b">Кол-во</th>
              <th className="px-3 py-2 text-left border-b">Ед.</th>
              <th className="px-3 py-2 text-right border-b">Сумма</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.lineNumber}>
                <td className="px-3 py-2 border-b">{item.lineNumber}</td>
                <td className="px-3 py-2 border-b">{item.name}</td>
                <td className="px-3 py-2 border-b text-right">{item.quantity}</td>
                <td className="px-3 py-2 border-b">{item.unit}</td>
                <td className="px-3 py-2 border-b text-right">
                  {formatMoney(item.totalWithVat)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm font-medium text-right">
        Итого: {formatMoney(data.totals.totalWithVat)} руб.
      </p>

      <p className="text-xs text-gray-500">
        Позиции заполнены из сметы и этапов проекта. Нажмите «Сформировать» в шапке для
        выгрузки печатной формы ({typeDef.fileExtension.toUpperCase()}).
      </p>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ContractDocumentContent } from '@/lib/document-editor/types'
import type { ContractData } from '@/lib/document-generator'

interface ContractEditorProps {
  content: ContractDocumentContent
  onChange: (content: ContractDocumentContent) => void
  readOnly?: boolean
}

interface FieldDef {
  key: keyof ContractData
  label: string
}

const EXECUTOR_DETAILS: FieldDef[] = [
  { key: 'executorKpp', label: 'КПП' },
  { key: 'executorOgrn', label: 'ОГРН' },
  { key: 'executorAddress', label: 'Юридический адрес' },
  { key: 'executorDirector', label: 'ФИО директора' },
  { key: 'executorPhone', label: 'Телефон' },
  { key: 'executorEmail', label: 'Email' },
  { key: 'executorBankAccount', label: 'Расчётный счёт' },
  { key: 'executorBankName', label: 'Банк' },
  { key: 'executorBankBik', label: 'БИК' },
  { key: 'executorCorrespondentAccount', label: 'Корр. счёт' },
]

const CLIENT_DETAILS: FieldDef[] = [
  { key: 'clientKpp', label: 'КПП' },
  { key: 'clientOgrn', label: 'ОГРН' },
  { key: 'clientLegalAddress', label: 'Юридический адрес' },
  { key: 'clientDirector', label: 'ФИО директора' },
  { key: 'clientPhone', label: 'Телефон' },
  { key: 'clientEmail', label: 'Email' },
  { key: 'clientBankAccount', label: 'Расчётный счёт' },
  { key: 'clientBankName', label: 'Банк' },
  { key: 'clientBankBik', label: 'БИК' },
  { key: 'clientCorrespondentAccount', label: 'Корр. счёт' },
]

export function ContractEditor({ content, onChange, readOnly }: ContractEditorProps) {
  const data = content.data
  const [showDetails, setShowDetails] = useState(false)

  const updateData = (patch: Partial<ContractData>) => {
    if (readOnly) return
    onChange({ ...content, data: { ...data, ...patch } })
  }

  const renderDetailFields = (fields: FieldDef[]) =>
    fields.map((f) => (
      <label key={f.key} className="block text-sm">
        <span className="text-xs text-gray-500">{f.label}</span>
        <input
          value={(data[f.key] as string) || ''}
          onChange={(e) => updateData({ [f.key]: e.target.value } as Partial<ContractData>)}
          readOnly={readOnly}
          className="mt-0.5 w-full border rounded-lg px-3 py-1.5"
        />
      </label>
    ))

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Договор подряда</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="text-gray-600">Номер договора</span>
            <input
              type="text"
              value={data.contractNumber}
              onChange={(e) => updateData({ contractNumber: e.target.value })}
              readOnly={readOnly}
              className="mt-1 w-full border rounded-lg px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="text-gray-600">Дата</span>
            <input
              type="text"
              value={data.contractDate}
              onChange={(e) => updateData({ contractDate: e.target.value })}
              readOnly={readOnly}
              className="mt-1 w-full border rounded-lg px-3 py-2"
            />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="text-gray-600">Предмет / проект</span>
            <input
              type="text"
              value={data.projectName}
              onChange={(e) => updateData({ projectName: e.target.value })}
              readOnly={readOnly}
              className="mt-1 w-full border rounded-lg px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="text-gray-600">Сумма договора</span>
            <input
              type="text"
              value={data.totalAmount}
              onChange={(e) => updateData({ totalAmount: e.target.value })}
              readOnly={readOnly}
              className="mt-1 w-full border rounded-lg px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="text-gray-600">Адрес работ</span>
            <input
              type="text"
              value={data.workAddress}
              onChange={(e) => updateData({ workAddress: e.target.value })}
              readOnly={readOnly}
              className="mt-1 w-full border rounded-lg px-3 py-2"
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div className="bg-white rounded-lg border p-4 space-y-2">
          <p className="font-medium text-gray-700">Исполнитель</p>
          <input
            value={data.executorLegalName}
            onChange={(e) => updateData({ executorLegalName: e.target.value })}
            readOnly={readOnly}
            className="w-full border rounded-lg px-3 py-2"
          />
          <input
            value={data.executorInn}
            onChange={(e) => updateData({ executorInn: e.target.value })}
            readOnly={readOnly}
            placeholder="ИНН"
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>
        <div className="bg-white rounded-lg border p-4 space-y-2">
          <p className="font-medium text-gray-700">Заказчик</p>
          <input
            value={data.clientLegalName}
            onChange={(e) => updateData({ clientLegalName: e.target.value })}
            readOnly={readOnly}
            className="w-full border rounded-lg px-3 py-2"
          />
          <input
            value={data.clientInn}
            onChange={(e) => updateData({ clientInn: e.target.value })}
            readOnly={readOnly}
            placeholder="ИНН"
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border">
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          {showDetails ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          )}
          Реквизиты сторон
          <span className="ml-auto text-xs font-normal text-gray-400">
            КПП, ОГРН, адреса, банковские реквизиты
          </span>
        </button>
        {showDetails && (
          <div className="grid grid-cols-1 gap-4 border-t p-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Исполнитель</p>
              {renderDetailFields(EXECUTOR_DETAILS)}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Заказчик</p>
              {renderDetailFields(CLIENT_DETAILS)}
            </div>
          </div>
        )}
      </div>

      {data.specification?.items?.length ? (
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm font-medium text-gray-800 mb-2">Спецификация</p>
          <p className="text-sm text-gray-600">
            {data.specification.items.length} позиций, итого{' '}
            {data.specification.totalWithVat.toLocaleString('ru-RU')} ₽
          </p>
        </div>
      ) : null}
    </div>
  )
}

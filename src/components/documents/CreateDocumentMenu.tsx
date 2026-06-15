'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Plus, ChevronDown, FileText, FileSpreadsheet, Receipt, ScrollText, ClipboardList } from 'lucide-react'

const DOCUMENT_TYPES = [
  {
    type: 'COMMERCIAL_OFFER',
    label: 'Коммерческое предложение',
    icon: FileText,
    description: 'КП по смете',
  },
  {
    type: 'CONTRACT',
    label: 'Договор подряда',
    icon: ScrollText,
    description: 'Договор с опциональной спецификацией',
  },
  {
    type: 'INVOICE',
    label: 'Счёт на оплату',
    icon: Receipt,
    description: 'Из сметы или КП',
  },
  {
    type: 'UPD',
    label: 'УПД',
    icon: FileSpreadsheet,
    description: 'На основании счёта',
  },
  {
    type: 'KS2',
    label: 'КС-2',
    icon: ClipboardList,
    description: 'Акт приёмки работ по смете',
  },
  {
    type: 'KS3',
    label: 'КС-3',
    icon: ClipboardList,
    description: 'Справка о стоимости работ',
  },
  {
    type: 'SERVICE_ACT',
    label: 'Акт приёмки услуг',
    icon: FileText,
    description: 'Закрывающий акт по смете',
  },
] as const

interface CreateDocumentMenuProps {
  projectId?: string | null
  estimateId?: string | null
  className?: string
  buttonLabel?: string
}

export function CreateDocumentMenu({
  projectId,
  estimateId,
  className = '',
  buttonLabel = 'Создать документ',
}: CreateDocumentMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const buildHref = (type: string) => {
    const params = new URLSearchParams({ type })
    if (projectId) params.set('projectId', projectId)
    if (estimateId) params.set('estimateId', estimateId)
    return `/documents/new?${params.toString()}`
  }

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
      >
        <Plus className="h-4 w-4" />
        {buttonLabel}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1">
          {DOCUMENT_TYPES.map(({ type, label, icon: Icon, description }) => (
            <Link
              key={type}
              href={buildHref(type)}
              onClick={() => setOpen(false)}
              className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <Icon className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <p className="text-xs text-gray-500">{description}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

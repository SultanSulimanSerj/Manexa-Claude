'use client'

import { useEffect, useState } from 'react'
import { toast } from '@/components/ui/use-toast'

interface Settings {
  sellerName: string | null
  sellerLegalName: string | null
  sellerInn: string | null
  sellerKpp: string | null
  sellerOgrn: string | null
  sellerLegalAddress: string | null
  sellerDirectorName: string | null
  sellerDirectorPosition: string | null
  sellerBankAccount: string | null
  sellerBankName: string | null
  sellerBankBik: string | null
  sellerCorrespondentAccount: string | null
  sellerContactPhone: string | null
  sellerContactEmail: string | null
  taxMode: string
  vatRate: number
  annualDiscountPercent: number
  invoicePrefix: string
  sbpQrPath: string | null
}

export default function PlatformSettingsPage() {
  const [form, setForm] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)
  const [qrBust, setQrBust] = useState(Date.now())
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    fetch('/api/platform/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setForm(d.settings))
      .catch(() => {})
  }, [])

  const set = (patch: Partial<Settings>) => setForm((p) => (p ? { ...p, ...patch } : p))

  const save = async () => {
    if (!form) return
    setSaving(true)
    try {
      const res = await fetch('/api/platform/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        toast.success('Настройки сохранены')
      } else {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || 'Не удалось сохранить')
      }
    } finally {
      setSaving(false)
    }
  }

  const uploadQr = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/platform/settings/sbp-qr', { method: 'POST', body: fd })
      if (res.ok) {
        setForm((p) => (p ? { ...p, sbpQrPath: 'set' } : p))
        setQrBust(Date.now())
        toast.success('QR загружен')
      } else {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || 'Не удалось загрузить')
      }
    } finally {
      setUploading(false)
    }
  }

  if (!form) {
    return <div className="mx-auto max-w-3xl p-6 text-sm text-neutral-500">Загрузка…</div>
  }

  const field = (label: string, key: keyof Settings, placeholder = '') => (
    <label className="block text-sm">
      <span className="text-neutral-600">{label}</span>
      <input
        value={(form[key] as string) ?? ''}
        onChange={(e) => set({ [key]: e.target.value } as Partial<Settings>)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </label>
  )

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Настройки платформы</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Реквизиты продавца и параметры биллинга. Подставляются в счета и акты.
        </p>
      </div>

      {/* Реквизиты продавца */}
      <section className="rounded-xl border bg-white p-6">
        <h2 className="text-sm font-semibold text-neutral-900">Реквизиты продавца</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {field('Название (рабочее)', 'sellerName', 'Manexa')}
          {field('Юридическое название', 'sellerLegalName', 'ООО «…»')}
          {field('ИНН', 'sellerInn')}
          {field('КПП', 'sellerKpp')}
          {field('ОГРН', 'sellerOgrn')}
          {field('ФИО директора', 'sellerDirectorName')}
          {field('Должность подписанта', 'sellerDirectorPosition')}
          {field('Телефон', 'sellerContactPhone')}
          {field('Email', 'sellerContactEmail')}
        </div>
        {field('Юридический адрес', 'sellerLegalAddress')}
      </section>

      {/* Банковские реквизиты */}
      <section className="rounded-xl border bg-white p-6">
        <h2 className="text-sm font-semibold text-neutral-900">Банковские реквизиты</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {field('Расчётный счёт', 'sellerBankAccount')}
          {field('Банк', 'sellerBankName')}
          {field('БИК', 'sellerBankBik')}
          {field('Корр. счёт', 'sellerCorrespondentAccount')}
        </div>
      </section>

      {/* Налоги и биллинг */}
      <section className="rounded-xl border bg-white p-6">
        <h2 className="text-sm font-semibold text-neutral-900">Налоги и биллинг</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="block text-sm">
            <span className="text-neutral-600">Режим налогообложения</span>
            <select
              value={form.taxMode}
              onChange={(e) => set({ taxMode: e.target.value })}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="USN">УСН (без НДС)</option>
              <option value="OSN">ОСН (с НДС)</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-neutral-600">Ставка НДС, %</span>
            <input
              type="number"
              value={form.vatRate}
              disabled={form.taxMode !== 'OSN'}
              onChange={(e) => set({ vatRate: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-600">Скидка за год (12 мес), %</span>
            <input
              type="number"
              value={form.annualDiscountPercent}
              onChange={(e) => set({ annualDiscountPercent: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
        </div>
        <div className="mt-3 max-w-[220px]">
          {field('Префикс номера счёта', 'invoicePrefix', 'СЧ')}
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          При УСН в счёте — «НДС не облагается», закрывающий документ — акт. При ОСН добавится НДС и УПД.
        </p>
      </section>

      {/* СБП QR */}
      <section className="rounded-xl border bg-white p-6">
        <h2 className="text-sm font-semibold text-neutral-900">Статический СБП QR</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Один QR на все счета. Оплата не отслеживается автоматически — подтверждается вручную.
        </p>
        <div className="mt-4 flex items-center gap-4">
          {form.sbpQrPath ? (
            <img
              src={`/api/platform/settings/sbp-qr?v=${qrBust}`}
              alt="СБП QR"
              className="h-28 w-28 rounded-lg border object-contain"
            />
          ) : (
            <div className="flex h-28 w-28 items-center justify-center rounded-lg border border-dashed text-xs text-neutral-400">
              Нет QR
            </div>
          )}
          <label className="inline-flex cursor-pointer items-center rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50">
            {uploading ? 'Загрузка…' : 'Загрузить QR'}
            <input
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) uploadQr(f)
              }}
            />
          </label>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Сохранение…' : 'Сохранить'}
        </button>
      </div>
    </div>
  )
}

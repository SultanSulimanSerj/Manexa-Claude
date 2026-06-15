'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search, Copy, CheckCircle } from 'lucide-react'

interface PlanOption {
  id: string
  code: string
  name: string
  priceMonthly: string
}

interface CreatedInfo {
  company: { id: string; name: string }
  owner: { id: string; email: string }
  tempPassword: string
  subscription: { status: string; currentPeriodEnd: string; plan: string }
}

const EMPTY_FORM = {
  name: '',
  legalName: '',
  inn: '',
  kpp: '',
  ogrn: '',
  legalAddress: '',
  actualAddress: '',
  city: '',
  directorName: '',
  contactPhone: '',
  contactEmail: '',
  bankAccount: '',
  bankName: '',
  bankBik: '',
  correspondentAccount: '',
  ownerName: '',
  ownerEmail: '',
  planCode: 'TRIAL',
}

export default function NewCompanyPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [form, setForm] = useState(EMPTY_FORM)
  const [plans, setPlans] = useState<PlanOption[]>([])
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreatedInfo | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/platform/plans')
      .then((res) => (res.ok ? res.json() : { plans: [] }))
      .then((data) => setPlans((data.plans || []).filter((p: any) => p.isActive)))
      .catch(() => {})
  }, [])

  const set = (patch: Partial<typeof EMPTY_FORM>) => setForm((prev) => ({ ...prev, ...patch }))

  const lookupInn = async () => {
    if (!form.inn || form.inn.length < 10) {
      setLookupError('Введите ИНН (10 или 12 цифр)')
      return
    }
    setLookupLoading(true)
    setLookupError(null)
    try {
      const res = await fetch(`/api/counterparty/lookup?inn=${encodeURIComponent(form.inn)}`)
      const data = await res.json()
      if (!res.ok) {
        setLookupError(data.error || 'Не удалось найти компанию')
        return
      }
      const d = data.data
      set({
        name: form.name || d.name || '',
        legalName: d.legalName || '',
        kpp: d.kpp || '',
        ogrn: d.ogrn || '',
        legalAddress: d.legalAddress || '',
        actualAddress: d.actualAddress || d.legalAddress || '',
        directorName: d.directorName || '',
      })
    } catch {
      setLookupError('Ошибка запроса к DaData')
    } finally {
      setLookupLoading(false)
    }
  }

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/platform/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Не удалось создать компанию')
        return
      }
      setCreated(data)
    } catch {
      setError('Ошибка запроса')
    } finally {
      setSubmitting(false)
    }
  }

  const copyCredentials = () => {
    if (!created) return
    navigator.clipboard.writeText(
      `Manexa — доступ для директора\nАдрес: ${window.location.origin}/auth/signin\nEmail: ${created.owner.email}\nВременный пароль: ${created.tempPassword}\n\nПри первом входе система попросит сменить пароль.`
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Экран успеха: показываем временный пароль один раз
  if (created) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
          <CheckCircle className="mx-auto h-10 w-10 text-green-600" />
          <h1 className="mt-3 text-lg font-bold text-gray-900">
            Компания «{created.company.name}» создана
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Тариф {created.subscription.plan}, доступ до{' '}
            {new Date(created.subscription.currentPeriodEnd).toLocaleDateString('ru-RU')}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-6">
          <h2 className="text-sm font-semibold text-gray-900">Доступ директора</h2>
          <p className="mt-1 text-xs text-amber-600">
            Временный пароль показывается только один раз — передайте директору сейчас.
          </p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Email</dt>
              <dd className="font-mono text-gray-900">{created.owner.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Временный пароль</dt>
              <dd className="font-mono font-bold text-gray-900">{created.tempPassword}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={copyCredentials}
            className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Copy className="h-4 w-4" />
            {copied ? 'Скопировано' : 'Скопировать данные для передачи'}
          </button>
        </div>

        <div className="flex gap-3">
          <Link
            href={`/platform/companies/${created.company.id}`}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-center text-sm hover:bg-gray-50"
          >
            Открыть карточку компании
          </Link>
          <button
            type="button"
            onClick={() => {
              setCreated(null)
              setForm(EMPTY_FORM)
              setStep(1)
            }}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            Завести ещё одну
          </button>
        </div>
      </div>
    )
  }

  const field = (
    label: string,
    key: keyof typeof EMPTY_FORM,
    props: { placeholder?: string; type?: string; required?: boolean } = {}
  ) => (
    <label className="block text-sm">
      <span className="text-gray-600">
        {label}
        {props.required && <span className="text-red-500"> *</span>}
      </span>
      <input
        type={props.type || 'text'}
        value={form[key]}
        onChange={(e) => set({ [key]: e.target.value } as any)}
        placeholder={props.placeholder}
        className="mt-1 w-full rounded-lg border px-3 py-2"
      />
    </label>
  )

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/platform/companies"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Компании
      </Link>

      <h1 className="text-xl font-bold text-gray-900">Новая компания</h1>

      <div className="flex items-center gap-2 text-sm">
        <span className={`rounded-full px-3 py-1 ${step === 1 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
          1. Реквизиты
        </span>
        <span className="text-gray-300">→</span>
        <span className={`rounded-full px-3 py-1 ${step === 2 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
          2. Директор и тариф
        </span>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}

      {step === 1 && (
        <div className="space-y-3 rounded-xl border bg-white p-6">
          <div className="flex gap-2">
            <div className="flex-1">{field('ИНН', 'inn', { placeholder: '7700000000', required: true })}</div>
            <button
              type="button"
              onClick={lookupInn}
              disabled={lookupLoading}
              className="mt-6 inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 px-4 py-2 text-sm text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
            >
              <Search className="h-4 w-4" />
              {lookupLoading ? 'Поиск…' : 'Найти по ИНН'}
            </button>
          </div>
          {lookupError && <p className="text-sm text-amber-600">{lookupError}</p>}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {field('Название (рабочее)', 'name', { required: true })}
            {field('Юридическое название', 'legalName')}
            {field('КПП', 'kpp')}
            {field('ОГРН', 'ogrn')}
            {field('Город', 'city')}
            {field('ФИО директора', 'directorName')}
          </div>
          {field('Юридический адрес', 'legalAddress')}
          {field('Фактический адрес', 'actualAddress')}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {field('Телефон', 'contactPhone')}
            {field('Email компании', 'contactEmail')}
            {field('Расчётный счёт', 'bankAccount')}
            {field('Банк', 'bankName')}
            {field('БИК', 'bankBik')}
            {field('Корр. счёт', 'correspondentAccount')}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => {
                if (!form.name || !form.inn) {
                  setError('Заполните название и ИНН')
                  return
                }
                setError(null)
                setStep(2)
              }}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Далее
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3 rounded-xl border bg-white p-6">
          <h2 className="text-sm font-semibold text-gray-900">Аккаунт директора (OWNER)</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {field('ФИО директора', 'ownerName', { required: true })}
            {field('Email для входа', 'ownerEmail', { type: 'email', required: true })}
          </div>
          <p className="text-xs text-gray-500">
            Временный пароль будет сгенерирован автоматически и показан после создания. При первом
            входе директор обязан сменить пароль.
          </p>

          <h2 className="pt-2 text-sm font-semibold text-gray-900">Тариф</h2>
          <select
            value={form.planCode}
            onChange={(e) => set({ planCode: e.target.value })}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          >
            {plans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name} — {Number(p.priceMonthly).toLocaleString('ru-RU')} ₽/мес
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500">
            Триал — 14 дней, платные тарифы активируются на 30 дней (продление — через фиксацию оплаты).
          </p>

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-lg border border-gray-300 px-5 py-2 text-sm hover:bg-gray-50"
            >
              Назад
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting || !form.ownerName || !form.ownerEmail}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? 'Создание…' : 'Создать компанию'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

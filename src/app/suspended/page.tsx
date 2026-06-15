'use client'

import { useEffect, useState } from 'react'
import { signOut } from 'next-auth/react'
import { ShieldAlert } from 'lucide-react'

interface StatusInfo {
  blocked: boolean
  reason: 'COMPANY_ARCHIVED' | 'SUBSCRIPTION_SUSPENDED' | null
  subscription: {
    status: string
    currentPeriodEnd: string
    plan: { code: string; name: string }
  } | null
}

export default function SuspendedPage() {
  const [info, setInfo] = useState<StatusInfo | null>(null)

  useEffect(() => {
    fetch('/api/subscription/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && !data.blocked) {
          // Доступ восстановлен — возвращаем на главную
          window.location.href = '/'
          return
        }
        setInfo(data)
      })
      .catch(() => {})
  }, [])

  const reasonText =
    info?.reason === 'COMPANY_ARCHIVED'
      ? 'Аккаунт вашей компании перенесён в архив.'
      : 'Доступ приостановлен из-за неоплаченной подписки.'

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
        <ShieldAlert className="mx-auto h-12 w-12 text-amber-500" />
        <h1 className="mt-4 text-xl font-bold text-gray-900">Доступ приостановлен</h1>
        <p className="mt-2 text-sm text-gray-600">{reasonText}</p>
        {info?.subscription && (
          <p className="mt-2 text-sm text-gray-500">
            Тариф «{info.subscription.plan.name}», период до{' '}
            {new Date(info.subscription.currentPeriodEnd).toLocaleDateString('ru-RU')}
          </p>
        )}
        <p className="mt-4 text-sm text-gray-600">
          Для восстановления доступа свяжитесь с вашим менеджером Manexa. Данные компании
          сохранены и будут доступны после возобновления подписки.
        </p>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/auth/signin' })}
          className="mt-6 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Выйти из аккаунта
        </button>
      </div>
    </div>
  )
}

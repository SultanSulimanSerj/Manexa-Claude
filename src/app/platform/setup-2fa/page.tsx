'use client'

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ShieldCheck } from 'lucide-react'

export default function Setup2FAPage() {
  const router = useRouter()
  const { data: session, update } = useSession()
  const totpEnabled = Boolean((session?.user as any)?.totpEnabled)

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    if (totpEnabled) {
      router.replace('/platform')
      return
    }
    fetch('/api/platform/2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'init' }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.qrDataUrl) {
          setQrDataUrl(data.qrDataUrl)
          setSecret(data.secret)
        } else {
          setError(data.error || 'Не удалось инициализировать 2FA')
        }
      })
      .catch(() => setError('Ошибка запроса'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const verify = async (e: React.FormEvent) => {
    e.preventDefault()
    setVerifying(true)
    setError(null)
    try {
      const res = await fetch('/api/platform/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', code }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Не удалось подтвердить код')
        return
      }
      await update()
      router.replace('/platform')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-xl border bg-white p-8">
        <div className="text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-indigo-500" />
          <h1 className="mt-3 text-xl font-bold text-gray-900">Настройка 2FA</h1>
          <p className="mt-1 text-sm text-gray-600">
            Для платформенных ролей двухфакторная аутентификация обязательна.
          </p>
        </div>

        <ol className="mt-6 space-y-4 text-sm text-gray-700">
          <li>
            <span className="font-medium">1. Отсканируйте QR-код</span> в приложении (Google
            Authenticator, Яндекс Ключ, 1Password и т.п.):
            <div className="mt-2 flex justify-center">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR-код для 2FA" className="rounded-lg border" />
              ) : (
                <div className="flex h-60 w-60 items-center justify-center rounded-lg border text-gray-400">
                  {error ? '—' : 'Генерация…'}
                </div>
              )}
            </div>
            {secret && (
              <p className="mt-2 text-center text-xs text-gray-500">
                Или введите вручную: <span className="font-mono">{secret}</span>
              </p>
            )}
          </li>
          <li>
            <span className="font-medium">2. Введите код из приложения:</span>
            <form onSubmit={verify} className="mt-2 flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                required
                className="w-full rounded-lg border px-3 py-2 text-center font-mono text-lg tracking-widest"
              />
              <button
                type="submit"
                disabled={verifying || code.length < 6}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {verifying ? '…' : 'Включить'}
              </button>
            </form>
          </li>
        </ol>

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

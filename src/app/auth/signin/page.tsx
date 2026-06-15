'use client'

import { useState, useEffect } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageSuspense } from '@/components/page-suspense'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LogIn, Eye, EyeOff, CheckCircle } from 'lucide-react'
import Link from 'next/link'

function SignInPageContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [totpRequired, setTotpRequired] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const message = searchParams?.get('message')
    if (message === 'registration-success') {
      setSuccessMessage('Регистрация прошла успешно! Теперь вы можете войти в систему.')
    }
    if (message === 'registration-disabled') {
      setError('Публичная регистрация отключена. Обратитесь к администратору.')
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await signIn('credentials', {
        email,
        password,
        ...(totpCode && { totpCode }),
        redirect: false
      })

      if (result?.error) {
        // Двухфакторная аутентификация
        if (result.error === 'TOTP_REQUIRED') {
          setTotpRequired(true)
          setError('Введите код из приложения-аутентификатора')
        } else if (result.error === 'TOTP_INVALID') {
          setTotpRequired(true)
          setError('Неверный код подтверждения')
        } else {
          setError('Неверные учетные данные')
        }
      } else {
        // Проверяем сессию
        const session = await getSession()
        if (session) {
          const role = (session.user as { role?: string } | undefined)?.role
          const isPlatform = role === 'PLATFORM_ADMIN' || role === 'PLATFORM_MANAGER'
          router.push(isPlatform ? '/platform' : '/')
        } else {
          setError('Ошибка создания сессии')
        }
      }
    } catch (err) {
      setError('Ошибка входа в систему')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <LogIn className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-2xl">Вход в систему</CardTitle>
          <CardDescription>
            Войдите в свой аккаунт для доступа к панели управления
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {successMessage && (
              <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-md text-sm flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                {successMessage}
              </div>
            )}
            
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}
            
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Введите ваш email"
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="password">Пароль</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Введите ваш пароль"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            {totpRequired && (
              <div>
                <Label htmlFor="totpCode">Код подтверждения (2FA)</Label>
                <Input
                  id="totpCode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="6 цифр из приложения"
                  maxLength={6}
                  required
                  className="mt-1"
                />
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Вход...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <LogIn className="h-4 w-4" />
                  Войти
                </div>
              )}
            </Button>
          </form>

          {process.env.NEXT_PUBLIC_ALLOW_PUBLIC_REGISTRATION !== 'false' && (
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Нет аккаунта?{' '}
                <Link href="/auth/signup" className="text-blue-600 hover:text-blue-500 font-medium">
                  Зарегистрироваться
                </Link>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function SignInPage() {
  return (
    <PageSuspense>
      <SignInPageContent />
    </PageSuspense>
  )
}
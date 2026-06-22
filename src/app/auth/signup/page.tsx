'use client'


import { toast } from '@/components/ui/use-toast'
import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserPlus, Eye, EyeOff, Building2 } from 'lucide-react'
import Link from 'next/link'
import { InnLookupField } from '@/components/counterparty/InnLookupField'
import { toCompanyRegistrationFields } from '@/lib/counterparty/map-fields'

export default function SignUpPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    address: '',
    companyName: '',
    companyDescription: '',
    inn: '',
    kpp: '',
    ogrn: '',
    legalAddress: '',
    actualAddress: '',
    directorName: '',
    contactPhone: '',
    contactEmail: '',
    bankAccount: '',
    bankName: '',
    bankBik: '',
    correspondentAccount: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const registrationEnabled =
    process.env.NEXT_PUBLIC_ALLOW_PUBLIC_REGISTRATION !== 'false'

  useEffect(() => {
    if (!registrationEnabled) {
      router.replace('/auth/signin?message=registration-disabled')
    }
  }, [registrationEnabled, router])

  if (!registrationEnabled) {
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Валидация
    if (formData.password !== formData.confirmPassword) {
      setError('Пароли не совпадают')
      setLoading(false)
      return
    }

    if (formData.password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          phone: formData.phone,
          address: formData.address,
          companyName: formData.companyName,
          companyDescription: formData.companyDescription,
          inn: formData.inn,
          kpp: formData.kpp,
          ogrn: formData.ogrn,
          legalAddress: formData.legalAddress,
          actualAddress: formData.actualAddress,
          directorName: formData.directorName,
          contactPhone: formData.contactPhone,
          contactEmail: formData.contactEmail,
          bankAccount: formData.bankAccount,
          bankName: formData.bankName,
          bankBik: formData.bankBik,
          correspondentAccount: formData.correspondentAccount
        })
      })

      if (response.ok) {
        // Показываем сообщение об успешной регистрации
        setError('')
        toast.success('Регистрация прошла успешно! Теперь вы можете войти в систему.')
        // Перенаправляем на страницу входа
        router.push('/auth/signin?message=registration-success')
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Ошибка регистрации')
      }
    } catch (err) {
      setError('Ошибка регистрации')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <UserPlus className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-2xl">Регистрация</CardTitle>
          <CardDescription>
            Создайте аккаунт и начните управлять проектами
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}
            
            {/* Личная информация */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Личная информация
              </h3>
              
              <div>
                <Label htmlFor="name">Полное имя</Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Введите ваше имя"
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
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
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    placeholder="Минимум 6 символов"
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

              <div>
                <Label htmlFor="confirmPassword">Подтвердите пароль</Label>
                <div className="relative mt-1">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    placeholder="Повторите пароль"
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="phone">Телефон</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="+7 (999) 123-45-67"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="address">Адрес</Label>
                <Input
                  id="address"
                  type="text"
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  placeholder="г. Москва, ул. Примерная, д. 1"
                  className="mt-1"
                />
              </div>
            </div>

            {/* Информация о компании */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Информация о компании
              </h3>
              
              <div>
                <Label htmlFor="companyName">Название компании</Label>
                <Input
                  id="companyName"
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => handleInputChange('companyName', e.target.value)}
                  placeholder="Введите название компании"
                  required
                  className="mt-1"
                />
              </div>

              <InnLookupField
                label="ИНН компании"
                value={formData.inn}
                onChange={(inn) => handleInputChange('inn', inn)}
                onFound={(data) =>
                  setFormData((prev) => ({
                    ...prev,
                    ...toCompanyRegistrationFields(data),
                  }))
                }
                placeholder="Введите ИНН — данные подставятся автоматически"
                required
              />

              <div>
                <Label htmlFor="kpp">КПП компании</Label>
                <Input
                  id="kpp"
                  type="text"
                  value={formData.kpp}
                  onChange={(e) => handleInputChange('kpp', e.target.value)}
                  placeholder="Введите КПП компании"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="ogrn">ОГРН компании</Label>
                <Input
                  id="ogrn"
                  type="text"
                  value={formData.ogrn}
                  onChange={(e) => handleInputChange('ogrn', e.target.value)}
                  placeholder="Введите ОГРН компании"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="legalAddress">Юридический адрес</Label>
                <Input
                  id="legalAddress"
                  type="text"
                  value={formData.legalAddress}
                  onChange={(e) => handleInputChange('legalAddress', e.target.value)}
                  placeholder="Введите юридический адрес"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="actualAddress">Фактический адрес</Label>
                <Input
                  id="actualAddress"
                  type="text"
                  value={formData.actualAddress}
                  onChange={(e) => handleInputChange('actualAddress', e.target.value)}
                  placeholder="Введите фактический адрес"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="directorName">ФИО директора</Label>
                <Input
                  id="directorName"
                  type="text"
                  value={formData.directorName}
                  onChange={(e) => handleInputChange('directorName', e.target.value)}
                  placeholder="Введите ФИО директора"
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="contactPhone">Контактный телефон</Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => handleInputChange('contactPhone', e.target.value)}
                  placeholder="+7 (999) 123-45-67"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="contactEmail">Контактный email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                  placeholder="contact@company.com"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="bankAccount">Расчетный счет</Label>
                <Input
                  id="bankAccount"
                  type="text"
                  value={formData.bankAccount}
                  onChange={(e) => handleInputChange('bankAccount', e.target.value)}
                  placeholder="Введите расчетный счет"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="bankName">Название банка</Label>
                <Input
                  id="bankName"
                  type="text"
                  value={formData.bankName}
                  onChange={(e) => handleInputChange('bankName', e.target.value)}
                  placeholder="Введите название банка"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="bankBik">БИК банка</Label>
                <Input
                  id="bankBik"
                  type="text"
                  value={formData.bankBik}
                  onChange={(e) => handleInputChange('bankBik', e.target.value)}
                  placeholder="Введите БИК банка"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="correspondentAccount">Корреспондентский счет</Label>
                <Input
                  id="correspondentAccount"
                  type="text"
                  value={formData.correspondentAccount}
                  onChange={(e) => handleInputChange('correspondentAccount', e.target.value)}
                  placeholder="Введите корреспондентский счет"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="companyDescription">Описание компании (необязательно)</Label>
                <Input
                  id="companyDescription"
                  type="text"
                  value={formData.companyDescription}
                  onChange={(e) => handleInputChange('companyDescription', e.target.value)}
                  placeholder="Краткое описание деятельности"
                  className="mt-1"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Регистрация...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Создать аккаунт
                </div>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Уже есть аккаунт?{' '}
              <Link href="/auth/signin" className="text-blue-600 hover:text-blue-500 font-medium">
                Войти
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

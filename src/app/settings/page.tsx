'use client'


import { toast } from '@/components/ui/use-toast'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Settings, Save, User, Bell, Shield, Database, Globe, LogOut, Clock, AlertTriangle, Wallet, FileText, Loader2 } from 'lucide-react'
import Layout from '@/components/layout'
import PageHeader from '@/components/page-header'
import { CompanyBrandingSettings } from '@/components/settings/CompanyBrandingSettings'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'

const userPrefsKey = (userId: string) => `manexa_user_prefs_${userId}`

const SETTINGS_TABS = [
  { key: 'profile', label: 'Профиль' },
  { key: 'company', label: 'Компания' },
  { key: 'notifications', label: 'Уведомления' },
  { key: 'security', label: 'Безопасность' },
  { key: 'system', label: 'Система' },
] as const
type SettingsTab = (typeof SETTINGS_TABS)[number]['key']

export default function SettingsPage() {
  const { data: session, update } = useSession()
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')
  const canManageCompany = ['OWNER', 'ADMIN'].includes((session?.user?.role as string) || '')
  const [settings, setSettings] = useState({
    name: '',
    companyName: '',
    email: '',
    phone: '',
    address: '',
    // Реквизиты компании
    companyRequisites: {
      legalName: '',
      inn: '',
      kpp: '',
      ogrn: '',
      legalAddress: '',
      actualAddress: '',
      bankAccount: '',
      bankName: '',
      bankBik: '',
      correspondentAccount: '',
      directorName: '',
      directorPosition: 'Генеральный директор',
      contactEmail: '',
      contactPhone: ''
    },
    notifications: {
      email: true,
      sms: false,
      push: true
    },
    security: {
      twoFactor: false,
      sessionTimeout: 30,
      passwordExpiry: 90
    }
  })

  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const router = useRouter()

  // Двухфакторная аутентификация (TOTP)
  const [twoFA, setTwoFA] = useState<{
    enabled: boolean
    init: { qrDataUrl: string; secret: string } | null
    disabling: boolean
    code: string
    busy: boolean
  }>({ enabled: false, init: null, disabling: false, code: '', busy: false })

  useEffect(() => {
    fetch('/api/2fa')
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((d) => setTwoFA((s) => ({ ...s, enabled: !!d.enabled })))
      .catch(() => {})
  }, [])

  const twoFAAction = async (action: string, extra?: Record<string, unknown>) => {
    const res = await fetch('/api/2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Ошибка')
    return data
  }

  const startEnable2FA = async () => {
    setTwoFA((s) => ({ ...s, busy: true }))
    try {
      const data = await twoFAAction('init')
      setTwoFA((s) => ({ ...s, init: { qrDataUrl: data.qrDataUrl, secret: data.secret }, code: '' }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setTwoFA((s) => ({ ...s, busy: false }))
    }
  }

  const confirmEnable2FA = async () => {
    setTwoFA((s) => ({ ...s, busy: true }))
    try {
      await twoFAAction('verify', { code: twoFA.code })
      toast.success('2FA включена')
      setTwoFA({ enabled: true, init: null, disabling: false, code: '', busy: false })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка')
      setTwoFA((s) => ({ ...s, busy: false }))
    }
  }

  const confirmDisable2FA = async () => {
    setTwoFA((s) => ({ ...s, busy: true }))
    try {
      await twoFAAction('disable', { code: twoFA.code })
      toast.success('2FA отключена')
      setTwoFA({ enabled: false, init: null, disabling: false, code: '', busy: false })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка')
      setTwoFA((s) => ({ ...s, busy: false }))
    }
  }
  
  // Настройки уведомлений о сроках
  const [deadlineSettings, setDeadlineSettings] = useState({
    deadlineReminderDays: 3,
    deadlineReminderEnabled: true,
    overdueNotifyEnabled: true,
    overdueNotifyManager: true,
    budgetWarningPercent: 80,
    budgetWarningEnabled: true,
    invoiceOverdueEnabled: true
  })
  const [loadingDeadlineSettings, setLoadingDeadlineSettings] = useState(true)
  const [savingDeadlineSettings, setSavingDeadlineSettings] = useState(false)

  // Загружаем данные пользователя при загрузке компонента
  useEffect(() => {
    if (session?.user) {
      setSettings(prev => ({
        ...prev,
        name: session.user.name || '',
        email: session.user.email || '',
        companyName: session.user.company?.name || '',
        phone: session.user.phone || '',
        address: session.user.address || '',
        // Загружаем реквизиты компании (если legalName не задан — показываем короткое название компании)
        companyRequisites: {
          legalName: session.user.company?.legalName || session.user.company?.name || '',
          inn: session.user.company?.inn || '',
          kpp: session.user.company?.kpp || '',
          ogrn: session.user.company?.ogrn || '',
          legalAddress: session.user.company?.legalAddress || '',
          actualAddress: session.user.company?.actualAddress || '',
          bankAccount: session.user.company?.bankAccount || '',
          bankName: session.user.company?.bankName || '',
          bankBik: session.user.company?.bankBik || '',
          correspondentAccount: session.user.company?.correspondentAccount || '',
          directorName: session.user.company?.directorName || '',
          directorPosition: session.user.company?.directorPosition || 'Генеральный директор',
          contactEmail: session.user.company?.contactEmail || '',
          contactPhone: session.user.company?.contactPhone || ''
        }
      }))
    }
  }, [session])

  useEffect(() => {
    if (!session?.user?.id || typeof window === 'undefined') return
    try {
      const saved = localStorage.getItem(userPrefsKey(session.user.id))
      if (saved) {
        const prefs = JSON.parse(saved)
        setSettings((prev) => ({
          ...prev,
          notifications: prefs.notifications ?? prev.notifications,
          security: prefs.security ?? prev.security,
        }))
      }
    } catch {
      // ignore invalid localStorage data
    }
  }, [session?.user?.id])

  // Загрузка настроек уведомлений о сроках
  useEffect(() => {
    const fetchDeadlineSettings = async () => {
      try {
        setLoadingDeadlineSettings(true)
        const res = await fetch('/api/notifications/settings')
        if (res.ok) {
          const data = await res.json()
          setDeadlineSettings({
            deadlineReminderDays: data.deadlineReminderDays ?? 3,
            deadlineReminderEnabled: data.deadlineReminderEnabled ?? true,
            overdueNotifyEnabled: data.overdueNotifyEnabled ?? true,
            overdueNotifyManager: data.overdueNotifyManager ?? true,
            budgetWarningPercent: data.budgetWarningPercent ?? 80,
            budgetWarningEnabled: data.budgetWarningEnabled ?? true,
            invoiceOverdueEnabled: data.invoiceOverdueEnabled ?? true
          })
        }
      } catch (error) {
        console.error('Error fetching deadline settings:', error)
      } finally {
        setLoadingDeadlineSettings(false)
      }
    }
    fetchDeadlineSettings()
  }, [])

  // Сохранение настроек уведомлений о сроках
  const handleSaveDeadlineSettings = async () => {
    try {
      setSavingDeadlineSettings(true)
      const res = await fetch('/api/notifications/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deadlineSettings)
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } else {
        const error = await res.json()
        toast.error(error.error || 'Ошибка сохранения')
      }
    } catch (error) {
      console.error('Error saving deadline settings:', error)
      toast.error('Ошибка сохранения настроек')
    } finally {
      setSavingDeadlineSettings(false)
    }
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      // Отправляем личные данные пользователя
      const userResponse = await fetch(`/api/users/${session?.user?.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: settings.name,
          email: settings.email,
          phone: settings.phone,
          address: settings.address
        }),
      })

      // Отправляем реквизиты компании (только при наличии прав)
      const companyResponse = canManageCompany ? await fetch(`/api/company/${session?.user?.companyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          legalName: settings.companyRequisites.legalName,
          inn: settings.companyRequisites.inn,
          kpp: settings.companyRequisites.kpp,
          ogrn: settings.companyRequisites.ogrn,
          legalAddress: settings.companyRequisites.legalAddress,
          actualAddress: settings.companyRequisites.actualAddress,
          bankAccount: settings.companyRequisites.bankAccount,
          bankName: settings.companyRequisites.bankName,
          bankBik: settings.companyRequisites.bankBik,
          correspondentAccount: settings.companyRequisites.correspondentAccount,
          directorName: settings.companyRequisites.directorName,
          directorPosition: settings.companyRequisites.directorPosition,
          contactEmail: settings.companyRequisites.contactEmail,
          contactPhone: settings.companyRequisites.contactPhone
        }),
      }) : null

      if (userResponse.ok && (!companyResponse || companyResponse.ok)) {
        const updatedUser = await userResponse.json()
        const updatedCompany = companyResponse ? await companyResponse.json() : null

        // Убираем логи для чистоты

        // Обновляем состояние из API ответа
        setSettings(prev => ({
          ...prev,
          name: updatedUser.name || prev.name,
          phone: updatedUser.phone || prev.phone,
          address: updatedUser.address || prev.address,
          companyName: updatedCompany?.company?.name || prev.companyName, // Обновляем название компании
          companyRequisites: {
            ...prev.companyRequisites,
            legalName: updatedCompany?.company?.legalName || prev.companyRequisites.legalName, // Исправлено: используем legalName, а не name
            inn: updatedCompany?.company?.inn || prev.companyRequisites.inn,
            kpp: updatedCompany?.company?.kpp || prev.companyRequisites.kpp,
            ogrn: updatedCompany?.company?.ogrn || prev.companyRequisites.ogrn,
            legalAddress: updatedCompany?.company?.legalAddress || prev.companyRequisites.legalAddress,
            actualAddress: updatedCompany?.company?.actualAddress || prev.companyRequisites.actualAddress,
            bankAccount: updatedCompany?.company?.bankAccount || prev.companyRequisites.bankAccount,
            bankName: updatedCompany?.company?.bankName || prev.companyRequisites.bankName,
            bankBik: updatedCompany?.company?.bankBik || prev.companyRequisites.bankBik,
            correspondentAccount: updatedCompany?.company?.correspondentAccount || prev.companyRequisites.correspondentAccount,
            directorName: updatedCompany?.company?.directorName || prev.companyRequisites.directorName,
            directorPosition: updatedCompany?.company?.directorPosition || prev.companyRequisites.directorPosition, // Добавляем directorPosition
            contactEmail: updatedCompany?.company?.contactEmail || prev.companyRequisites.contactEmail,
            contactPhone: updatedCompany?.company?.contactPhone || prev.companyRequisites.contactPhone
          }
        }))

        if (session?.user?.id) {
          localStorage.setItem(
            userPrefsKey(session.user.id),
            JSON.stringify({
              notifications: settings.notifications,
              security: settings.security,
            })
          )
        }

        // Обновляем сессию NextAuth
        await update()

        setSaved(true)
        setRefreshKey(prev => prev + 1) // Принудительно обновляем компонент
        setTimeout(() => setSaved(false), 3000)
      } else {
        const failed = userResponse.ok && companyResponse ? companyResponse : userResponse
        const errorData = await failed.json().catch(() => ({}))
        toast.error(`Ошибка при сохранении настроек: ${errorData.error || 'Неизвестная ошибка'}`)
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Ошибка при сохранении настроек')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    signOut({ callbackUrl: '/auth/signin' })
  }

  return (
    <Layout>
      <div key={refreshKey} className="space-y-6">
        <PageHeader
          title="Настройки"
          description="Профиль, компания и уведомления"
          actions={
            <>
              <Button
                variant="outline"
                onClick={handleLogout}
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Выйти
              </Button>
              {(activeTab === 'profile' || activeTab === 'company') && (
                <Button onClick={handleSave} disabled={loading}>
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Сохранение...' : 'Сохранить'}
                </Button>
              )}
            </>
          }
        />

        <div className="border-b border-gray-200">
          <nav className="flex gap-1 -mb-px overflow-x-auto">
            {SETTINGS_TABS.filter((t) => t.key !== 'company' || canManageCompany).map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === t.key
                    ? 'border-neutral-900 text-neutral-900'
                    : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {saved && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg animate-fade-in">
            <p className="text-green-800">Настройки успешно сохранены!</p>
          </div>
        )}

        <div className="space-y-6 max-w-4xl">
            {activeTab === 'profile' && (
            <>
            {/* Основная информация */}
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2 text-primary" />
                  Основная информация
                </CardTitle>
                <CardDescription>Настройки компании и контактной информации</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">ФИО</Label>
                  <Input
                    id="name"
                    value={settings.name}
                    onChange={(e) => setSettings({...settings, name: e.target.value})}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="companyName">Название компании</Label>
                  <Input
                    id="companyName"
                    value={settings.companyName}
                    onChange={(e) => setSettings({...settings, companyName: e.target.value})}
                    className="mt-1"
                    disabled
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={settings.email}
                    onChange={(e) => setSettings({...settings, email: e.target.value})}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Телефон</Label>
                  <Input
                    id="phone"
                    value={settings.phone}
                    onChange={(e) => setSettings({...settings, phone: e.target.value})}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="address">Адрес</Label>
                  <Input
                    id="address"
                    value={settings.address}
                    onChange={(e) => setSettings({...settings, address: e.target.value})}
                    className="mt-1"
                  />
                </div>
                <div className="pt-2 border-t">
                  <Label>Пароль</Label>
                  <p className="text-sm text-gray-500 mb-2">Смена пароля для входа в систему</p>
                  <Link href="/auth/change-password">
                    <Button variant="outline" size="sm">
                      <Shield className="h-4 w-4 mr-2" />
                      Сменить пароль
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
            </>
            )}

            {activeTab === 'notifications' && (
            <>
            {/* Уведомления о сроках */}
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="h-5 w-5 mr-2 text-primary" />
                  Автоматические уведомления о сроках
                </CardTitle>
                <CardDescription>Настройте автоматические напоминания о дедлайнах, бюджете и счетах</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingDeadlineSettings ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Дедлайны этапов */}
                    <div className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        Дедлайны этапов работ
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Напоминание о приближающемся дедлайне</Label>
                          <p className="text-sm text-gray-500">Уведомлять ответственного о скором окончании срока</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={deadlineSettings.deadlineReminderEnabled}
                          onChange={(e) => setDeadlineSettings({
                            ...deadlineSettings,
                            deadlineReminderEnabled: e.target.checked
                          })}
                          className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                        />
                      </div>
                      
                      {deadlineSettings.deadlineReminderEnabled && (
                        <div className="ml-4">
                          <Label htmlFor="reminderDays">За сколько дней напоминать</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <Input
                              id="reminderDays"
                              type="number"
                              min="1"
                              max="30"
                              value={deadlineSettings.deadlineReminderDays}
                              onChange={(e) => setDeadlineSettings({
                                ...deadlineSettings,
                                deadlineReminderDays: parseInt(e.target.value) || 3
                              })}
                              className="w-20"
                            />
                            <span className="text-sm text-gray-500">дней</span>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Уведомление о просроченных этапах</Label>
                          <p className="text-sm text-gray-500">Уведомлять ответственного о просрочке</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={deadlineSettings.overdueNotifyEnabled}
                          onChange={(e) => setDeadlineSettings({
                            ...deadlineSettings,
                            overdueNotifyEnabled: e.target.checked
                          })}
                          className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                        />
                      </div>
                      
                      {deadlineSettings.overdueNotifyEnabled && (
                        <div className="flex items-center justify-between ml-4">
                          <div>
                            <Label>Также уведомлять руководителя проекта</Label>
                            <p className="text-sm text-gray-500">Алерт руководителю о просрочке</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={deadlineSettings.overdueNotifyManager}
                            onChange={(e) => setDeadlineSettings({
                              ...deadlineSettings,
                              overdueNotifyManager: e.target.checked
                            })}
                            className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                          />
                        </div>
                      )}
                    </div>
                    
                    {/* Бюджет */}
                    <div className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <Wallet className="h-4 w-4 text-green-500" />
                        Бюджет проектов
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Предупреждение о расходе бюджета</Label>
                          <p className="text-sm text-gray-500">Уведомлять когда бюджет израсходован на определённый процент</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={deadlineSettings.budgetWarningEnabled}
                          onChange={(e) => setDeadlineSettings({
                            ...deadlineSettings,
                            budgetWarningEnabled: e.target.checked
                          })}
                          className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                        />
                      </div>
                      
                      {deadlineSettings.budgetWarningEnabled && (
                        <div className="ml-4">
                          <Label htmlFor="budgetPercent">Процент расхода для предупреждения</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <Input
                              id="budgetPercent"
                              type="number"
                              min="50"
                              max="100"
                              value={deadlineSettings.budgetWarningPercent}
                              onChange={(e) => setDeadlineSettings({
                                ...deadlineSettings,
                                budgetWarningPercent: parseInt(e.target.value) || 80
                              })}
                              className="w-20"
                            />
                            <span className="text-sm text-gray-500">%</span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Счета */}
                    <div className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <FileText className="h-4 w-4 text-blue-500" />
                        Счета и платежи
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Уведомление о просроченных счетах</Label>
                          <p className="text-sm text-gray-500">Напоминание об неоплаченных счетах</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={deadlineSettings.invoiceOverdueEnabled}
                          onChange={(e) => setDeadlineSettings({
                            ...deadlineSettings,
                            invoiceOverdueEnabled: e.target.checked
                          })}
                          className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                        />
                      </div>
                    </div>
                    
                    {/* Кнопка сохранения */}
                    <div className="flex justify-end pt-4 border-t">
                      <Button
                        onClick={handleSaveDeadlineSettings}
                        disabled={savingDeadlineSettings}
                      >
                        {savingDeadlineSettings ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Сохранение...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Сохранить настройки уведомлений
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            </>
            )}

            {activeTab === 'security' && (
            <>
            {/* Безопасность */}
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="h-5 w-5 mr-2 text-primary" />
                  Двухфакторная аутентификация
                </CardTitle>
                <CardDescription>
                  Дополнительная защита входа кодом из приложения-аутентификатора (Google Authenticator, 1Password и т.п.).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Статус */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Статус</Label>
                    <p className="text-sm text-gray-500">
                      {twoFA.enabled ? 'Включена — при входе запрашивается код' : 'Отключена'}
                    </p>
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      twoFA.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {twoFA.enabled ? 'Включена' : 'Выключена'}
                  </span>
                </div>

                {/* Включение: шаг 1 — кнопка */}
                {!twoFA.enabled && !twoFA.init && (
                  <Button onClick={startEnable2FA} disabled={twoFA.busy}>
                    {twoFA.busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Shield className="h-4 w-4 mr-2" />}
                    Включить 2FA
                  </Button>
                )}

                {/* Включение: шаг 2 — QR + код */}
                {!twoFA.enabled && twoFA.init && (
                  <div className="space-y-3 rounded-lg border p-4">
                    <p className="text-sm text-gray-700">
                      1. Отсканируйте QR в приложении-аутентификаторе:
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={twoFA.init.qrDataUrl} alt="QR 2FA" className="h-40 w-40" />
                    <p className="text-xs text-gray-500">
                      Или введите ключ вручную: <span className="font-mono">{twoFA.init.secret}</span>
                    </p>
                    <p className="text-sm text-gray-700">2. Введите 6-значный код из приложения:</p>
                    <div className="flex gap-2">
                      <Input
                        value={twoFA.code}
                        onChange={(e) => setTwoFA((s) => ({ ...s, code: e.target.value }))}
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="123456"
                        className="w-32"
                      />
                      <Button onClick={confirmEnable2FA} disabled={twoFA.busy || twoFA.code.length < 6}>
                        Подтвердить
                      </Button>
                      <Button variant="outline" onClick={() => setTwoFA((s) => ({ ...s, init: null, code: '' }))} disabled={twoFA.busy}>
                        Отмена
                      </Button>
                    </div>
                  </div>
                )}

                {/* Отключение */}
                {twoFA.enabled && !twoFA.disabling && (
                  <Button variant="outline" onClick={() => setTwoFA((s) => ({ ...s, disabling: true, code: '' }))}>
                    Отключить 2FA
                  </Button>
                )}
                {twoFA.enabled && twoFA.disabling && (
                  <div className="space-y-3 rounded-lg border p-4">
                    <p className="text-sm text-gray-700">Введите текущий код из приложения для отключения:</p>
                    <div className="flex gap-2">
                      <Input
                        value={twoFA.code}
                        onChange={(e) => setTwoFA((s) => ({ ...s, code: e.target.value }))}
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="123456"
                        className="w-32"
                      />
                      <Button variant="destructive" onClick={confirmDisable2FA} disabled={twoFA.busy || twoFA.code.length < 6}>
                        Отключить
                      </Button>
                      <Button variant="outline" onClick={() => setTwoFA((s) => ({ ...s, disabling: false, code: '' }))} disabled={twoFA.busy}>
                        Отмена
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            </>
            )}

            {activeTab === 'company' && canManageCompany && (
            <>
            {/* Реквизиты компании */}
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Database className="h-5 w-5 mr-2 text-primary" />
                  Реквизиты компании
                </CardTitle>
                <CardDescription>Юридические и банковские реквизиты для использования в договорах и документах</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Юридические реквизиты */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Юридические реквизиты</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="legalName">Полное наименование организации *</Label>
                      <Input
                        id="legalName"
                        value={settings.companyRequisites.legalName}
                        onChange={(e) => setSettings({
                          ...settings,
                          companyRequisites: {...settings.companyRequisites, legalName: e.target.value}
                        })}
                        placeholder="ООО 'Название компании'"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="inn">ИНН *</Label>
                      <Input
                        id="inn"
                        value={settings.companyRequisites.inn}
                        onChange={(e) => setSettings({
                          ...settings,
                          companyRequisites: {...settings.companyRequisites, inn: e.target.value}
                        })}
                        placeholder="123456789012"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="kpp">КПП</Label>
                      <Input
                        id="kpp"
                        value={settings.companyRequisites.kpp}
                        onChange={(e) => setSettings({
                          ...settings,
                          companyRequisites: {...settings.companyRequisites, kpp: e.target.value}
                        })}
                        placeholder="123401001"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="ogrn">ОГРН</Label>
                      <Input
                        id="ogrn"
                        value={settings.companyRequisites.ogrn}
                        onChange={(e) => setSettings({
                          ...settings,
                          companyRequisites: {...settings.companyRequisites, ogrn: e.target.value}
                        })}
                        placeholder="123456789012345"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Адреса */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Адреса</h4>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="legalAddress">Юридический адрес</Label>
                      <textarea
                        id="legalAddress"
                        rows={3}
                        value={settings.companyRequisites.legalAddress}
                        onChange={(e) => setSettings({
                          ...settings,
                          companyRequisites: {...settings.companyRequisites, legalAddress: e.target.value}
                        })}
                        placeholder="123456, г. Москва, ул. Ленина, д. 1, офис 101"
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <Label htmlFor="actualAddress">Фактический адрес</Label>
                      <textarea
                        id="actualAddress"
                        rows={3}
                        value={settings.companyRequisites.actualAddress}
                        onChange={(e) => setSettings({
                          ...settings,
                          companyRequisites: {...settings.companyRequisites, actualAddress: e.target.value}
                        })}
                        placeholder="123456, г. Москва, ул. Ленина, д. 1, офис 101"
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Банковские реквизиты */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Банковские реквизиты</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="bankAccount">Расчетный счет</Label>
                      <Input
                        id="bankAccount"
                        value={settings.companyRequisites.bankAccount}
                        onChange={(e) => setSettings({
                          ...settings,
                          companyRequisites: {...settings.companyRequisites, bankAccount: e.target.value}
                        })}
                        placeholder="40702810000000000001"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="bankName">Наименование банка</Label>
                      <Input
                        id="bankName"
                        value={settings.companyRequisites.bankName}
                        onChange={(e) => setSettings({
                          ...settings,
                          companyRequisites: {...settings.companyRequisites, bankName: e.target.value}
                        })}
                        placeholder="ПАО СБЕРБАНК"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="bankBik">БИК банка</Label>
                      <Input
                        id="bankBik"
                        value={settings.companyRequisites.bankBik}
                        onChange={(e) => setSettings({
                          ...settings,
                          companyRequisites: {...settings.companyRequisites, bankBik: e.target.value}
                        })}
                        placeholder="044525225"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="correspondentAccount">Корреспондентский счет</Label>
                      <Input
                        id="correspondentAccount"
                        value={settings.companyRequisites.correspondentAccount}
                        onChange={(e) => setSettings({
                          ...settings,
                          companyRequisites: {...settings.companyRequisites, correspondentAccount: e.target.value}
                        })}
                        placeholder="30101810400000000225"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Руководитель */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Руководитель</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="directorName">ФИО руководителя *</Label>
                      <Input
                        id="directorName"
                        value={settings.companyRequisites.directorName}
                        onChange={(e) => setSettings({
                          ...settings,
                          companyRequisites: {...settings.companyRequisites, directorName: e.target.value}
                        })}
                        placeholder="Иванов Иван Иванович"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="directorPosition">Должность</Label>
                      <Input
                        id="directorPosition"
                        value={settings.companyRequisites.directorPosition}
                        onChange={(e) => setSettings({
                          ...settings,
                          companyRequisites: {...settings.companyRequisites, directorPosition: e.target.value}
                        })}
                        placeholder="Генеральный директор"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="contactEmail">Email для договоров</Label>
                      <Input
                        id="contactEmail"
                        type="email"
                        value={settings.companyRequisites.contactEmail}
                        onChange={(e) => setSettings({
                          ...settings,
                          companyRequisites: {...settings.companyRequisites, contactEmail: e.target.value}
                        })}
                        placeholder="info@company.ru"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="contactPhone">Телефон для договоров</Label>
                      <Input
                        id="contactPhone"
                        value={settings.companyRequisites.contactPhone}
                        onChange={(e) => setSettings({
                          ...settings,
                          companyRequisites: {...settings.companyRequisites, contactPhone: e.target.value}
                        })}
                        placeholder="+7 (495) 123-45-67"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <CompanyBrandingSettings companyId={session?.user?.companyId} />
            </>
            )}

            {activeTab === 'system' && (
            <>
            {/* Система */}
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Database className="h-5 w-5 mr-2 text-primary" />
                  Система
                </CardTitle>
                <CardDescription>Информация о системе и базе данных</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-gray-500">Версия системы</Label>
                    <p className="font-medium">1.0.0</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">База данных</Label>
                    <p className="font-medium">PostgreSQL</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Последнее обновление</Label>
                    <p className="font-medium">Сегодня</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Статус</Label>
                    <p className="font-medium text-green-600">Активна</p>
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <Button variant="outline" className="w-full">
                    <Globe className="h-4 w-4 mr-2" />
                    Проверить обновления
                  </Button>
                </div>
              </CardContent>
            </Card>
            </>
            )}
        </div>
      </div>
    </Layout>
  )
}
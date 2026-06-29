'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Layout from '@/components/layout'
import { PermissionGuard } from '@/components/permission-guard'
import { ErrorBanner } from '@/components/ui/error-banner'
import { SkeletonList } from '@/components/ui/skeleton'
import {
  FolderOpen,
  FileText,
  DollarSign,
  Flag,
  CheckCircle,
  Activity,
  MessageSquare,
  ListChecks,
  AlertTriangle,
  History,
  ArrowRight,
  Plus,
  Clock,
} from 'lucide-react'

interface ActivityItem {
  id: string
  type: string
  action: string
  title: string
  subtitle?: string
  userName: string
  createdAt: Date
  icon: string
  color: string
}

interface MyTask {
  id: string
  title: string
  status: string
  dueDate: string | null
  projectName?: string
}

interface MyApproval {
  id: string
  title: string
  createdAt: string
}

interface AttentionProject {
  id: string
  name: string
  reason: string
  tone: 'danger' | 'warning' | 'muted'
  progress?: number
}

const fmtMoney = (n: number) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n) + ' ₽'

function greeting() {
  const h = new Date().getHours()
  if (h < 6) return 'Доброй ночи'
  if (h < 12) return 'Доброе утро'
  if (h < 18) return 'Добрый день'
  return 'Добрый вечер'
}

function dueBadge(dueDate: string | null): { label: string; tone: 'danger' | 'warning' | 'muted' } | null {
  if (!dueDate) return null
  const d = new Date(dueDate)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const due = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (due < today) return { label: 'Просрочена', tone: 'danger' }
  if (due.getTime() === today.getTime()) return { label: 'Сегодня', tone: 'warning' }
  return { label: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }), tone: 'muted' }
}

const TONE: Record<string, string> = {
  danger: 'bg-red-50 text-red-700',
  warning: 'bg-amber-50 text-amber-700',
  muted: 'bg-neutral-100 text-neutral-600',
}

export default function Dashboard() {
  const [userName, setUserName] = useState('')
  const [activeProjects, setActiveProjects] = useState(0)
  const [finance, setFinance] = useState({ receivedMonth: 0, receivable: 0, payable: 0 })
  const [myTasks, setMyTasks] = useState<MyTask[]>([])
  const [myApprovals, setMyApprovals] = useState<MyApproval[]>([])
  const [attention, setAttention] = useState<AttentionProject[]>([])
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadAll()
    fetchActivity()
  }, [])

  const loadAll = async () => {
    try {
      setError(null)
      const meRes = await fetch('/api/users/me')
      const me = meRes.ok ? await meRes.json() : null
      if (me?.name) setUserName(String(me.name).split(' ')[0])
      const myId = me?.id

      const [projectsRes, tasksRes, financeRes, approvalsRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/tasks'),
        fetch('/api/finance'),
        fetch('/api/approvals'),
      ])

      // Проекты
      const projectsData = projectsRes.ok ? await projectsRes.json() : { projects: [] }
      const projects = projectsData.projects || []
      setActiveProjects(projects.filter((p: any) => p.status === 'ACTIVE').length)

      const attn: AttentionProject[] = []
      for (const p of projects) {
        const fs = p.financialSummary
        const budget = Number(p.budget) || 0
        if (fs && budget > 0 && fs.expenses > budget) {
          attn.push({
            id: p.id,
            name: p.name,
            reason: `Перерасход · освоение ${Math.round((fs.expenses / budget) * 100)}%`,
            tone: 'danger',
            progress: Math.round((fs.expenses / budget) * 100),
          })
        }
      }
      setAttention(attn.slice(0, 4))

      // Финансы (по компании)
      const financeData = financeRes.ok ? await financeRes.json() : { finances: [] }
      const recs = financeData.finances || []
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      let receivedMonth = 0,
        receivable = 0,
        payable = 0
      for (const r of recs) {
        const amount = Number(r.amount) || 0
        if (r.type === 'INCOME' && r.isPaid && new Date(r.date) >= monthStart) receivedMonth += amount
        if (r.type === 'INCOME' && !r.isPaid) receivable += amount
        if (r.type === 'EXPENSE' && !r.isPaid) payable += amount
      }
      setFinance({ receivedMonth, receivable, payable })

      // Мои задачи
      const tasksData = tasksRes.ok ? await tasksRes.json() : { tasks: [] }
      const allTasks = tasksData.tasks || []
      const mine = allTasks
        .filter((t: any) => {
          if (t.status === 'COMPLETED' || t.status === 'CANCELLED') return false
          if (!myId) return false
          return (t.assignments || []).some((a: any) => (a.userId || a.user?.id) === myId)
        })
        .sort((a: any, b: any) => {
          const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
          const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
          return da - db
        })
        .slice(0, 5)
        .map((t: any) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          dueDate: t.dueDate,
          projectName: t.project?.name,
        }))
      setMyTasks(mine)

      // Согласования, ждущие меня
      const approvalsData = approvalsRes.ok ? await approvalsRes.json() : { approvals: [] }
      const allApprovals = approvalsData.approvals || []
      const pendingForMe = allApprovals
        .filter((ap: any) => {
          if (!['PENDING', 'IN_PROGRESS'].includes(ap.status)) return false
          if (!myId) return false
          return (ap.assignments || []).some(
            (a: any) => a.user?.id === myId && a.status === 'PENDING'
          )
        })
        .slice(0, 4)
        .map((ap: any) => ({ id: ap.id, title: ap.title, createdAt: ap.createdAt }))
      setMyApprovals(pendingForMe)
    } catch {
      setError('Ошибка при загрузке панели управления')
    } finally {
      setLoading(false)
    }
  }

  const fetchActivity = async () => {
    try {
      const response = await fetch('/api/activity?limit=8')
      if (response.ok) {
        const data = await response.json()
        setActivities(data.activities || [])
      }
    } catch (err) {
      console.error('Error fetching activity:', err)
    }
  }

  const getActivityIcon = (iconName: string) => {
    switch (iconName) {
      case 'FolderOpen': return FolderOpen
      case 'CheckCircle': return CheckCircle
      case 'FileText': return FileText
      case 'MessageSquare': return MessageSquare
      case 'DollarSign': return DollarSign
      default: return Activity
    }
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diff = Math.floor((now.getTime() - new Date(date).getTime()) / 1000)
    if (diff < 60) return 'Только что'
    if (diff < 3600) return `${Math.floor(diff / 60)} мин. назад`
    if (diff < 86400) return `${Math.floor(diff / 3600)} ч. назад`
    if (diff < 604800) return `${Math.floor(diff / 86400)} дн. назад`
    return new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  }

  const todayCount = myTasks.filter((t) => dueBadge(t.dueDate)?.tone === 'warning').length
  const overdueCount = myTasks.filter((t) => dueBadge(t.dueDate)?.tone === 'danger').length

  const quickActions = [
    { title: 'Создать проект', icon: FolderOpen, href: '/projects?create=1', permission: 'canCreateProjects' },
    { title: 'Добавить задачу', icon: Flag, href: '/tasks?create=1', permission: 'canCreateTasks' },
    { title: 'Загрузить документ', icon: FileText, href: '/documents', permission: 'canCreateDocuments' },
    { title: 'Финансы', icon: DollarSign, href: '/finance', permission: 'canViewFinances' },
  ]

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Панель управления</h1>
          </div>
          <SkeletonList rows={5} />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <ErrorBanner message={error} onDismiss={() => setError(null)} />

        {/* Приветствие + сводка дня */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {greeting()}{userName ? `, ${userName}` : ''}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
              {' · '}
              {overdueCount > 0 && <span className="text-red-600">{overdueCount} просрочено · </span>}
              {todayCount} задач на сегодня · {myApprovals.length} на согласовании
            </p>
          </div>
          <Link
            href="/projects?create=1"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Создать проект
          </Link>
        </div>

        {/* Финансовые показатели */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/finance" className="rounded-xl bg-white border border-border/70 shadow-sm p-4 hover:shadow-md transition-shadow">
            <div className="text-xs font-medium text-neutral-500">Получено за месяц</div>
            <div className="text-2xl font-bold text-neutral-900 mt-1.5 tabular-nums">{fmtMoney(finance.receivedMonth)}</div>
          </Link>
          <Link href="/finance" className="rounded-xl bg-white border border-border/70 shadow-sm p-4 hover:shadow-md transition-shadow">
            <div className="text-xs font-medium text-neutral-500">Не оплачено нам</div>
            <div className={`text-2xl font-bold mt-1.5 tabular-nums ${finance.receivable > 0 ? 'text-red-600' : 'text-neutral-900'}`}>{fmtMoney(finance.receivable)}</div>
          </Link>
          <Link href="/finance" className="rounded-xl bg-white border border-border/70 shadow-sm p-4 hover:shadow-md transition-shadow">
            <div className="text-xs font-medium text-neutral-500">К оплате</div>
            <div className="text-2xl font-bold text-neutral-900 mt-1.5 tabular-nums">{fmtMoney(finance.payable)}</div>
          </Link>
          <Link href="/projects" className="rounded-xl bg-white border border-border/70 shadow-sm p-4 hover:shadow-md transition-shadow">
            <div className="text-xs font-medium text-neutral-500">Активные проекты</div>
            <div className="text-2xl font-bold text-neutral-900 mt-1.5 tabular-nums">{activeProjects}</div>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Мои задачи */}
          <div className="rounded-xl bg-white border border-border/70 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-base font-semibold text-gray-900">
                <ListChecks className="h-5 w-5 text-neutral-500" /> Мои задачи
              </div>
              <span className="text-xs text-gray-500">{myTasks.length}</span>
            </div>
            {myTasks.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">Назначенных задач нет</p>
            ) : (
              myTasks.map((t) => {
                const b = dueBadge(t.dueDate)
                return (
                  <Link key={t.id} href={`/tasks/${t.id}`} className="flex items-center justify-between gap-3 py-2.5 border-t border-border/60 hover:bg-neutral-50 -mx-2 px-2 rounded transition-colors">
                    <div className="min-w-0">
                      <div className="text-sm text-neutral-900 truncate">{t.title}</div>
                      {t.projectName && <div className="text-xs text-gray-500 truncate">{t.projectName}</div>}
                    </div>
                    {b && <span className={`shrink-0 text-xs px-2 py-0.5 rounded-md ${TONE[b.tone]}`}>{b.label}</span>}
                  </Link>
                )
              })
            )}
            <Link href="/tasks" className="inline-flex items-center gap-1 text-sm text-neutral-700 hover:underline mt-3">
              Все задачи <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Требуют внимания */}
          <div className="rounded-xl bg-white border border-border/70 shadow-sm p-5">
            <div className="flex items-center gap-2 text-base font-semibold text-gray-900 mb-3">
              <AlertTriangle className="h-5 w-5 text-neutral-500" /> Требуют внимания
            </div>
            {attention.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">Всё в порядке</p>
            ) : (
              attention.map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`} className="block py-2.5 border-t border-border/60 hover:bg-neutral-50 -mx-2 px-2 rounded transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-neutral-900 truncate">{p.name}</span>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-md ${TONE[p.tone]}`}>Перерасход</span>
                  </div>
                  {typeof p.progress === 'number' && (
                    <>
                      <div className="h-1 rounded-full bg-neutral-100 mt-2 overflow-hidden">
                        <div className="h-full bg-red-500" style={{ width: `${Math.min(p.progress, 100)}%` }} />
                      </div>
                      <div className="text-xs text-gray-500 mt-1">Освоение бюджета {p.progress}%</div>
                    </>
                  )}
                </Link>
              ))
            )}
          </div>

          {/* Ждут согласования */}
          <div className="rounded-xl bg-white border border-border/70 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-base font-semibold text-gray-900">
                <CheckCircle className="h-5 w-5 text-neutral-500" /> Ждут согласования
              </div>
              {myApprovals.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{myApprovals.length}</span>
              )}
            </div>
            {myApprovals.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">Нет согласований на вас</p>
            ) : (
              myApprovals.map((ap) => (
                <Link key={ap.id} href="/approvals" className="flex items-center justify-between gap-3 py-2.5 border-t border-border/60 hover:bg-neutral-50 -mx-2 px-2 rounded transition-colors">
                  <div className="min-w-0">
                    <div className="text-sm text-neutral-900 truncate">{ap.title}</div>
                    <div className="text-xs text-gray-500">{new Date(ap.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</div>
                  </div>
                  <span className="shrink-0 text-xs text-neutral-500">Открыть</span>
                </Link>
              ))
            )}
          </div>

          {/* Активность */}
          <div className="rounded-xl bg-white border border-border/70 shadow-sm p-5">
            <div className="flex items-center gap-2 text-base font-semibold text-gray-900 mb-3">
              <History className="h-5 w-5 text-neutral-500" /> Активность
            </div>
            {activities.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">Пока нет активности</p>
            ) : (
              activities.map((a) => {
                const Icon = getActivityIcon(a.icon)
                return (
                  <div key={a.id} className="flex items-start gap-3 py-2 border-t border-border/60">
                    <div className="mt-0.5 h-7 w-7 shrink-0 rounded-lg bg-neutral-100 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-neutral-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-gray-700">
                        <span className="text-neutral-900 font-medium">{a.userName}</span> {a.action} «{a.title}»
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {formatTimeAgo(a.createdAt)}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Быстрые действия */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <PermissionGuard key={action.title} permission={action.permission as any}>
              <Link href={action.href} className="flex items-center gap-3 rounded-xl bg-white border border-border/70 shadow-sm p-4 hover:shadow-md transition-shadow">
                <div className="h-9 w-9 rounded-lg bg-neutral-100 flex items-center justify-center">
                  <action.icon className="h-5 w-5 text-neutral-700" />
                </div>
                <span className="text-sm font-medium text-neutral-900">{action.title}</span>
              </Link>
            </PermissionGuard>
          ))}
        </div>
      </div>
    </Layout>
  )
}

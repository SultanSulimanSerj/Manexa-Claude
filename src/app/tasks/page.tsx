'use client'


import { confirm } from '@/components/ui/confirm'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { PageSuspense } from '@/components/page-suspense'
import Layout from '@/components/layout'
import PageHeader from '@/components/page-header'
import { SkeletonList } from '@/components/ui/skeleton'
import { usePagination } from '@/components/ui/pagination'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorBanner } from '@/components/ui/error-banner'
import { AssigneeCombobox } from '@/components/assignee-combobox'
import { Plus, Search, Edit, Trash2, X, ArrowLeft, Flag, Check, MessageSquare, MoreVertical } from 'lucide-react'
import Link from 'next/link'

interface Task {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  dueDate: string | null
  project: { id: string; name: string } | null
  creator: { name: string }
  assignments: Array<{ user: { id: string; name: string } }>
  _count?: { comments: number; subtasks: number }
}

function TasksPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const projectIdFromUrl = searchParams?.get('projectId')
  
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [currentProject, setCurrentProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [projectFilter, setProjectFilter] = useState<string>(projectIdFromUrl || 'all')
  const [showModal, setShowModal] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'TODO',
    priority: 'MEDIUM',
    dueDate: '',
    projectId: projectIdFromUrl || '',
    assigneeIds: [] as string[]
  })
  const [segment, setSegment] = useState<'all' | 'mine' | 'open' | 'done'>('all')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/session').then((r) => (r.ok ? r.json() : null)).then((d) => setCurrentUserId(d?.user?.id || null)).catch(() => {})
    fetchTasks()
    fetchProjects()
    fetchUsers()
    if (projectIdFromUrl) {
      fetchCurrentProject()
      setProjectFilter(projectIdFromUrl)
    }
    if (searchParams?.get('create') === '1') {
      setShowModal(true)
    }
  }, [projectIdFromUrl, searchParams])

  const fetchCurrentProject = async () => {
    if (!projectIdFromUrl) return
    try {
      const response = await fetch(`/api/projects/${projectIdFromUrl}`, {
      })
      if (response.ok) {
        const data = await response.json()
        setCurrentProject(data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const fetchTasks = async () => {
    try {
      setLoadError(null)
      const response = await fetch('/api/tasks', {
      })
      if (response.ok) {
        const data = await response.json()
        setTasks(data.tasks || [])
      } else {
        const data = await response.json().catch(() => ({}))
        setLoadError(data.error || 'Не удалось загрузить задачи')
      }
    } catch {
      setLoadError('Ошибка при загрузке задач')
    } finally {
      setLoading(false)
    }
  }

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects', {
      })
      if (response.ok) {
        const data = await response.json()
        setProjects(data.projects || [])
      }
    } catch (err) {
      console.error(err)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users', {
      })
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleCreate = () => {
    setEditingTask(null)
    setFormData({
      title: '',
      description: '',
      status: 'TODO',
      priority: 'MEDIUM',
      dueDate: '',
      projectId: projectIdFromUrl || '',
      assigneeIds: []
    })
    setShowModal(true)
  }

  const handleEdit = (task: Task) => {
    setEditingTask(task)
    setFormData({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate?.split('T')[0] || '',
      projectId: task.project?.id || '',
      assigneeIds: []
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    try {
      const url = editingTask
        ? `/api/tasks/${editingTask.id}`
        : '/api/tasks'
      
      const method = editingTask ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          projectId: formData.projectId || null,
          dueDate: formData.dueDate || null,
          assigneeIds: formData.assigneeIds
        })
      })

      if (response.ok) {
        setShowModal(false)
        fetchTasks()
      } else {
        const data = await response.json().catch(() => ({}))
        setFormError(data.error || 'Не удалось сохранить задачу')
      }
    } catch (err) {
      console.error(err)
      setFormError('Ошибка сети. Проверьте подключение и попробуйте снова.')
    }
  }

  const handleDelete = async (id: string) => {
    if (!await confirm('Удалить задачу?')) return

    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchTasks()
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Чекбокс закрывает/переоткрывает задачу (оптимистично + PUT статуса)
  const toggleComplete = async (task: Task) => {
    const done = task.status === 'COMPLETED'
    const next = done ? 'TODO' : 'COMPLETED'
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)))
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: task.title, status: next }),
      })
    } catch {
      fetchTasks()
    }
  }

  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesProject = projectFilter === 'all' || !projectFilter || t.project?.id === projectFilter
    const done = t.status === 'COMPLETED'
    const matchesSegment =
      segment === 'all' ? true
      : segment === 'mine' ? t.assignments.some((a) => a.user.id === currentUserId)
      : segment === 'open' ? !done
      : done
    return matchesSearch && matchesProject && matchesSegment
  })

  // ——— 8a: группировка по срокам ———
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date(startOfToday); endOfToday.setDate(endOfToday.getDate() + 1)
  const bucketOf = (t: Task): 'overdue' | 'today' | 'later' => {
    if (t.status === 'COMPLETED' || !t.dueDate) return 'later'
    const d = new Date(t.dueDate)
    if (d < startOfToday) return 'overdue'
    if (d < endOfToday) return 'today'
    return 'later'
  }
  const groups: { key: 'overdue' | 'today' | 'later'; label: string; cls: string }[] = [
    { key: 'overdue', label: 'Просрочено', cls: 'bg-[#fdeef0] text-[#c0304a]' },
    { key: 'today', label: 'Сегодня', cls: 'bg-amber-50 text-amber-700' },
    { key: 'later', label: 'На неделе', cls: 'bg-neutral-50 text-neutral-500' },
  ]
  const overdueCount = tasks.filter((t) => bucketOf(t) === 'overdue').length
  const todayCount = tasks.filter((t) => bucketOf(t) === 'today').length

  const priorityMeta = (p: string): { label: string; dot: string; text: string } => {
    if (p === 'HIGH' || p === 'URGENT') return { label: 'Высокий', dot: 'bg-red-600', text: 'text-neutral-700' }
    if (p === 'MEDIUM') return { label: 'Средний', dot: 'bg-amber-500', text: 'text-neutral-700' }
    return { label: 'Низкий', dot: 'bg-green-600', text: 'text-neutral-700' }
  }
  const dueMeta = (t: Task): { label: string; cls: string } => {
    if (t.status === 'COMPLETED') return { label: 'Готово', cls: 'text-neutral-400' }
    if (!t.dueDate) return { label: '—', cls: 'text-neutral-400' }
    const d = new Date(t.dueDate); d.setHours(0, 0, 0, 0)
    const diff = Math.round((d.getTime() - startOfToday.getTime()) / 86400000)
    if (diff < 0) { const n = -diff; return { label: `−${n} ${n === 1 ? 'день' : n < 5 ? 'дня' : 'дней'}`, cls: 'text-red-600 font-semibold' } }
    if (diff === 0) return { label: 'сегодня', cls: 'text-amber-700 font-semibold' }
    return { label: new Date(t.dueDate).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }), cls: 'text-neutral-600' }
  }
  const initials = (name?: string) => (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'
  const AV_COLORS = ['bg-blue-600', 'bg-teal-600', 'bg-amber-600', 'bg-violet-600', 'bg-rose-600']

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      'TODO': 'К выполнению',
      'IN_PROGRESS': 'В работе',
      'COMPLETED': 'Завершена',
      'CANCELLED': 'Отменена'
    }
    return map[status] || status
  }

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      'TODO': 'bg-gray-50 text-gray-700 border-gray-200',
      'IN_PROGRESS': 'bg-blue-50 text-blue-700 border-blue-200',
      'COMPLETED': 'bg-green-50 text-green-700 border-green-200',
      'CANCELLED': 'bg-red-50 text-red-700 border-red-200'
    }
    return map[status] || 'bg-gray-50 text-gray-700'
  }

  const getPriorityColor = (priority: string) => {
    const map: Record<string, string> = {
      'HIGH': 'text-red-600',
      'MEDIUM': 'text-yellow-600',
      'LOW': 'text-green-600'
    }
    return map[priority] || 'text-gray-600'
  }

  const getPriorityText = (priority: string) => {
    const map: Record<string, string> = {
      'HIGH': 'Высокий',
      'MEDIUM': 'Средний',
      'LOW': 'Низкий'
    }
    return map[priority] || priority
  }

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <PageHeader title="Задачи" description="Загрузка..." />
          <SkeletonList rows={6} />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <ErrorBanner message={loadError} onDismiss={() => setLoadError(null)} />
        {/* шапка 8a */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[20px] font-bold text-neutral-900">
              {currentProject ? `Задачи · ${currentProject.name}` : 'Задачи'}
            </div>
            <div className="mt-0.5 text-[12.5px] tabular-nums text-neutral-400">
              {tasks.length} всего · {overdueCount} просрочено · {todayCount} на сегодня
            </div>
          </div>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> Новая задача
          </button>
        </div>

        {/* фильтры */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Поиск задач…"
              className="w-[280px] rounded-lg border border-neutral-200 bg-white py-[7px] pl-9 pr-3 text-[13px] text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div className="inline-flex rounded-lg bg-neutral-200/60 p-0.5">
            {([['all', 'Все'], ['mine', 'Мои'], ['open', 'Открытые'], ['done', 'Готово']] as const).map(([s, l]) => (
              <button
                key={s}
                onClick={() => setSegment(s)}
                className={`rounded-md px-3 py-1.5 text-[12.5px] transition-colors ${
                  segment === s ? 'bg-white font-semibold text-neutral-900 shadow-sm' : 'font-medium text-neutral-500 hover:text-neutral-700'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13px] text-neutral-700 focus:outline-none"
          >
            <option value="all">Проект: все</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* таблица с группировкой */}
        {filteredTasks.length === 0 ? (
          <EmptyState
            icon={Flag}
            title={tasks.length === 0 ? 'Пока нет задач' : 'Ничего не найдено'}
            description={tasks.length === 0 ? 'Создайте первую задачу, чтобы начать работу.' : 'Попробуйте изменить поиск или фильтры.'}
            action={tasks.length === 0 ? (
              <button onClick={handleCreate} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                <Plus className="h-4 w-4" /> Новая задача
              </button>
            ) : undefined}
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            {/* заголовок колонок */}
            <div className="grid grid-cols-[40px_2.4fr_1fr_0.9fr_1fr_0.8fr_44px] items-center border-b border-neutral-200 bg-neutral-50 px-4 text-[11.5px] font-semibold text-neutral-400">
              <div className="py-3" />
              <div className="py-3">Задача</div>
              <div className="py-3">Проект</div>
              <div className="py-3">Приоритет</div>
              <div className="py-3">Исполнители</div>
              <div className="py-3">Срок</div>
              <div />
            </div>

            {groups.map((g) => {
              const gtasks = filteredTasks.filter((t) => bucketOf(t) === g.key)
              if (gtasks.length === 0) return null
              return (
                <div key={g.key}>
                  <div className={`px-4 py-2 text-[12.5px] font-semibold ${g.cls}`}>{g.label} · {gtasks.length}</div>
                  {gtasks.map((t, idx) => {
                    const done = t.status === 'COMPLETED'
                    const pr = priorityMeta(t.priority)
                    const due = dueMeta(t)
                    const cc = t._count?.comments || 0
                    return (
                      <div
                        key={t.id}
                        onClick={() => router.push(`/tasks/${t.id}`)}
                        className={`group grid cursor-pointer grid-cols-[40px_2.4fr_1fr_0.9fr_1fr_0.8fr_44px] items-center border-t border-neutral-100 px-4 hover:bg-neutral-50 ${idx % 2 ? 'bg-[#fcfcfd]' : ''}`}
                      >
                        <div className="py-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleComplete(t) }}
                            className={`flex h-[18px] w-[18px] items-center justify-center rounded-md border transition-colors ${done ? 'border-green-700 bg-green-700' : 'border-neutral-300 hover:border-neutral-400'}`}
                            title={done ? 'Открыть задачу' : 'Закрыть задачу'}
                          >
                            {done && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                          </button>
                        </div>
                        <div className="min-w-0 py-3 pr-2">
                          <div className={`truncate text-[13.5px] font-semibold ${done ? 'text-neutral-400 line-through' : 'text-neutral-900'}`}>{t.title}</div>
                          {cc > 0 && (
                            <div className="mt-0.5 flex items-center gap-1 text-[11.5px] text-neutral-400">
                              <MessageSquare className="h-3 w-3" /> {cc}
                            </div>
                          )}
                        </div>
                        <div className="truncate py-3 pr-2 text-[12.5px] text-neutral-600">{t.project?.name || '—'}</div>
                        <div className="py-3">
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`h-[7px] w-[7px] rounded-full ${pr.dot}`} />
                            <span className={`text-[13px] ${pr.text}`}>{pr.label}</span>
                          </span>
                        </div>
                        <div className="py-3">
                          {t.assignments.length > 0 ? (
                            <div className="flex items-center">
                              {t.assignments.slice(0, 3).map((a, i) => (
                                <span
                                  key={i}
                                  className={`flex h-[26px] w-[26px] items-center justify-center rounded-full text-[9px] font-semibold text-white ring-2 ring-white ${AV_COLORS[i % AV_COLORS.length]}`}
                                  style={{ marginLeft: i ? -8 : 0 }}
                                  title={a.user.name}
                                >
                                  {initials(a.user.name)}
                                </span>
                              ))}
                              {t.assignments.length > 3 && <span className="ml-1 text-[11px] text-neutral-400">+{t.assignments.length - 3}</span>}
                            </div>
                          ) : <span className="text-[12.5px] text-neutral-300">—</span>}
                        </div>
                        <div className={`py-3 text-[12.5px] tabular-nums ${due.cls}`}>{due.label}</div>
                        <div className="flex justify-center py-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEdit(t) }}
                            className="text-neutral-300 opacity-0 hover:text-neutral-600 group-hover:opacity-100"
                            title="Изменить"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}

        {/* Modal */}
        <Dialog open={showModal} onOpenChange={(o) => { if (!o) { setShowModal(false); setFormError(null) } }}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-0">
            <DialogHeader className="border-b p-6 pb-4">
              <DialogTitle>
                {editingTask ? 'Редактировать задачу' : 'Создать задачу'}
              </DialogTitle>
            </DialogHeader>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {formError && (
                  <div role="alert" aria-live="assertive" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {formError}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Название *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Описание</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Статус</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="TODO">К выполнению</option>
                      <option value="IN_PROGRESS">В работе</option>
                      <option value="COMPLETED">Завершена</option>
                      <option value="CANCELLED">Отменена</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Приоритет</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({...formData, priority: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="LOW">Низкий</option>
                      <option value="MEDIUM">Средний</option>
                      <option value="HIGH">Высокий</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Проект</label>
                    <select
                      value={formData.projectId}
                      onChange={(e) => setFormData({...formData, projectId: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Без проекта</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Срок выполнения</label>
                    <input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Исполнители</label>
                  <AssigneeCombobox
                    users={users}
                    value={formData.assigneeIds}
                    onChange={(assigneeIds) => setFormData({ ...formData, assigneeIds })}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
                  >
                    {editingTask ? 'Сохранить' : 'Создать'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); setFormError(null) }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                  >
                    Отмена
                  </button>
                </div>
              </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  )
}

export default function TasksPage() {
  return (
    <PageSuspense>
      <TasksPageContent />
    </PageSuspense>
  )
}
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
import { Plus, Search, Edit, Trash2, Users, X, FolderOpen, MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import Link from 'next/link'
import { InnLookupField } from '@/components/counterparty/InnLookupField'
import { toClientRequisitesFields } from '@/lib/counterparty/map-fields'
import { ClientFilterCombobox, type ClientOption } from '@/components/client-filter-combobox'

interface Project {
  id: string
  name: string
  description: string | null
  status: string
  priority: string
  budget: number | null
  startDate: string | null
  endDate: string | null
  User: { name: string | null }
  ProjectUser: Array<{ User: { id: string; name: string | null } }>
  _count: { tasks: number; documents: number; users: number }
  // Реквизиты клиента
  clientName?: string | null
  clientLegalName?: string | null
  clientInn?: string | null
  clientKpp?: string | null
  clientOgrn?: string | null
  clientLegalAddress?: string | null
  clientActualAddress?: string | null
  clientDirectorName?: string | null
  clientContactPhone?: string | null
  clientContactEmail?: string | null
  clientBankAccount?: string | null
  clientBankName?: string | null
  clientBankBik?: string | null
  clientCorrespondentAccount?: string | null
  financialSummary?: {
    income: number
    plannedIncome: number
    expenses: number
    profit: number
    margin: number
  }
}

function ProjectsPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [clientId, setClientId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'PLANNING',
    priority: 'MEDIUM',
    budget: '',
    startDate: '',
    endDate: '',
    // Реквизиты клиента
    clientName: '',
    clientLegalName: '',
    clientInn: '',
    clientKpp: '',
    clientOgrn: '',
    clientLegalAddress: '',
    clientActualAddress: '',
    clientDirectorName: '',
    clientContactPhone: '',
    clientContactEmail: '',
    clientBankAccount: '',
    clientBankName: '',
    clientBankBik: '',
    clientCorrespondentAccount: ''
  })

  useEffect(() => {
    fetchProjects()
    if (searchParams?.get('create') === '1') {
      setShowModal(true)
    }
  }, [searchParams])

  const fetchProjects = async () => {
    try {
      setLoadError(null)
      const response = await fetch('/api/projects', {
      })
      if (response.ok) {
        const data = await response.json()
        setProjects(data.projects || [])
      } else {
        const data = await response.json().catch(() => ({}))
        setLoadError(data.error || 'Не удалось загрузить проекты')
      }
    } catch {
      setLoadError('Ошибка при загрузке проектов')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingProject(null)
    setError(null)
    setFormData({
      name: '',
      description: '',
      status: 'PLANNING',
      priority: 'MEDIUM',
      budget: '',
      startDate: '',
      endDate: '',
      // Реквизиты клиента
      clientName: '',
      clientLegalName: '',
      clientInn: '',
      clientKpp: '',
      clientOgrn: '',
      clientLegalAddress: '',
      clientActualAddress: '',
      clientDirectorName: '',
      clientContactPhone: '',
      clientContactEmail: '',
      clientBankAccount: '',
      clientBankName: '',
      clientBankBik: '',
      clientCorrespondentAccount: ''
    })
    setShowModal(true)
  }

  const handleEdit = (project: Project) => {
    setEditingProject(project)
    setFormData({
      name: project.name,
      description: project.description || '',
      status: project.status,
      priority: project.priority,
      budget: project.budget?.toString() || '',
      startDate: project.startDate?.split('T')[0] || '',
      endDate: project.endDate?.split('T')[0] || '',
      clientName: project.clientName || '',
      clientLegalName: project.clientLegalName || '',
      clientInn: project.clientInn || '',
      clientKpp: project.clientKpp || '',
      clientOgrn: project.clientOgrn || '',
      clientLegalAddress: project.clientLegalAddress || '',
      clientActualAddress: project.clientActualAddress || '',
      clientDirectorName: project.clientDirectorName || '',
      clientContactPhone: project.clientContactPhone || '',
      clientContactEmail: project.clientContactEmail || '',
      clientBankAccount: project.clientBankAccount || '',
      clientBankName: project.clientBankName || '',
      clientBankBik: project.clientBankBik || '',
      clientCorrespondentAccount: project.clientCorrespondentAccount || ''
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    
    try {
      const url = editingProject 
        ? `/api/projects/${editingProject.id}`
        : '/api/projects'
      
      const method = editingProject ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (response.ok) {
        setShowModal(false)
        setError(null)
        fetchProjects()
      } else {
        setError(data.error || 'Ошибка при создании проекта')
        console.error('Ошибка при создании проекта:', data)
      }
    } catch (err: any) {
      console.error('Ошибка при отправке запроса:', err)
      setError(err.message || 'Произошла ошибка при отправке запроса')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!await confirm('Удалить проект?')) return

    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchProjects()
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Ключ контрагента проекта: ИНН (если есть), иначе название. Проекты без клиента — null.
  const clientKey = (p: Project): string | null => {
    const inn = p.clientInn?.trim()
    if (inn) return `inn:${inn}`
    const name = (p.clientName || p.clientLegalName)?.trim()
    return name ? `name:${name.toLowerCase()}` : null
  }

  // Список контрагентов из загруженных проектов + счётчики
  const clientOptions: ClientOption[] = (() => {
    const map = new Map<string, ClientOption>()
    for (const p of projects) {
      const key = clientKey(p)
      if (!key) continue
      const existing = map.get(key)
      if (existing) {
        existing.count++
      } else {
        map.set(key, {
          id: key,
          name: (p.clientName || p.clientLegalName || 'Без названия').trim(),
          inn: p.clientInn?.trim() || null,
          count: 1,
        })
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  })()

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter
    const matchesPriority = priorityFilter === 'all' || p.priority === priorityFilter
    const matchesClient = !clientId || clientKey(p) === clientId
    return matchesSearch && matchesStatus && matchesPriority && matchesClient
  })

  const activeCount = projects.filter((p) => p.status === 'ACTIVE').length

  const { pageItems: pagedProjects, Pagination } = usePagination(filteredProjects, 20)

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      'PLANNING': 'Планирование',
      'ACTIVE': 'Активный',
      'COMPLETED': 'Завершен',
      'ON_HOLD': 'Приостановлен',
      'CANCELLED': 'Отменен'
    }
    return map[status] || status
  }

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      'PLANNING': 'bg-blue-50 text-blue-700 border-blue-200',
      'ACTIVE': 'bg-green-50 text-green-700 border-green-200',
      'COMPLETED': 'bg-neutral-100 text-neutral-600 border-neutral-200',
      'ON_HOLD': 'bg-amber-50 text-amber-700 border-amber-200',
      'CANCELLED': 'bg-red-50 text-red-700 border-red-200'
    }
    return map[status] || 'bg-neutral-100 text-neutral-600 border-neutral-200'
  }

  // Приоритет: цветная точка + подпись (дизайн-хендофф)
  const getPriorityMeta = (priority: string) => {
    const map: Record<string, { label: string; dot: string }> = {
      'HIGH': { label: 'Высокий', dot: 'bg-red-600' },
      'MEDIUM': { label: 'Средний', dot: 'bg-amber-600' },
      'LOW': { label: 'Низкий', dot: 'bg-green-600' },
    }
    return map[priority] || { label: priority, dot: 'bg-neutral-400' }
  }

  // Деньги: ru-RU формат, ноль/нет данных → «—»
  const fmtMoney = (v: number | undefined | null) =>
    v && v !== 0 ? `${new Intl.NumberFormat('ru-RU').format(v)} ₽` : '—'

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '—'

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <PageHeader title="Проекты" description="Загрузка..." />
          <SkeletonList rows={6} />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <ErrorBanner message={loadError} onDismiss={() => setLoadError(null)} />
        <PageHeader
          title="Проекты"
          description={`${projects.length} проектов · ${activeCount} активных`}
          actions={
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Создать проект
            </button>
          }
        />

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-full sm:w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Поиск проектов..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-white py-[7px] pl-9 pr-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-neutral-200 bg-white px-[11px] py-[7px] text-[13px] focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">Все статусы</option>
            <option value="PLANNING">Планирование</option>
            <option value="ACTIVE">Активный</option>
            <option value="ON_HOLD">Приостановлен</option>
            <option value="COMPLETED">Завершен</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded-lg border border-neutral-200 bg-white px-[11px] py-[7px] text-[13px] focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">Приоритет</option>
            <option value="HIGH">Высокий</option>
            <option value="MEDIUM">Средний</option>
            <option value="LOW">Низкий</option>
          </select>
          {clientOptions.length > 0 && (
            <ClientFilterCombobox
              clients={clientOptions}
              value={clientId}
              onChange={setClientId}
              totalCount={projects.length}
            />
          )}
        </div>

        {/* Table */}
        {filteredProjects.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title={projects.length === 0 ? 'Пока нет проектов' : 'Ничего не найдено'}
            description={
              projects.length === 0
                ? 'Создайте первый проект, чтобы начать работу.'
                : 'Попробуйте изменить поиск или фильтры.'
            }
            action={
              projects.length === 0 ? (
                <button
                  onClick={handleCreate}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Создать проект
                </button>
              ) : undefined
            }
          />
        ) : (
        <div className="bg-white rounded-xl border border-border/70 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[11.5px] font-semibold text-neutral-400 min-w-[240px]">Проект</th>
                  <th className="px-3 py-2.5 text-left text-[11.5px] font-semibold text-neutral-400 w-[130px]">Статус</th>
                  <th className="px-3 py-2.5 text-left text-[11.5px] font-semibold text-neutral-400 w-[120px]">Приоритет</th>
                  <th className="px-3 py-2.5 text-right text-[11.5px] font-semibold text-neutral-400 w-[130px]">Доходы</th>
                  <th className="px-3 py-2.5 text-right text-[11.5px] font-semibold text-neutral-400 w-[130px]">Расходы</th>
                  <th className="px-3 py-2.5 text-right text-[11.5px] font-semibold text-neutral-400 w-[130px]">Прибыль</th>
                  <th className="px-3 py-2.5 text-center text-[11.5px] font-semibold text-neutral-400 w-[70px]">Задачи</th>
                  <th className="px-3 py-2.5 text-left text-[11.5px] font-semibold text-neutral-400 w-[90px]">Срок</th>
                  <th className="w-12" aria-label="Действия" />
                </tr>
              </thead>
              <tbody>
                {pagedProjects.map((project) => {
                  const fs = project.financialSummary
                  const prio = getPriorityMeta(project.priority)
                  return (
                    <tr
                      key={project.id}
                      onClick={() => router.push(`/projects/${project.id}`)}
                      className="group cursor-pointer border-t border-neutral-100 transition-colors hover:bg-neutral-50"
                    >
                      <td className="px-3 py-3">
                        <div className="min-w-0">
                          <div className="truncate text-[13.5px] font-semibold text-neutral-900">{project.name}</div>
                          {(project.clientName || project.description) && (
                            <div className="truncate text-xs text-neutral-400">
                              {project.clientName || project.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-[7px] border px-[9px] py-[3px] text-xs font-medium ${getStatusColor(project.status)}`}>
                          {getStatusText(project.status)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-neutral-600">
                          <span className={`h-[7px] w-[7px] rounded-full ${prio.dot}`} />
                          {prio.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right text-[13px] text-neutral-700 tabular-nums">
                        {fmtMoney(fs?.income)}
                      </td>
                      <td className="px-3 py-3 text-right text-[13px] text-neutral-700 tabular-nums">
                        {fmtMoney(fs?.expenses)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {fs && fs.profit !== 0 ? (
                          <span className={`text-[13px] font-semibold ${fs.profit > 0 ? 'text-green-700' : 'text-red-600'}`}>
                            {fs.profit > 0 ? '+' : '−'}{new Intl.NumberFormat('ru-RU').format(Math.abs(fs.profit))} ₽
                          </span>
                        ) : (
                          <span className="text-[13px] text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center text-[13px] text-neutral-700">{project._count.tasks}</td>
                      <td className="px-3 py-3 text-[12.5px] text-neutral-600 whitespace-nowrap">{fmtDate(project.endDate)}</td>
                      <td className="px-2 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[7px] text-neutral-500 opacity-0 transition-opacity hover:bg-neutral-100 focus-visible:opacity-100 group-hover:opacity-100"
                              aria-label={`Действия: ${project.name}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(project)}>
                              <Edit className="h-4 w-4 text-neutral-400" />
                              Редактировать
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(project.id)}
                              className="text-red-600 focus:bg-red-50 focus:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                              Удалить
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination />
        </div>
        )}

        {/* Modal */}
        <Dialog
          open={showModal}
          onOpenChange={(o) => {
            if (!o) {
              setShowModal(false)
              setError(null)
            }
          }}
        >
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-0">
            <DialogHeader className="border-b p-6 pb-4">
              <DialogTitle>
                {editingProject ? 'Редактировать проект' : 'Создать проект'}
              </DialogTitle>
            </DialogHeader>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {error && (
                  <div role="alert" aria-live="assertive" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Название *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
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
                      <option value="PLANNING">Планирование</option>
                      <option value="ACTIVE">Активный</option>
                      <option value="ON_HOLD">Приостановлен</option>
                      <option value="COMPLETED">Завершен</option>
                      <option value="CANCELLED">Отменен</option>
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Бюджет (₽)</label>
                  <input
                    type="number"
                    value={formData.budget}
                    onChange={(e) => setFormData({...formData, budget: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    💡 Бюджет будет автоматически добавлен как планируемый доход в финансовые записи
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Дата начала</label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Дата окончания</label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                {/* Клиент по ИНН — реквизиты подтягиваются автоматически */}
                <div className="border-t pt-4">
                  <InnLookupField
                    variant="native"
                    label="Клиент — ИНН"
                    value={formData.clientInn}
                    onChange={(clientInn) => setFormData({ ...formData, clientInn })}
                    onFound={(data) => {
                      setFormData((prev) => ({
                        ...prev,
                        ...toClientRequisitesFields(data),
                      }))
                    }}
                    placeholder="1234567890"
                  />
                  {(formData.clientName || formData.clientLegalName) && (
                    <div className="mt-2 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                      <svg className="mt-0.5 h-4 w-4 shrink-0 text-green-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-[12.5px] text-green-800">
                        <span className="font-semibold">{formData.clientLegalName || formData.clientName}</span>
                        {formData.clientKpp && ` · КПП ${formData.clientKpp}`}
                      </p>
                    </div>
                  )}
                  <p className="mt-1.5 text-xs text-neutral-400">
                    Реквизиты подтянутся автоматически. Редактировать — на карточке проекта, вкладка «Реквизиты».
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Сохранение...' : (editingProject ? 'Сохранить' : 'Создать')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false)
                      setError(null)
                    }}
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

export default function ProjectsPage() {
  return (
    <PageSuspense>
      <ProjectsPageContent />
    </PageSuspense>
  )
}
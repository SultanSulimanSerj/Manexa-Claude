'use client'


import { confirm } from '@/components/ui/confirm'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { PageSuspense } from '@/components/page-suspense'
import Layout from '@/components/layout'
import PageHeader from '@/components/page-header'
import { SkeletonList } from '@/components/ui/skeleton'
import { usePagination } from '@/components/ui/pagination'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorBanner } from '@/components/ui/error-banner'
import { Plus, Search, Edit, Trash2, Users, X, FolderOpen } from 'lucide-react'
import Link from 'next/link'
import { InnLookupField } from '@/components/counterparty/InnLookupField'
import { toClientRequisitesFields } from '@/lib/counterparty/map-fields'

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
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [showClientRequisites, setShowClientRequisites] = useState(false)
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
    setShowClientRequisites(false)
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
    setShowClientRequisites(true) // При редактировании показываем реквизиты клиента
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
        setShowClientRequisites(false)
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

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter
    return matchesSearch && matchesStatus
  })

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
      'COMPLETED': 'bg-gray-50 text-gray-700 border-gray-200',
      'ON_HOLD': 'bg-yellow-50 text-yellow-700 border-yellow-200',
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
          description={`${projects.length} проектов`}
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
        <div className="bg-white rounded-lg p-4 border">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск проектов..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Все статусы</option>
              <option value="PLANNING">Планирование</option>
              <option value="ACTIVE">Активный</option>
              <option value="COMPLETED">Завершен</option>
            </select>
          </div>
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
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Проект</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">План. доход</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Доходы</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Расходы</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Прибыль</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Задачи</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Команда</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pagedProjects.map((project) => {
                  const fs = project.financialSummary
                  return (
                    <tr key={project.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Link 
                              href={`/projects/${project.id}`}
                              className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {project.name}
                            </Link>
                            <span className={`text-xs font-bold ${getPriorityColor(project.priority)}`}>●</span>
                          </div>
                          {project.description && (
                            <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{project.description}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getStatusColor(project.status)}`}>
                          {getStatusText(project.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm font-medium text-blue-600">
                          {fs && fs.plannedIncome > 0 ? `${fs.plannedIncome.toLocaleString()}` : '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm font-medium text-green-600">
                          {fs && fs.income > 0 ? `+${fs.income.toLocaleString()}` : '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm font-medium text-red-600">
                          {fs && fs.expenses > 0 ? `-${fs.expenses.toLocaleString()}` : '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className={`text-sm font-semibold ${fs && fs.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {fs ? fs.profit.toLocaleString() : '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="text-sm text-gray-900">{project._count.tasks}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Users className="h-3 w-3 text-gray-400" />
                          <span className="text-sm text-gray-900">{project._count.users}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={() => handleEdit(project)}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded" 
                            title="Редактировать"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(project.id)}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded" 
                            title="Удалить"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
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
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Название *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Описание</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Статус</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Дата окончания</label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Реквизиты клиента */}
                <div className="border-t pt-6">
                  <button
                    type="button"
                    onClick={() => setShowClientRequisites(!showClientRequisites)}
                    className="flex items-center justify-between w-full text-left mb-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Реквизиты клиента</h3>
                      <p className="text-sm text-gray-500">Дополнительная информация о клиенте (необязательно)</p>
                    </div>
                    <div className="flex items-center">
                      {showClientRequisites ? (
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                  
                  {showClientRequisites && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Название клиента</label>
                      <input
                        type="text"
                        value={formData.clientName}
                        onChange={(e) => setFormData({...formData, clientName: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="ООО 'Название компании'"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Полное юридическое наименование</label>
                      <input
                        type="text"
                        value={formData.clientLegalName}
                        onChange={(e) => setFormData({...formData, clientLegalName: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Общество с ограниченной ответственностью..."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <InnLookupField
                      variant="native"
                      label="ИНН"
                      value={formData.clientInn}
                      onChange={(clientInn) => setFormData({ ...formData, clientInn })}
                      onFound={(data) => {
                        setShowClientRequisites(true)
                        setFormData((prev) => ({
                          ...prev,
                          ...toClientRequisitesFields(data),
                        }))
                      }}
                      placeholder="1234567890"
                    />

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">КПП</label>
                      <input
                        type="text"
                        value={formData.clientKpp}
                        onChange={(e) => setFormData({...formData, clientKpp: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="123456789"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">ОГРН</label>
                      <input
                        type="text"
                        value={formData.clientOgrn}
                        onChange={(e) => setFormData({...formData, clientOgrn: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="1234567890123"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Юридический адрес</label>
                      <textarea
                        value={formData.clientLegalAddress}
                        onChange={(e) => setFormData({...formData, clientLegalAddress: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={2}
                        placeholder="г. Москва, ул. Примерная, д. 1, офис 101"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Фактический адрес</label>
                      <textarea
                        value={formData.clientActualAddress}
                        onChange={(e) => setFormData({...formData, clientActualAddress: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={2}
                        placeholder="г. Москва, ул. Фактическая, д. 2, офис 201"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">ФИО директора</label>
                      <input
                        type="text"
                        value={formData.clientDirectorName}
                        onChange={(e) => setFormData({...formData, clientDirectorName: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Иванов Иван Иванович"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Телефон</label>
                      <input
                        type="text"
                        value={formData.clientContactPhone}
                        onChange={(e) => setFormData({...formData, clientContactPhone: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="+7 (495) 123-45-67"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={formData.clientContactEmail}
                      onChange={(e) => setFormData({...formData, clientContactEmail: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="info@company.ru"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Расчетный счет</label>
                      <input
                        type="text"
                        value={formData.clientBankAccount}
                        onChange={(e) => setFormData({...formData, clientBankAccount: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="40702810000000000001"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Наименование банка</label>
                      <input
                        type="text"
                        value={formData.clientBankName}
                        onChange={(e) => setFormData({...formData, clientBankName: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="ПАО СБЕРБАНК"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">БИК банка</label>
                      <input
                        type="text"
                        value={formData.clientBankBik}
                        onChange={(e) => setFormData({...formData, clientBankBik: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="044525225"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Корреспондентский счет</label>
                      <input
                        type="text"
                        value={formData.clientCorrespondentAccount}
                        onChange={(e) => setFormData({...formData, clientCorrespondentAccount: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="30101810000000000225"
                      />
                    </div>
                  </div>

                      <p className="text-xs text-gray-500 mt-4">
                        💡 Эти данные будут автоматически использоваться в договорах, сметах и других документах проекта
                      </p>
                    </div>
                  )}
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
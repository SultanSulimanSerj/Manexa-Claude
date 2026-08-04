'use client'

import { useState, useEffect } from 'react'
import Layout from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { confirm } from '@/components/ui/confirm'
import { toast } from '@/components/ui/use-toast'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, CheckCircle, X, Clock, XCircle, FileText, Users, Calendar, MessageSquare, Paperclip, History, AlertCircle, Eye, Trash2, Search, ChevronDown, MoreHorizontal, Check, Package, Wrench, CornerUpLeft } from 'lucide-react'
import ExpandableDescription from '@/components/expandable-description'
import ApprovalProgress from '@/components/approval-progress'
import { ErrorBanner } from '@/components/ui/error-banner'
import PageHeader from '@/components/page-header'
import { SkeletonList } from '@/components/ui/skeleton'

// Обновленные интерфейсы с новыми полями
interface Approval {
  id: string
  title: string
  description: string | null
  status: string
  type: string
  data?: { kind?: string; amount?: number | string; [k: string]: any } | null
  priority: string
  dueDate: string | null
  createdAt: string
  approvedAt: string | null
  rejectedAt: string | null
  requireAllApprovals: boolean
  autoPublishOnApproval: boolean
  document: { id: string; title: string; isPublished: boolean } | null
  project: { id: string; name: string } | null
  creator: { name: string }
  assignments: Array<{
    id: string
    user: { id: string; name: string; email: string }
    status: string
    role: string
    comment: string | null
    respondedAt: string | null
  }>
  comments: Array<{
    id: string
    content: string
    createdAt: string
    user: { name: string }
  }>
  attachments: Array<{
    id: string
    fileName: string
    fileSize: number
    mimeType: string
    createdAt: string
    user: { name: string }
  }>
  _count: {
    comments: number
    attachments: number
  }
}

interface Project {
  id: string
  name: string
}

interface Document {
  id: string
  title: string
  isPublished: boolean
  projectId?: string | null
  project?: { id: string; name: string } | null
}

interface User {
  id: string
  name: string
  email: string
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; email: string } | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [projectFilter, setProjectFilter] = useState('all')
  // 4c — реестр
  const [segment, setSegment] = useState<'all' | 'mine' | 'inwork' | 'approved' | 'rejected'>('all')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'material' | 'installation' | 'works' | 'document'>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showCommentsModal, setShowCommentsModal] = useState(false)
  const [showAttachmentsModal, setShowAttachmentsModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [attachments, setAttachments] = useState<any[]>([])
  const [uploadingFile, setUploadingFile] = useState(false)
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null)
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    type: 'DOCUMENT',
    priority: 'MEDIUM',
    dueDate: '',
    requireAllApprovals: false,
    autoPublishOnApproval: true,
    projectId: '',
    documentId: '',
    assigneeIds: [] as string[],
    roles: {} as Record<string, string>
  })
  const [createFormFiles, setCreateFormFiles] = useState<File[]>([])
  const [uploadingCreateFiles, setUploadingCreateFiles] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [commentLoading, setCommentLoading] = useState(false)

  useEffect(() => {
    fetchCurrentUser()
    fetchApprovals()
    fetchProjects()
    fetchDocuments()
    fetchUsers()

    // Открытие модалки создания из редактора документа: /approvals?create=1&documentId=...
    const params = new URLSearchParams(window.location.search)
    if (params.get('create') === '1') {
      const documentId = params.get('documentId') || ''
      const title = params.get('title') || ''
      setCreateForm((prev) => ({
        ...prev,
        type: 'DOCUMENT',
        documentId,
        title: title ? `Согласование: ${title}` : prev.title,
      }))
      setShowCreateModal(true)
      // Чистим query, чтобы модалка не открывалась повторно при обновлении
      window.history.replaceState({}, '', '/approvals')
    }
  }, [])

  // Когда документы загрузились, подставляем проект предвыбранного документа
  useEffect(() => {
    if (!createForm.documentId || createForm.projectId) return
    const doc = documents.find((d) => d.id === createForm.documentId)
    const projectId = doc?.projectId || doc?.project?.id
    if (projectId) {
      setCreateForm((prev) => ({ ...prev, projectId }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents, createForm.documentId])

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/session')
      if (response.ok) {
        const data = await response.json()
        setCurrentUser(data.user)
      }
    } catch (error) {
      console.error('Error fetching current user:', error)
    }
  }

  const fetchApprovals = async () => {
    try {
      setLoadError(null)
      const response = await fetch('/api/approvals')
      if (response.ok) {
        const data = await response.json()
        setApprovals(data.approvals || [])
      } else {
        const data = await response.json().catch(() => ({}))
        setLoadError(data.error || 'Не удалось загрузить согласования')
      }
    } catch {
      setLoadError('Ошибка при загрузке согласований')
    } finally {
      setLoading(false)
    }
  }

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects')
      if (response.ok) {
        const data = await response.json()
        setProjects(data.projects || [])
      }
    } catch (err) {
      console.error(err)
    }
  }

  const fetchDocuments = async () => {
    try {
      const response = await fetch('/api/documents')
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.documents || [])
      }
    } catch (err) {
      console.error(err)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users/for-approvals')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleCreateApproval = async (e: React.FormEvent) => {
    e.preventDefault()
    setUploadingCreateFiles(true)
    try {
      const response = await fetch('/api/approvals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createForm)
      })

      if (response.ok) {
        const newApproval = await response.json()
        
        // Загружаем файлы если они есть
        if (createFormFiles.length > 0) {
          for (const file of createFormFiles) {
            const formData = new FormData()
            formData.append('file', file)
            
            await fetch(`/api/approvals/${newApproval.id}/attachments`, {
              method: 'POST',
              body: formData
            })
          }
        }
        
        await fetchApprovals()
        setShowCreateModal(false)
        setCreateForm({
          title: '',
          description: '',
          type: 'DOCUMENT',
          priority: 'MEDIUM',
          dueDate: '',
          requireAllApprovals: false,
          autoPublishOnApproval: true,
          projectId: '',
          documentId: '',
          assigneeIds: [],
          roles: {}
        })
        setCreateFormFiles([])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setUploadingCreateFiles(false)
    }
  }

  const handleApprove = async (approvalId: string) => {
    try {
      const response = await fetch(`/api/approvals/${approvalId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'APPROVED' })
      })

      if (response.ok) {
        const result = await response.json()
        await fetchApprovals()
        // Обновляем выбранное согласование если оно открыто
        if (selectedApproval?.id === approvalId) {
          setSelectedApproval(result)
        }
      } else {
        const error = await response.json()
        toast.error(error.error || 'Ошибка при одобрении')
      }
    } catch (err) {
      console.error(err)
      toast.error('Ошибка при одобрении')
    }
  }

  const handleReject = async (approvalId: string) => {
    try {
      const response = await fetch(`/api/approvals/${approvalId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'REJECTED' })
      })

      if (response.ok) {
        const result = await response.json()
        await fetchApprovals()
        // Обновляем выбранное согласование если оно открыто
        if (selectedApproval?.id === approvalId) {
          setSelectedApproval(result)
        }
      } else {
        const error = await response.json()
        toast.error(error.error || 'Ошибка при отклонении')
      }
    } catch (err) {
      console.error(err)
      toast.error('Ошибка при отклонении')
    }
  }

  const fetchAttachments = async (approvalId: string) => {
    try {
      const response = await fetch(`/api/approvals/${approvalId}/attachments`)
      if (response.ok) {
        const data = await response.json()
        setAttachments(data.attachments || [])
      }
    } catch (error) {
      console.error('Error fetching attachments:', error)
    }
  }

  const handleFileUpload = async (approvalId: string, file: File) => {
    setUploadingFile(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/approvals/${approvalId}/attachments`, {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        await fetchAttachments(approvalId)
        toast.success('Файл загружен успешно')
        const fileInput = document.getElementById('file-upload') as HTMLInputElement
        if (fileInput) fileInput.value = ''
      } else {
        toast.error('Ошибка при загрузке файла')
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      toast.error('Ошибка при загрузке файла')
    } finally {
      setUploadingFile(false)
    }
  }

  const handleDeleteAttachmentClick = async (attachmentId: string, approvalId: string) => {
    const ok = await confirm({
      title: 'Удалить файл?',
      description: 'Файл будет удалён без возможности восстановления.',
      confirmText: 'Удалить',
      destructive: true,
    })
    if (!ok) return
    try {
      const response = await fetch(`/api/approvals/${approvalId}/attachments/${attachmentId}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        await fetchAttachments(approvalId)
        toast.success('Файл удалён')
      } else {
        toast.error('Ошибка при удалении файла')
      }
    } catch (error) {
      console.error('Error deleting attachment:', error)
      toast.error('Ошибка при удалении файла')
    }
  }

  const handleDeleteApprovalClick = async (approvalId: string) => {
    const ok = await confirm({
      title: 'Удалить согласование?',
      description: 'Это действие необратимо.',
      confirmText: 'Удалить',
      destructive: true,
    })
    if (!ok) return
    try {
      const response = await fetch(`/api/approvals/${approvalId}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        setApprovals(prev => prev.filter(a => a.id !== approvalId))
        setShowDetailsModal(false)
        setSelectedApproval(null)
        toast.success('Согласование удалено')
      } else {
        toast.error('Ошибка при удалении согласования')
      }
    } catch (error) {
      console.error('Error deleting approval:', error)
      toast.error('Ошибка при удалении согласования')
    }
  }

  const handleCreateFormFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setCreateFormFiles(prev => [...prev, ...files])
  }

  const handleRemoveCreateFormFile = (index: number) => {
    setCreateFormFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleAddComment = async (approvalId: string) => {
    if (!newComment.trim()) return
    
    setCommentLoading(true)
    try {
      const response = await fetch(`/api/approvals/${approvalId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: newComment })
      })

      if (response.ok) {
        setNewComment('')
        fetchApprovals() // Обновляем список
        if (selectedApproval) {
          // Обновляем выбранное согласование
          const updatedApproval = await fetch(`/api/approvals/${approvalId}`).then(r => r.json())
          setSelectedApproval(updatedApproval)
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setCommentLoading(false)
    }
  }

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      'PENDING': 'Ожидает',
      'APPROVED': 'Одобрено',
      'REJECTED': 'Отклонено',
      'CANCELLED': 'Отменено'
    }
    return map[status] || status
  }

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      'PENDING': 'bg-yellow-50 text-yellow-700 border-yellow-200',
      'APPROVED': 'bg-green-50 text-green-700 border-green-200',
      'REJECTED': 'bg-red-50 text-red-700 border-red-200',
      'CANCELLED': 'bg-gray-50 text-gray-700 border-gray-200'
    }
    return map[status] || 'bg-gray-50 text-gray-700'
  }

  const getPriorityText = (priority: string) => {
    const map: Record<string, string> = {
      'LOW': 'Низкий',
      'MEDIUM': 'Средний',
      'HIGH': 'Высокий',
      'URGENT': 'Срочный'
    }
    return map[priority] || priority
  }

  const getPriorityColor = (priority: string) => {
    const map: Record<string, string> = {
      'LOW': 'bg-blue-50 text-blue-700 border-blue-200',
      'MEDIUM': 'bg-yellow-50 text-yellow-700 border-yellow-200',
      'HIGH': 'bg-orange-50 text-orange-700 border-orange-200',
      'URGENT': 'bg-red-50 text-red-700 border-red-200'
    }
    return map[priority] || 'bg-gray-50 text-gray-700'
  }

  const getRoleText = (role: string) => {
    const map: Record<string, string> = {
      'INITIATOR': 'Инициатор',
      'APPROVER': 'Согласующий',
      'REVIEWER': 'Рецензент',
      'OBSERVER': 'Наблюдатель'
    }
    return map[role] || role
  }

  const getTypeText = (type: string) => {
    const map: Record<string, string> = {
      'BUDGET': 'Бюджет',
      'DOCUMENT': 'Документ',
      'TIMELINE': 'Сроки',
      'CONTRACT': 'Договор',
      'RESOURCE': 'Ресурсы',
      'GENERAL': 'Общее'
    }
    return map[type] || type
  }


  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false
    return new Date(dueDate) < new Date()
  }

  const canUserRespond = (approval: Approval) => {
    if (!currentUser) return false
    if (approval.status !== 'PENDING') return false
    
    const userAssignment = approval.assignments.find(a => a.user.id === currentUser.id)
    return userAssignment && userAssignment.status === 'PENDING'
  }

  const getUserAssignment = (approval: Approval) => {
    if (!currentUser) return null
    return approval.assignments.find(a => a.user.id === currentUser.id)
  }

  // ——— 4c: производные данные строки реестра ———
  const initials = (name?: string) =>
    (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'

  // тип заявки: приоритетно из data.kind, иначе маппинг legacy-enum
  const kindOf = (a: Approval): 'material' | 'installation' | 'works' | 'document' => {
    const k = a.data?.kind
    if (k === 'material' || k === 'installation' || k === 'works' || k === 'document') return k
    if (a.type === 'DOCUMENT') return 'document'
    if (a.type === 'RESOURCE') return 'material'
    return 'works'
  }
  const KIND_LABEL: Record<string, string> = { material: 'Материал', installation: 'Монтаж', works: 'Работы', document: 'Документ' }
  const KIND_ICON: Record<string, any> = { material: Package, installation: Wrench, works: Wrench, document: FileText }

  const amountOf = (a: Approval): number | null => {
    const v = a.data?.amount
    const n = typeof v === 'string' ? parseFloat(v) : v
    return typeof n === 'number' && !isNaN(n) && n > 0 ? n : null
  }
  const fmtMoney = (n: number) => new Intl.NumberFormat('ru-RU').format(Math.round(n)) + ' ₽'

  // «ждёт вас» — текущий пользователь ещё не ответил
  const waitsForMe = (a: Approval) => canUserRespond(a)

  // статус-вид: rejected / approved / mine / inwork
  const rowStatus = (a: Approval): 'rejected' | 'approved' | 'mine' | 'inwork' => {
    if (a.status === 'REJECTED') return 'rejected'
    if (a.status === 'APPROVED') return 'approved'
    if (waitsForMe(a)) return 'mine'
    return 'inwork'
  }

  const approvedCount = (a: Approval) => a.assignments.filter((x) => x.status === 'APPROVED').length

  // сегмент-счётчики
  const counts = {
    all: approvals.length,
    mine: approvals.filter((a) => waitsForMe(a)).length,
    inwork: approvals.filter((a) => a.status === 'PENDING' && !waitsForMe(a)).length,
    approved: approvals.filter((a) => a.status === 'APPROVED').length,
    rejected: approvals.filter((a) => a.status === 'REJECTED').length,
  }

  const filteredApprovals = approvals
    .filter((a) => {
      // сегмент
      if (segment === 'mine' && !waitsForMe(a)) return false
      if (segment === 'inwork' && !(a.status === 'PENDING' && !waitsForMe(a))) return false
      if (segment === 'approved' && a.status !== 'APPROVED') return false
      if (segment === 'rejected' && a.status !== 'REJECTED') return false
      // тип
      if (typeFilter !== 'all' && kindOf(a) !== typeFilter) return false
      // проект (сохранён из прежнего фильтра)
      if (projectFilter !== 'all') {
        if (projectFilter === 'none' ? !!a.project?.id : a.project?.id !== projectFilter) return false
      }
      // поиск
      if (search.trim()) {
        const hay = `${a.title} ${a.project?.name || ''} ${a.creator.name}`.toLowerCase()
        if (!hay.includes(search.trim().toLowerCase())) return false
      }
      return true
    })
    // «ждут меня» всегда сверху
    .sort((a, b) => {
      const am = waitsForMe(a) ? 0 : 1
      const bm = waitsForMe(b) ? 0 : 1
      if (am !== bm) return am - bm
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

  // выделяемые (для массовых действий) — только те, что ждут текущего пользователя
  const selectableIds = filteredApprovals.filter((a) => waitsForMe(a)).map((a) => a.id)
  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  const clearSelection = () => setSelectedIds(new Set())

  const bulkApprove = async () => {
    if (selectedIds.size === 0 || bulkBusy) return
    setBulkBusy(true)
    try {
      for (const id of Array.from(selectedIds)) {
        await handleApprove(id)
      }
      clearSelection()
    } finally {
      setBulkBusy(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <PageHeader title="Согласования" description="Загрузка..." />
          <SkeletonList rows={6} />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <ErrorBanner message={loadError} onDismiss={() => setLoadError(null)} />

      <div className="space-y-6">
        {/* 4c — шапка реестра */}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">Согласования</h1>
            <p className="mt-0.5 text-[12.5px] text-neutral-400">
              {counts.all} всего · {counts.mine} ждут вас · {counts.inwork} в работе
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Документ, проект или автор…"
                className="w-[230px] rounded-lg border border-neutral-200 bg-white py-[7px] pl-9 pr-3 text-[13px] text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <div className="relative">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="appearance-none rounded-lg border border-neutral-200 bg-white py-[7px] pl-3 pr-8 text-[13px] text-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="all">Тип: все</option>
                <option value="material">Материал</option>
                <option value="installation">Монтаж</option>
                <option value="works">Работы</option>
                <option value="document">Документ</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            </div>
            <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4" />
              Новая заявка
            </Button>
          </div>
        </div>

        {/* сегмент-фильтр статусов */}
        <div className="flex w-fit gap-0.5 rounded-lg bg-neutral-200/60 p-[3px]">
          {([
            ['all', 'Все', counts.all, false],
            ['mine', 'Ждут меня', counts.mine, true],
            ['inwork', 'В работе', counts.inwork, false],
            ['approved', 'Согласованы', counts.approved, false],
            ['rejected', 'Отклонены', counts.rejected, false],
          ] as const).map(([key, label, n, danger]) => (
            <button
              key={key}
              onClick={() => setSegment(key)}
              className={`rounded-[7px] px-3.5 py-1.5 text-[12.5px] transition-colors ${
                segment === key
                  ? 'bg-white font-semibold text-neutral-900 shadow-sm'
                  : 'font-medium text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {label}{' '}
              {n > 0 && (
                <span className={danger ? 'text-red-600' : 'text-neutral-400'}>{n}</span>
              )}
            </button>
          ))}
        </div>

        {/* панель массовых действий */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3.5 rounded-[10px] border border-blue-200 bg-blue-50 px-4 py-2.5">
            <span className="text-[12.5px] font-semibold text-blue-900">Выбрано: {selectedIds.size}</span>
            <button
              onClick={bulkApprove}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-green-800 disabled:opacity-60"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
              Согласовать выбранные
            </button>
            <span className="ml-auto cursor-pointer text-[12px] text-neutral-600 hover:text-neutral-900" onClick={clearSelection}>
              Снять выделение
            </span>
          </div>
        )}

        {/* таблица */}
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <div className="overflow-x-auto">
            <div className="min-w-[860px]">
              {/* заголовок */}
              <div
                className="grid items-center border-b border-neutral-100 bg-neutral-50 px-3"
                style={{ gridTemplateColumns: '34px 1.8fr 1.3fr 0.9fr 1fr 1.1fr 0.9fr 40px' }}
              >
                <div className="py-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectableIds.every((id) => selectedIds.has(id)) && selectableIds.length > 0) clearSelection()
                      else setSelectedIds(new Set(selectableIds))
                    }}
                    disabled={selectableIds.length === 0}
                    className={`block h-4 w-4 rounded-[5px] border-[1.5px] ${
                      selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id))
                        ? 'border-blue-600 bg-blue-600'
                        : 'border-neutral-300'
                    } disabled:opacity-40`}
                    aria-label="Выбрать все"
                  >
                    {selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id)) && (
                      <Check className="h-3 w-3 text-white" strokeWidth={3} />
                    )}
                  </button>
                </div>
                <div className="px-2.5 py-[11px] text-[11.5px] font-semibold text-neutral-400">Документ</div>
                <div className="px-2.5 py-[11px] text-[11.5px] font-semibold text-neutral-400">Проект</div>
                <div className="px-2.5 py-[11px] text-right text-[11.5px] font-semibold text-neutral-400">Сумма</div>
                <div className="px-2.5 py-[11px] text-[11.5px] font-semibold text-neutral-400">Маршрут</div>
                <div className="px-2.5 py-[11px] text-[11.5px] font-semibold text-neutral-400">Статус</div>
                <div className="px-2.5 py-[11px] text-[11.5px] font-semibold text-neutral-400">Ожидает</div>
                <div />
              </div>

              {/* строки */}
              {filteredApprovals.length === 0 ? (
                <div className="px-4 py-14 text-center text-sm text-neutral-400">Нет согласований</div>
              ) : (
                filteredApprovals.map((approval) => {
                  const kind = kindOf(approval)
                  const KindIcon = KIND_ICON[kind]
                  const amount = amountOf(approval)
                  const st = rowStatus(approval)
                  const mine = st === 'mine'
                  const total = approval.assignments.length
                  const done = approvedCount(approval)
                  const selected = selectedIds.has(approval.id)
                  const nextPending = approval.assignments.find((x) => x.status === 'PENDING')
                  const STATUS: Record<string, { label: string; cls: string }> = {
                    rejected: { label: 'Отклонён', cls: 'bg-red-50 text-red-600 border-red-200' },
                    approved: { label: 'Согласован', cls: 'bg-green-50 text-green-700 border-green-200' },
                    mine: { label: 'Ждёт вас', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
                    inwork: { label: 'В работе', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
                  }
                  const badge = STATUS[st]
                  return (
                    <div
                      key={approval.id}
                      onClick={() => {
                        setSelectedApproval(approval)
                        setShowDetailsModal(true)
                        fetchAttachments(approval.id)
                      }}
                      className={`grid cursor-pointer items-center border-t border-neutral-100 px-3 transition-colors ${
                        mine ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-neutral-50'
                      }`}
                      style={{ gridTemplateColumns: '34px 1.8fr 1.3fr 0.9fr 1fr 1.1fr 0.9fr 40px' }}
                    >
                      {/* чекбокс */}
                      <div className="py-3" onClick={(e) => e.stopPropagation()}>
                        {mine ? (
                          <button
                            type="button"
                            onClick={() => toggleSelect(approval.id)}
                            className={`flex h-4 w-4 items-center justify-center rounded-[5px] border-[1.5px] ${
                              selected ? 'border-blue-600 bg-blue-600' : 'border-neutral-300'
                            }`}
                            aria-label="Выбрать"
                          >
                            {selected && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                          </button>
                        ) : (
                          <span className="block h-4 w-4 rounded-[5px] border-[1.5px] border-neutral-200" />
                        )}
                      </div>

                      {/* документ */}
                      <div className="flex items-center gap-2.5 px-2.5 py-3">
                        <KindIcon className="h-[15px] w-[15px] shrink-0 text-neutral-400" strokeWidth={1.8} />
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-semibold text-neutral-900">{approval.title}</div>
                          <div className="truncate text-[11px] text-neutral-400">
                            {KIND_LABEL[kind]} · {approval.creator.name} ·{' '}
                            {new Date(approval.createdAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                          </div>
                        </div>
                      </div>

                      {/* проект */}
                      <div className="truncate px-2.5 py-3 text-[12.5px] text-neutral-700">{approval.project?.name || '—'}</div>

                      {/* сумма */}
                      <div className="px-2.5 py-3 text-right text-[12.5px] tabular-nums text-neutral-900">
                        {amount != null ? fmtMoney(amount) : <span className="text-neutral-400">—</span>}
                      </div>

                      {/* маршрут (параллельно) */}
                      <div className="px-2.5 py-3">
                        <div className="flex items-center gap-1.5">
                          {approval.assignments.map((asg, i) => {
                            const color =
                              asg.status === 'APPROVED'
                                ? 'bg-green-700'
                                : asg.status === 'REJECTED'
                                ? 'bg-red-600'
                                : nextPending && asg.id === nextPending.id
                                ? 'bg-blue-600'
                                : 'bg-neutral-300'
                            return <span key={asg.id} className={`h-1.5 w-1.5 rounded-full ${color}`} />
                          })}
                          <span className="ml-1 text-[11px] text-neutral-400">
                            {st === 'rejected' ? <CornerUpLeft className="inline h-3 w-3" /> : `${done}/${total}`}
                          </span>
                        </div>
                      </div>

                      {/* статус */}
                      <div className="px-2.5 py-3">
                        <span className={`inline-flex rounded-[7px] border px-2.5 py-[3px] text-[11.5px] font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </div>

                      {/* ожидает */}
                      <div className="px-2.5 py-3">
                        {st === 'approved' ? (
                          <span className="text-[12px] text-neutral-400">—</span>
                        ) : st === 'rejected' ? (
                          <span className="text-[12px] text-neutral-400">возвращён автору</span>
                        ) : mine ? (
                          <span className="flex items-center gap-1.5">
                            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-neutral-900 text-[9px] font-semibold text-white">
                              {initials(currentUser?.name)}
                            </span>
                            <span className="text-[12px] text-neutral-700">Вы</span>
                          </span>
                        ) : nextPending ? (
                          <span className="flex items-center gap-1.5">
                            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-teal-600 text-[9px] font-semibold text-white">
                              {initials(nextPending.user.name)}
                            </span>
                            <span className="truncate text-[12px] text-neutral-400">{nextPending.user.name}</span>
                          </span>
                        ) : (
                          <span className="text-[12px] text-neutral-400">—</span>
                        )}
                      </div>

                      {/* ⋯ */}
                      <div className="flex justify-center text-neutral-400">
                        <MoreHorizontal className="h-4 w-4" />
                      </div>
                    </div>
                  )
                })
              )}

              {/* футер-пагинация */}
              <div className="flex items-center justify-between border-t border-neutral-100 bg-neutral-50 px-[18px] py-[13px]">
                <span className="text-[12.5px] text-neutral-400">
                  {filteredApprovals.length === 0 ? '0' : `1–${filteredApprovals.length}`} из {counts.all}
                </span>
                <div className="flex gap-2">
                  <span className="rounded-[7px] border border-neutral-100 px-3 py-[5px] text-[12.5px] text-neutral-300">Назад</span>
                  <span className="rounded-[7px] border border-neutral-200 px-3 py-[5px] text-[12.5px] text-neutral-700">Вперёд</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Create Approval Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Создать согласование</DialogTitle>
              <DialogDescription>
                Создайте новое согласование для документа или проекта
              </DialogDescription>
            </DialogHeader>
            <div>
                <form onSubmit={handleCreateApproval} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="title">Название</Label>
                      <Input
                        id="title"
                        value={createForm.title}
                        onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                        placeholder="Введите название согласования"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="type">Тип согласования</Label>
                      <select
                        id="type"
                        value={createForm.type}
                        onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      >
                        <option value="DOCUMENT">Документ</option>
                        <option value="BUDGET">Бюджет</option>
                        <option value="TIMELINE">Сроки</option>
                        <option value="CONTRACT">Договор</option>
                        <option value="RESOURCE">Ресурсы</option>
                        <option value="GENERAL">Общее</option>
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="priority">Приоритет</Label>
                      <select
                        id="priority"
                        value={createForm.priority}
                        onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      >
                        <option value="LOW">Низкий</option>
                        <option value="MEDIUM">Средний</option>
                        <option value="HIGH">Высокий</option>
                        <option value="URGENT">Срочный</option>
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="dueDate">Срок выполнения</Label>
                      <Input
                        id="dueDate"
                        type="datetime-local"
                        value={createForm.dueDate}
                        onChange={(e) => setCreateForm({ ...createForm, dueDate: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="description">Описание</Label>
                    <textarea
                      id="description"
                      value={createForm.description}
                      onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                      placeholder="Подробное описание согласования"
                      className="w-full p-2 border border-gray-300 rounded-md h-24"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="project">Проект (опционально)</Label>
                      <select
                        id="project"
                        value={createForm.projectId}
                        onChange={(e) => {
                          const projectId = e.target.value
                          const currentDoc = documents.find(d => d.id === createForm.documentId)
                          const docBelongsToProject = currentDoc && (currentDoc.projectId === projectId || currentDoc.project?.id === projectId)
                          setCreateForm({
                            ...createForm,
                            projectId,
                            documentId: projectId && docBelongsToProject ? createForm.documentId : ''
                          })
                        }}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      >
                        <option value="">Выберите проект</option>
                        {projects.map(project => (
                          <option key={project.id} value={project.id}>{project.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="document">Документ (опционально)</Label>
                      <select
                        id="document"
                        value={createForm.documentId}
                        onChange={(e) => setCreateForm({ ...createForm, documentId: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        disabled={!createForm.projectId}
                      >
                        <option value="">
                          {createForm.projectId ? 'Выберите документ проекта' : 'Сначала выберите проект'}
                        </option>
                        {documents
                          .filter(doc => (doc.projectId ?? doc.project?.id) === createForm.projectId)
                          .map(doc => (
                            <option key={doc.id} value={doc.id}>{doc.title}</option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={createForm.requireAllApprovals}
                        onChange={(e) => setCreateForm({ ...createForm, requireAllApprovals: e.target.checked })}
                      />
                      <span className="text-sm">Требуется согласие всех</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={createForm.autoPublishOnApproval}
                        onChange={(e) => setCreateForm({ ...createForm, autoPublishOnApproval: e.target.checked })}
                      />
                      <span className="text-sm">Автопубликация при одобрении</span>
                    </label>
                  </div>

                  <div>
                    <Label>Участники согласования</Label>
                    <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-300 rounded-md p-2">
                      {users.map(user => (
                        <div key={user.id} className="flex items-center justify-between">
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={createForm.assigneeIds.includes(user.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setCreateForm({
                                    ...createForm,
                                    assigneeIds: [...createForm.assigneeIds, user.id],
                                    roles: { ...createForm.roles, [user.id]: 'APPROVER' }
                                  })
                                } else {
                                  setCreateForm({
                                    ...createForm,
                                    assigneeIds: createForm.assigneeIds.filter(id => id !== user.id),
                                    roles: { ...createForm.roles, [user.id]: undefined } as Record<string, string>
                                  })
                                }
                              }}
                            />
                            <span className="text-sm">{user.name} ({user.email})</span>
                          </label>
                          {createForm.assigneeIds.includes(user.id) && (
                            <select
                              value={createForm.roles[user.id] || 'APPROVER'}
                              onChange={(e) => setCreateForm({
                                ...createForm,
                                roles: { ...createForm.roles, [user.id]: e.target.value }
                              })}
                              className="text-xs p-1 border border-gray-300 rounded"
                            >
                              <option value="APPROVER">Согласующий</option>
                              <option value="REVIEWER">Рецензент</option>
                              <option value="OBSERVER">Наблюдатель</option>
                            </select>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Вложения (опционально)</Label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                      <div className="text-center">
                        <Paperclip className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600 mb-2">
                          Перетащите файлы сюда или нажмите для выбора
                        </p>
                        <input
                          type="file"
                          multiple
                          onChange={handleCreateFormFileUpload}
                          className="hidden"
                          id="create-file-upload"
                        />
                        <label
                          htmlFor="create-file-upload"
                          className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                        >
                          Выбрать файлы
                        </label>
                      </div>
                      
                      {createFormFiles.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-medium text-gray-700 mb-2">Выбранные файлы:</p>
                          <div className="space-y-2">
                            {createFormFiles.map((file, index) => (
                              <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                                <div className="flex items-center space-x-2">
                                  <Paperclip className="h-4 w-4 text-gray-500" />
                                  <span className="text-sm text-gray-700">{file.name}</span>
                                  <span className="text-xs text-gray-500">
                                    ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCreateFormFile(index)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowCreateModal(false)}
                    >
                      Отмена
                    </Button>
                    <Button type="submit" disabled={uploadingCreateFiles}>
                      {uploadingCreateFiles ? 'Создание...' : 'Создать согласование'}
                    </Button>
                  </div>
                </form>
            </div>
          </DialogContent>
        </Dialog>

        {/* Approval Details Modal */}
        {showDetailsModal && selectedApproval && (
          <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden min-w-0">
              <DialogHeader className="min-w-0">
                <DialogTitle className="break-words">{selectedApproval.title}</DialogTitle>
                <DialogDescription>
                  Детали согласования
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 min-w-0 overflow-x-hidden">
                <div className="min-w-0 w-full overflow-hidden">
                  <Label>Описание</Label>
                  {selectedApproval.description ? (
                    <ExpandableDescription 
                      description={selectedApproval.description} 
                      maxLength={200}
                      className="mt-1 text-sm"
                    />
                  ) : (
                    <p className="text-sm text-gray-500 mt-1">Нет описания</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Тип</Label>
                    <p className="text-sm text-gray-700">{getTypeText(selectedApproval.type)}</p>
                  </div>
                  <div>
                    <Label>Приоритет</Label>
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getPriorityColor(selectedApproval.priority)}`}>
                      {getPriorityText(selectedApproval.priority)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Проект</Label>
                    <p className="text-sm text-gray-700">{selectedApproval.project?.name || 'Не указан'}</p>
                  </div>
                  <div>
                    <Label>Документ</Label>
                    <p className="text-sm text-gray-700">{selectedApproval.document?.title || 'Не указан'}</p>
                  </div>
                </div>

                <div>
                  <Label>Статус</Label>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getStatusColor(selectedApproval.status)}`}>
                    {getStatusText(selectedApproval.status)}
                  </span>
                </div>

                <div>
                  <Label>Прогресс согласования</Label>
                  <ApprovalProgress 
                    assignments={selectedApproval.assignments}
                    requireAllApprovals={selectedApproval.requireAllApprovals}
                    currentUserId={currentUser?.id}
                  />
                </div>

                <div>
                  <Label>Вложения</Label>
                  <div className="space-y-2">
                    {attachments.length > 0 ? (
                      attachments.map((attachment) => (
                        <div key={attachment.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex items-center gap-2 min-w-0">
                            <Paperclip className="h-4 w-4 text-gray-500 shrink-0" />
                            <span className="text-sm truncate">{attachment.fileName}</span>
                            <span className="text-xs text-gray-500 shrink-0">
                              ({(attachment.fileSize / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-gray-500 hidden sm:inline">
                              {new Date(attachment.createdAt).toLocaleDateString('ru-RU')}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => window.open(`/api/approvals/${selectedApproval.id}/attachments/${attachment.id}/download`, '_blank')}
                              title="Открыть / Скачать"
                            >
                              Открыть
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteAttachmentClick(attachment.id, selectedApproval.id)}
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                              title="Удалить файл"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">Нет вложений</p>
                    )}
                    
                    <div className="mt-3 p-3 border-2 border-dashed border-gray-300 rounded-lg">
                      <input
                        type="file"
                        id="file-upload"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            handleFileUpload(selectedApproval.id, file)
                          }
                        }}
                        disabled={uploadingFile}
                        accept="*/*"
                      />
                      <div className="text-center">
                        <Paperclip className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600 mb-2">
                          Перетащите файл сюда или нажмите кнопку
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById('file-upload')?.click()}
                          disabled={uploadingFile}
                          className="w-full"
                        >
                          {uploadingFile ? 'Загрузка...' : 'Выбрать файл'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between">
                  <div className="flex gap-2">
                    {canUserRespond(selectedApproval) && (
                      <>
                        <Button
                          onClick={() => {
                            handleApprove(selectedApproval.id)
                            setShowDetailsModal(false)
                          }}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Одобрить
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            handleReject(selectedApproval.id)
                            setShowDetailsModal(false)
                          }}
                          className="text-red-600 border-red-600 hover:bg-red-50"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Отклонить
                        </Button>
                      </>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleDeleteApprovalClick(selectedApproval.id)}
                      className="text-red-600 border-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Удалить
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowDetailsModal(false)}
                    >
                      Закрыть
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Comments Modal */}
        {showCommentsModal && selectedApproval && (
          <Dialog open={showCommentsModal} onOpenChange={setShowCommentsModal}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Комментарии</DialogTitle>
                <DialogDescription>
                  Обсуждение согласования "{selectedApproval.title}"
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {/* Add Comment Form */}
                <div className="border-t pt-4">
                  <div className="flex gap-2">
                    <Input
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Добавить комментарий..."
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleAddComment(selectedApproval.id)
                        }
                      }}
                    />
                    <Button
                      onClick={() => handleAddComment(selectedApproval.id)}
                      disabled={!newComment.trim() || commentLoading}
                    >
                      {commentLoading ? 'Отправка...' : 'Отправить'}
                    </Button>
                  </div>
                </div>

                {/* Comments List */}
                <div className="space-y-3">
                  {selectedApproval.comments.map((comment) => (
                    <div key={comment.id} className="border-b pb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{comment.user.name}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(comment.createdAt).toLocaleString('ru-RU')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{comment.content}</p>
                    </div>
                  ))}
                  {selectedApproval.comments.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">Нет комментариев</p>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setShowCommentsModal(false)}
                  >
                    Закрыть
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Attachments Modal */}
        {showAttachmentsModal && selectedApproval && (
          <Dialog open={showAttachmentsModal} onOpenChange={setShowAttachmentsModal}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Вложения</DialogTitle>
                <DialogDescription>
                  Файлы согласования "{selectedApproval.title}"
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-3">
                  {(selectedApproval.attachments || []).length > 0 ? (
                    (selectedApproval.attachments || []).map((attachment) => (
                      <div key={attachment.id} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium">{attachment.fileName}</p>
                            <p className="text-xs text-gray-500">
                              {(attachment.fileSize / 1024).toFixed(1)} KB • {attachment.user.name}
                            </p>
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            window.open(`/api/approvals/${selectedApproval.id}/attachments/${attachment.id}/download`, '_blank')
                          }}
                        >
                          Скачать
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">Нет вложений</p>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setShowAttachmentsModal(false)}
                  >
                    Закрыть
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* History Modal */}
        {showHistoryModal && selectedApproval && (
          <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>История изменений</DialogTitle>
                <DialogDescription>
                  История согласования "{selectedApproval.title}"
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-3">
                  {selectedApproval.comments.map((comment, index) => (
                    <div key={index} className="border-l-2 border-gray-200 pl-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{comment.user.name}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(comment.createdAt).toLocaleString('ru-RU')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{comment.content}</p>
                    </div>
                  ))}
                  {selectedApproval.comments.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">Нет истории</p>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setShowHistoryModal(false)}
                  >
                    Закрыть
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </Layout>
  )
}

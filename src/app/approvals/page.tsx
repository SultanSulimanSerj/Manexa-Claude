'use client'

import { useState, useEffect } from 'react'
import Layout from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { confirm } from '@/components/ui/confirm'
import { toast } from '@/components/ui/use-toast'
import { Plus, X, XCircle, FileText, MessageSquare, Trash2, Search, ChevronDown, MoreHorizontal, Check, Package, Wrench, CornerUpLeft, MapPin, AlertTriangle } from 'lucide-react'
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
  // 4c — реестр
  const [segment, setSegment] = useState<'all' | 'mine' | 'inwork' | 'approved' | 'rejected'>('all')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'material' | 'installation' | 'works' | 'document'>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  // 4b — окно согласования / отклонение
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectComment, setRejectComment] = useState('')
  const [rejectBusy, setRejectBusy] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
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
    roles: {} as Record<string, string>,
    // 6a — тип заявки и поля, зависящие от типа (уходят в Approval.data)
    kind: 'material' as 'material' | 'installation' | 'works' | 'document',
    itemName: '',
    manufacturer: '',
    quantity: '',
    unitPrice: '',
    amount: '',
    section: '',
    floors: '',
    axes: '',
    node: '',
    volume: '',
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
        kind: 'document',
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

  // 6a — тип заявки → legacy-enum (для совместимости) + собираем data JSON
  const KIND_TO_TYPE: Record<string, string> = { material: 'RESOURCE', installation: 'GENERAL', works: 'GENERAL', document: 'DOCUMENT' }
  const buildApprovalData = (f: typeof createForm) => {
    const num = (v: string) => {
      const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'))
      return isNaN(n) ? undefined : n
    }
    const data: Record<string, any> = { kind: f.kind }
    if (f.itemName) data.itemName = f.itemName
    if (f.manufacturer) data.manufacturer = f.manufacturer
    if (f.quantity) data.quantity = f.quantity
    if (num(f.unitPrice) != null) data.unitPrice = num(f.unitPrice)
    if (num(f.amount) != null) data.amount = num(f.amount)
    if (f.section) data.section = f.section
    if (f.floors) data.floors = f.floors
    if (f.axes) data.axes = f.axes
    if (f.node) data.node = f.node
    if (f.volume) data.volume = f.volume
    return data
  }

  const handleCreateApproval = async (e: React.FormEvent) => {
    e.preventDefault()
    setUploadingCreateFiles(true)
    try {
      const payload = {
        ...createForm,
        title: createForm.title || createForm.itemName,
        type: KIND_TO_TYPE[createForm.kind] || 'GENERAL',
        // параллельная модель: заявка приходит всем сразу, ждём согласия всех
        requireAllApprovals: true,
        data: buildApprovalData(createForm),
      }
      const response = await fetch('/api/approvals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
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
          roles: {},
          kind: 'material',
          itemName: '',
          manufacturer: '',
          quantity: '',
          unitPrice: '',
          amount: '',
          section: '',
          floors: '',
          axes: '',
          node: '',
          volume: '',
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

  const handleReject = async (approvalId: string, comment?: string) => {
    try {
      const response = await fetch(`/api/approvals/${approvalId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'REJECTED', comment: comment || null })
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

  const canUserRespond = (approval: Approval) => {
    if (!currentUser) return false
    if (approval.status !== 'PENDING') return false
    const userAssignment = approval.assignments.find(a => a.user.id === currentUser.id)
    return userAssignment && userAssignment.status === 'PENDING'
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
          <DialogContent className="max-w-[600px] gap-0 overflow-hidden p-0">
            <DialogTitle className="sr-only">Новая заявка на согласование</DialogTitle>
            {(() => {
              const f = createForm
              const set = (patch: Partial<typeof createForm>) => setCreateForm({ ...f, ...patch })
              const fieldCls = 'w-full rounded-[9px] border border-neutral-200 px-3 py-2.5 text-[13px] text-neutral-800 placeholder:text-neutral-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20'
              const labelCls = 'text-[13px] font-medium text-neutral-700'
              const KINDS: { k: 'material' | 'installation' | 'works' | 'document'; label: string; Icon: any }[] = [
                { k: 'material', label: 'Материал', Icon: Package },
                { k: 'installation', label: 'Монтаж', Icon: Wrench },
                { k: 'works', label: 'Работы', Icon: Wrench },
                { k: 'document', label: 'Документ', Icon: FileText },
              ]
              const nameLabel =
                f.kind === 'material' ? 'Наименование материала' : f.kind === 'installation' ? 'Что монтируем' : f.kind === 'works' ? 'Вид работ' : 'Название документа'
              const selectedUsers = users.filter((u) => f.assigneeIds.includes(u.id))
              const restUsers = users.filter((u) => !f.assigneeIds.includes(u.id))
              return (
                <form onSubmit={handleCreateApproval} className="flex max-h-[88vh] flex-col">
                  <div className="border-b border-neutral-100 px-6 py-4">
                    <div className="text-[17px] font-bold text-neutral-900">Новая заявка на согласование</div>
                  </div>

                  <div className="flex flex-col gap-[18px] overflow-y-auto px-6 py-[22px]">
                    {/* Шаг 1: тип */}
                    <div>
                      <label className={`mb-2 block ${labelCls}`}>Что согласуем</label>
                      <div className="grid grid-cols-4 gap-2">
                        {KINDS.map(({ k, label, Icon }) => {
                          const active = f.kind === k
                          return (
                            <button
                              key={k}
                              type="button"
                              onClick={() => set({ kind: k })}
                              className={`flex flex-col items-center gap-2 rounded-[10px] border px-2.5 py-3 transition-colors ${
                                active ? 'border-[1.5px] border-blue-600 bg-blue-50' : 'border-neutral-200 hover:bg-neutral-50'
                              }`}
                            >
                              <Icon className={`h-5 w-5 ${active ? 'text-blue-700' : 'text-neutral-400'}`} strokeWidth={1.8} />
                              <span className={`text-[12px] ${active ? 'font-semibold text-blue-800' : 'font-medium text-neutral-500'}`}>{label}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="h-px bg-neutral-100" />

                    <div className="-my-1 flex items-center gap-2">
                      <span className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-800">
                        Поля для «{KINDS.find((x) => x.k === f.kind)?.label}»
                      </span>
                      <span className="text-[11.5px] text-neutral-400">меняются в зависимости от типа</span>
                    </div>

                    {/* Наименование */}
                    <div className="flex flex-col gap-1.5">
                      <label className={labelCls}>{nameLabel} *</label>
                      <input
                        className={fieldCls}
                        value={f.itemName}
                        onChange={(e) => set({ itemName: e.target.value })}
                        placeholder={nameLabel}
                        required
                      />
                    </div>

                    {/* Строка: производитель/узел + проект */}
                    <div className="grid grid-cols-2 gap-3">
                      {f.kind === 'material' && (
                        <div className="flex flex-col gap-1.5">
                          <label className={labelCls}>Производитель</label>
                          <input className={fieldCls} value={f.manufacturer} onChange={(e) => set({ manufacturer: e.target.value })} placeholder="Напр. Knauf" />
                        </div>
                      )}
                      {f.kind === 'installation' && (
                        <div className="flex flex-col gap-1.5">
                          <label className={labelCls}>Узел / место монтажа</label>
                          <input className={fieldCls} value={f.node} onChange={(e) => set({ node: e.target.value })} placeholder="Узел, отметка" />
                        </div>
                      )}
                      {f.kind === 'works' && (
                        <div className="flex flex-col gap-1.5">
                          <label className={labelCls}>Участок</label>
                          <input className={fieldCls} value={f.section} onChange={(e) => set({ section: e.target.value })} placeholder="Участок работ" />
                        </div>
                      )}
                      {f.kind === 'document' && (
                        <div className="flex flex-col gap-1.5">
                          <label className={labelCls}>Документ</label>
                          <select
                            className={fieldCls}
                            value={f.documentId}
                            onChange={(e) => set({ documentId: e.target.value })}
                            disabled={!f.projectId}
                          >
                            <option value="">{f.projectId ? 'Выберите документ' : 'Сначала проект'}</option>
                            {documents.filter((d) => (d.projectId ?? d.project?.id) === f.projectId).map((d) => (
                              <option key={d.id} value={d.id}>{d.title}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div className="flex flex-col gap-1.5">
                        <label className={labelCls}>Проект (объект)</label>
                        <select className={fieldCls} value={f.projectId} onChange={(e) => set({ projectId: e.target.value, documentId: '' })}>
                          <option value="">Выберите проект</option>
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Кол-во / Цена / Сумма (материал) или Объём/Сумма */}
                    {f.kind === 'material' ? (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <label className={labelCls}>Кол-во</label>
                          <input className={fieldCls} value={f.quantity} onChange={(e) => set({ quantity: e.target.value })} placeholder="540 мешков" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className={labelCls}>Цена за ед.</label>
                          <input className={fieldCls} value={f.unitPrice} onChange={(e) => set({ unitPrice: e.target.value })} placeholder="1 185" inputMode="decimal" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className={labelCls}>Сумма</label>
                          <input className={fieldCls} value={f.amount} onChange={(e) => set({ amount: e.target.value })} placeholder="640 000" inputMode="decimal" />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {(f.kind === 'installation' || f.kind === 'works') && (
                          <div className="flex flex-col gap-1.5">
                            <label className={labelCls}>Объём</label>
                            <input className={fieldCls} value={f.volume} onChange={(e) => set({ volume: e.target.value })} placeholder="Объём / кол-во" />
                          </div>
                        )}
                        <div className="flex flex-col gap-1.5">
                          <label className={labelCls}>{f.kind === 'document' ? 'Сумма договора' : 'Сумма'}</label>
                          <input className={fieldCls} value={f.amount} onChange={(e) => set({ amount: e.target.value })} placeholder="Сумма, ₽" inputMode="decimal" />
                        </div>
                      </div>
                    )}

                    {/* Место применения (материал/монтаж) */}
                    {(f.kind === 'material' || f.kind === 'installation') && (
                      <div className="flex flex-col gap-1.5">
                        <label className={labelCls}>Место применения</label>
                        <div className="grid grid-cols-3 gap-2">
                          <input className={fieldCls} value={f.section} onChange={(e) => set({ section: e.target.value })} placeholder="Секция" />
                          <input className={fieldCls} value={f.floors} onChange={(e) => set({ floors: e.target.value })} placeholder="Этажи 3–7" />
                          <input className={fieldCls} value={f.axes} onChange={(e) => set({ axes: e.target.value })} placeholder="Оси А–Д" />
                        </div>
                      </div>
                    )}

                    {/* Приложения */}
                    <div className="flex flex-col gap-1.5">
                      <label className={labelCls}>Приложения</label>
                      <div className="flex flex-wrap items-center gap-2">
                        {createFormFiles.map((file, i) => (
                          <span key={i} className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-100 px-2.5 py-1.5 text-[12px] text-neutral-700">
                            {file.name}
                            <button type="button" onClick={() => handleRemoveCreateFormFile(i)} className="text-neutral-400 hover:text-red-600">
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                        <input type="file" multiple onChange={handleCreateFormFileUpload} className="hidden" id="create-file-upload" />
                        <label htmlFor="create-file-upload" className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-neutral-300 px-2.5 py-1.5 text-[12px] text-neutral-500 hover:bg-neutral-50">
                          <Plus className="h-3.5 w-3.5" /> Добавить
                        </label>
                      </div>
                    </div>

                    {/* Кто согласует (параллельно) */}
                    <div className="flex flex-col gap-2">
                      <label className={labelCls}>Кто согласует</label>
                      <div className="flex flex-wrap items-center gap-2">
                        {selectedUsers.map((u) => (
                          <span key={u.id} className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-100 py-1 pl-1 pr-2 text-[12px] text-neutral-700">
                            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-neutral-800 text-[9px] font-semibold text-white">{initials(u.name)}</span>
                            {u.name}
                            <button
                              type="button"
                              onClick={() => set({ assigneeIds: f.assigneeIds.filter((id) => id !== u.id) })}
                              className="text-neutral-400 hover:text-red-600"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                        {restUsers.length > 0 && (
                          <select
                            value=""
                            onChange={(e) => { if (e.target.value) set({ assigneeIds: [...f.assigneeIds, e.target.value] }) }}
                            className="rounded-lg border border-dashed border-neutral-300 px-2.5 py-1.5 text-[12px] text-neutral-500 focus:outline-none"
                          >
                            <option value="">+ добавить</option>
                            {restUsers.map((u) => (
                              <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11.5px] text-neutral-400">
                        <span className="flex h-3.5 w-3.5 items-center justify-center rounded-[4px] bg-blue-600">
                          <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                        </span>
                        Заявка придёт всем сразу · согласуют параллельно, порядок не важен
                      </div>
                    </div>
                  </div>

                  {/* футер */}
                  <div className="flex items-center justify-between border-t border-neutral-100 px-6 py-4">
                    <span className="text-[12px] text-neutral-400">Заявку получат все согласующие сразу</span>
                    <div className="flex gap-2.5">
                      <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>Отмена</Button>
                      <Button type="submit" disabled={uploadingCreateFiles || f.assigneeIds.length === 0} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
                        {uploadingCreateFiles ? 'Отправка…' : 'Отправить на согласование'}
                      </Button>
                    </div>
                  </div>
                </form>
              )
            })()}
          </DialogContent>
        </Dialog>


        {/* Approval Details Modal */}
        {showDetailsModal && selectedApproval && (
          <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
            <DialogContent className="max-h-[90vh] max-w-[900px] gap-0 overflow-hidden p-0">
              <DialogTitle className="sr-only">Окно согласования</DialogTitle>
              {(() => {
                const a = selectedApproval
                const kind = kindOf(a)
                const KindIcon = KIND_ICON[kind]
                const d = (a.data || {}) as Record<string, any>
                const amount = amountOf(a)
                const st = rowStatus(a)
                const total = a.assignments.length
                const done = approvedCount(a)
                const mine = canUserRespond(a)
                const STATUS: Record<string, { label: string; cls: string }> = {
                  rejected: { label: 'Отклонён', cls: 'bg-red-50 text-red-600 border-red-200' },
                  approved: { label: 'Согласован', cls: 'bg-green-50 text-green-700 border-green-200' },
                  mine: { label: 'Ждёт вас', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
                  inwork: { label: 'В работе', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
                }
                const badge = STATUS[st]
                const secLabel = 'mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-neutral-400'
                const cell = (label: string, value: any, valueCls = '') => (
                  <div className="border-b border-neutral-100 px-[15px] py-[11px] last:border-b-0 [&:nth-child(odd)]:border-r">
                    <div className="text-[11px] text-neutral-400">{label}</div>
                    <div className={`mt-0.5 text-[13px] font-medium text-neutral-900 tabular-nums ${valueCls}`}>{value}</div>
                  </div>
                )
                const hasPlace = d.section || d.floors || d.axes || d.area
                return (
                  <div className="flex max-h-[90vh] min-h-0 flex-col overflow-hidden">
                    {/* header */}
                    <div className="px-6 pt-5">
                      <div className="flex items-start gap-3">
                        <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[11px] border border-blue-100 bg-blue-50 text-blue-700">
                          <KindIcon className="h-5 w-5" strokeWidth={1.8} />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2.5">
                            <span className="text-[17px] font-bold text-neutral-900">Согласование {KIND_LABEL[kind].toLowerCase()}</span>
                            <span className={`inline-flex rounded-[7px] border px-2 py-[3px] text-[11.5px] font-medium ${badge.cls}`}>{badge.label}</span>
                          </div>
                          <div className="mt-1 text-[12.5px] text-neutral-400">
                            {a.project?.name ? `${a.project.name} · ` : ''}инициатор {a.creator.name} ·{' '}
                            {new Date(a.createdAt).toLocaleDateString('ru-RU')}
                          </div>
                        </div>
                      </div>
                      {/* тип заявки (read-only) */}
                      <div className="mt-4 flex gap-1.5">
                        {(['material', 'installation', 'works', 'document'] as const).map((k) => (
                          <span
                            key={k}
                            className={`rounded-lg px-3 py-1.5 text-[12px] ${
                              k === kind ? 'bg-blue-50 font-semibold text-blue-800' : 'bg-neutral-100 font-medium text-neutral-400'
                            }`}
                          >
                            {KIND_LABEL[k]}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* body */}
                    <div className="mt-4 grid min-h-0 flex-1 grid-cols-1 overflow-hidden border-t border-neutral-100 md:grid-cols-[1fr_320px]">
                      {/* левая колонка */}
                      <div className="flex min-h-0 flex-col gap-5 overflow-y-auto border-neutral-100 p-6 md:border-r">
                        {/* Что согласуем */}
                        <section>
                          <div className={secLabel}>Что согласуем</div>
                          <div className="overflow-hidden rounded-xl border border-neutral-200">
                            <div className="flex items-center gap-3 bg-neutral-50 px-[15px] py-[13px]">
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[9px] border border-neutral-200 bg-white text-neutral-500">
                                <KindIcon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                              </span>
                              <div className="min-w-0">
                                <div className="truncate text-[14px] font-semibold text-neutral-900">{d.itemName || a.title}</div>
                                <div className="truncate text-[12px] text-neutral-400">{d.itemSubtitle || KIND_LABEL[kind]}</div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2">
                              {cell('Производитель', d.manufacturer || '—')}
                              {cell(
                                'По проекту',
                                d.matchesProject === true ? 'Соответствует ✓' : d.matchesProject === false ? 'Не соответствует' : '—',
                                d.matchesProject === true ? 'text-green-700' : d.matchesProject === false ? 'text-red-600' : '',
                              )}
                              {cell('Кол-во', d.quantity || '—')}
                              {cell('Сумма закупки', amount != null ? fmtMoney(amount) : '—', 'font-semibold')}
                            </div>
                          </div>
                          {d.unitPrice != null && d.estimatePrice != null && (
                            <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2">
                              <span className="text-[12px] text-neutral-600">
                                Цена за ед. <b>{fmtMoney(Number(d.unitPrice))}</b> · в смете заложено <b>{fmtMoney(Number(d.estimatePrice))}</b>
                              </span>
                              {Number(d.unitPrice) <= Number(d.estimatePrice) && (
                                <span className="ml-auto rounded-md border border-green-200 bg-green-50 px-2 py-0.5 text-[11.5px] font-semibold text-green-700">
                                  {Math.round((Number(d.unitPrice) / Number(d.estimatePrice) - 1) * 100)}% к смете
                                </span>
                              )}
                            </div>
                          )}
                          {!d.itemName && a.description && (
                            <p className="mt-2.5 text-[13px] leading-relaxed text-neutral-600">{a.description}</p>
                          )}
                        </section>

                        {/* Место применения */}
                        {hasPlace && (
                          <section>
                            <div className={secLabel}>Место применения</div>
                            <div className="flex flex-col gap-2.5">
                              {d.section && (
                                <div className="flex items-center gap-2 text-[13px]">
                                  <MapPin className="h-4 w-4 shrink-0 text-blue-600" />
                                  <span>
                                    <b>{d.section}</b>
                                    {d.floors ? ` · ${d.floors}` : ''}
                                  </span>
                                </div>
                              )}
                              {d.zone && <div className="text-[13px] text-neutral-700">{d.zone}</div>}
                              {(d.axes || d.area) && (
                                <div className="text-[13px] text-neutral-700">
                                  {[d.axes, d.area].filter(Boolean).join(' · ')}
                                </div>
                              )}
                            </div>
                          </section>
                        )}

                        {/* Приложения */}
                        <section>
                          <div className={secLabel}>Приложения{attachments.length ? ` · ${attachments.length}` : ''}</div>
                          {attachments.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                              {attachments.map((att) => {
                                const ext = (att.fileName.split('.').pop() || '').toUpperCase()
                                return (
                                  <button
                                    key={att.id}
                                    onClick={() => window.open(`/api/approvals/${a.id}/attachments/${att.id}/download`, '_blank')}
                                    className="flex items-center gap-2.5 rounded-[10px] border border-neutral-200 px-[11px] py-2.5 text-left hover:bg-neutral-50"
                                  >
                                    <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[7px] bg-blue-50 text-blue-700">
                                      <FileText className="h-4 w-4" />
                                    </span>
                                    <span className="min-w-0">
                                      <span className="block truncate text-[12px] font-medium text-neutral-900">{att.fileName}</span>
                                      <span className="block text-[10.5px] text-neutral-400">{ext || 'файл'}</span>
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                          ) : (
                            <p className="text-[13px] text-neutral-400">Нет вложений</p>
                          )}
                          <div className="mt-2.5">
                            <input
                              type="file"
                              id="file-upload"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) handleFileUpload(a.id, file)
                              }}
                              disabled={uploadingFile}
                            />
                            <button
                              onClick={() => document.getElementById('file-upload')?.click()}
                              disabled={uploadingFile}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-neutral-300 px-3 py-1.5 text-[12px] text-neutral-500 hover:bg-neutral-50 disabled:opacity-60"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              {uploadingFile ? 'Загрузка…' : 'Добавить файл'}
                            </button>
                          </div>
                        </section>
                      </div>

                      {/* правая колонка — согласующие + обсуждение */}
                      <div className="flex min-h-0 flex-col overflow-hidden border-t border-neutral-100 bg-neutral-50 md:border-t-0">
                        <div className="border-b border-neutral-100 p-5">
                          <div className={secLabel}>Согласовали · {done} из {total}</div>
                          <div className="flex flex-wrap items-center gap-2">
                            {a.assignments.map((asg) => {
                              const approved = asg.status === 'APPROVED'
                              const rejected = asg.status === 'REJECTED'
                              const isMe = asg.user.id === currentUser?.id
                              return (
                                <span key={asg.id} className="relative" title={`${asg.user.name}${approved ? ' · согласовал' : rejected ? ' · отклонил' : ' · ждёт'}`}>
                                  <span
                                    className={`flex h-[26px] w-[26px] items-center justify-center rounded-full text-[9px] font-semibold text-white ${
                                      isMe ? 'bg-neutral-900' : approved ? 'bg-teal-600' : rejected ? 'bg-red-500' : 'bg-neutral-300'
                                    }`}
                                  >
                                    {initials(asg.user.name)}
                                  </span>
                                  {approved && (
                                    <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full border-2 border-neutral-50 bg-green-600">
                                      <Check className="h-2 w-2 text-white" strokeWidth={4} />
                                    </span>
                                  )}
                                </span>
                              )
                            })}
                            {mine && <span className="ml-1 text-[11.5px] font-medium text-blue-600">ждёт вас</span>}
                          </div>
                          <p className="mt-2.5 text-[11.5px] leading-relaxed text-neutral-400">
                            Все согласуют параллельно — порядок не важен.
                          </p>
                        </div>
                        <div className="flex min-h-0 flex-1 flex-col p-5">
                          <div className={secLabel}>Обсуждение{a.comments.length ? ` · ${a.comments.length}` : ''}</div>
                          <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto">
                            {a.comments.length === 0 ? (
                              <p className="text-[12px] text-neutral-400">Комментариев пока нет.</p>
                            ) : (
                              [...a.comments].reverse().map((c) => (
                                <div key={c.id} className="flex gap-2.5">
                                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-600 text-[9px] font-semibold text-white">
                                    {initials(c.user.name)}
                                  </span>
                                  <div className="min-w-0">
                                    <div className="text-[12.5px]">
                                      <span className="font-semibold text-neutral-900">{c.user.name}</span>{' '}
                                      <span className="text-neutral-400">
                                        · {new Date(c.createdAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                                      </span>
                                    </div>
                                    <div className="mt-0.5 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[12.5px] leading-relaxed text-neutral-700">{c.content}</div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                          <div className="mt-3 flex items-end gap-2 border-t border-neutral-100 pt-3">
                            <textarea
                              value={newComment}
                              onChange={(e) => setNewComment(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault()
                                  handleAddComment(a.id)
                                }
                              }}
                              rows={1}
                              placeholder="Написать комментарий…"
                              className="max-h-24 min-h-[38px] flex-1 resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[12.5px] text-neutral-800 placeholder:text-neutral-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                            <Button
                              type="button"
                              onClick={() => handleAddComment(a.id)}
                              disabled={commentLoading || !newComment.trim()}
                              className="h-[38px] shrink-0 bg-blue-600 px-3 hover:bg-blue-700"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* панель решения */}
                    <div className="flex items-center gap-3 border-t border-neutral-100 px-6 py-4">
                      <button
                        onClick={() => handleDeleteApprovalClick(a.id)}
                        className="inline-flex items-center gap-1.5 text-[12px] text-neutral-400 hover:text-red-600"
                        title="Удалить заявку"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Удалить
                      </button>
                      <div className="ml-auto flex gap-2.5">
                        {mine ? (
                          <>
                            <Button
                              variant="outline"
                              onClick={() => setShowRejectModal(true)}
                              className="border-neutral-200 text-neutral-600"
                            >
                              На доработку
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setShowRejectModal(true)}
                              className="border-red-200 text-red-600 hover:bg-red-50"
                            >
                              Отклонить
                            </Button>
                            <Button
                              onClick={() => {
                                handleApprove(a.id)
                                setShowDetailsModal(false)
                              }}
                              className="gap-1.5 bg-green-700 text-white hover:bg-green-800"
                            >
                              <Check className="h-4 w-4" strokeWidth={2.6} />
                              Согласовать
                            </Button>
                          </>
                        ) : (
                          <Button variant="outline" onClick={() => setShowDetailsModal(false)}>
                            Закрыть
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}
            </DialogContent>
          </Dialog>
        )}

        {/* 4b — модалка отклонения (причина) */}
        {showRejectModal && selectedApproval && (
          <Dialog open={showRejectModal} onOpenChange={(v) => { setShowRejectModal(v); if (!v) setRejectComment('') }}>
            <DialogContent className="max-w-[420px] gap-0 p-0">
              <DialogTitle className="sr-only">Отклонить заявку</DialogTitle>
              <div className="flex items-start gap-3 border-b border-neutral-100 px-6 pb-[18px] pt-[22px]">
                <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[11px] border border-red-200 bg-red-50 text-red-600">
                  <XCircle className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="text-[16px] font-bold text-neutral-900">Отклонить заявку</div>
                  <div className="mt-0.5 truncate text-[12.5px] text-neutral-400">{selectedApproval.title}</div>
                </div>
              </div>
              <div className="flex flex-col gap-4 px-6 py-5">
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-medium text-neutral-700">Причина отклонения *</label>
                  <div className="flex flex-wrap gap-1.5">
                    {['Не соответствует проекту', 'Цена выше сметы', 'Нет сертификата', 'Другое'].map((r) => {
                      const active = rejectComment === r
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRejectComment(active ? '' : r)}
                          className={`rounded-lg border px-2.5 py-1.5 text-[12px] ${
                            active ? 'border-red-300 bg-red-50 font-medium text-red-600' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                          }`}
                        >
                          {r}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-medium text-neutral-700">Что исправить</label>
                  <textarea
                    value={rejectComment}
                    onChange={(e) => setRejectComment(e.target.value)}
                    rows={3}
                    placeholder="Опишите, что нужно поправить…"
                    className="w-full resize-none rounded-lg border border-neutral-200 px-3 py-2 text-[13px] text-neutral-800 placeholder:text-neutral-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <span className="text-[12px] leading-relaxed text-amber-800">Заявка вернётся автору с вашим комментарием.</span>
                </div>
              </div>
              <div className="flex justify-end gap-2.5 border-t border-neutral-100 px-6 py-4">
                <Button variant="outline" onClick={() => { setShowRejectModal(false); setRejectComment('') }}>Отмена</Button>
                <Button
                  disabled={!rejectComment.trim() || rejectBusy}
                  onClick={async () => {
                    setRejectBusy(true)
                    try {
                      await handleReject(selectedApproval.id, rejectComment.trim())
                      setShowRejectModal(false)
                      setShowDetailsModal(false)
                      setRejectComment('')
                    } finally {
                      setRejectBusy(false)
                    }
                  }}
                  className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                >
                  Отклонить и вернуть
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

      </div>
    </Layout>
  )
}

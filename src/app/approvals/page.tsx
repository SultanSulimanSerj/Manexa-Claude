'use client'

import { useState, useEffect } from 'react'
import Layout from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, CheckCircle, X, Clock, XCircle, FileText, Users, Calendar, MessageSquare, Paperclip, History, AlertCircle, Eye, Trash2 } from 'lucide-react'
import ExpandableDescription from '@/components/expandable-description'
import ApprovalProgress from '@/components/approval-progress'
import { ErrorBanner } from '@/components/ui/error-banner'

// Обновленные интерфейсы с новыми полями
interface Approval {
  id: string
  title: string
  description: string | null
  status: string
  type: string
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
  const [confirmModal, setConfirmModal] = useState<
    { type: 'deleteApproval'; approvalId: string } | { type: 'deleteAttachment'; approvalId: string; attachmentId: string } | null
  >(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

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
        
        setApprovals([newApproval, ...approvals])
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
        console.log('Approval response:', result)
        await fetchApprovals()
        // Обновляем выбранное согласование если оно открыто
        if (selectedApproval?.id === approvalId) {
          setSelectedApproval(result)
        }
      } else {
        const error = await response.json()
        setToast({ type: 'error', text: error.error || 'Ошибка при одобрении' })
      }
    } catch (err) {
      console.error(err)
      setToast({ type: 'error', text: 'Ошибка при одобрении' })
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
        console.log('Reject response:', result)
        await fetchApprovals()
        // Обновляем выбранное согласование если оно открыто
        if (selectedApproval?.id === approvalId) {
          setSelectedApproval(result)
        }
      } else {
        const error = await response.json()
        setToast({ type: 'error', text: error.error || 'Ошибка при отклонении' })
      }
    } catch (err) {
      console.error(err)
      setToast({ type: 'error', text: 'Ошибка при отклонении' })
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
        setToast({ type: 'success', text: 'Файл загружен успешно' })
        const fileInput = document.getElementById('file-upload') as HTMLInputElement
        if (fileInput) fileInput.value = ''
      } else {
        setToast({ type: 'error', text: 'Ошибка при загрузке файла' })
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      setToast({ type: 'error', text: 'Ошибка при загрузке файла' })
    } finally {
      setUploadingFile(false)
    }
  }

  const handleDeleteAttachmentClick = (attachmentId: string, approvalId: string) => {
    setConfirmModal({ type: 'deleteAttachment', approvalId, attachmentId })
  }

  const handleDeleteAttachmentConfirm = async () => {
    if (!confirmModal || confirmModal.type !== 'deleteAttachment') return
    const { approvalId, attachmentId } = confirmModal
    setConfirmModal(null)
    try {
      const response = await fetch(`/api/approvals/${approvalId}/attachments/${attachmentId}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        await fetchAttachments(approvalId)
        setToast({ type: 'success', text: 'Файл удалён' })
      } else {
        setToast({ type: 'error', text: 'Ошибка при удалении файла' })
      }
    } catch (error) {
      console.error('Error deleting attachment:', error)
      setToast({ type: 'error', text: 'Ошибка при удалении файла' })
    }
  }

  const handleDeleteApprovalClick = (approvalId: string) => {
    setConfirmModal({ type: 'deleteApproval', approvalId })
  }

  const handleDeleteApprovalConfirm = async () => {
    if (!confirmModal || confirmModal.type !== 'deleteApproval') return
    const { approvalId } = confirmModal
    setConfirmModal(null)
    try {
      const response = await fetch(`/api/approvals/${approvalId}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        setApprovals(prev => prev.filter(a => a.id !== approvalId))
        setShowDetailsModal(false)
        setSelectedApproval(null)
        setToast({ type: 'success', text: 'Согласование удалено' })
      } else {
        setToast({ type: 'error', text: 'Ошибка при удалении согласования' })
      }
    } catch (error) {
      console.error('Error deleting approval:', error)
      setToast({ type: 'error', text: 'Ошибка при удалении согласования' })
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

  const filteredApprovals = approvals.filter(approval => {
    const statusMatch = statusFilter === 'all' || approval.status === statusFilter
    const priorityMatch = priorityFilter === 'all' || approval.priority === priorityFilter
    const projectMatch =
      projectFilter === 'all' ||
      (projectFilter === 'none' ? !approval.project?.id : approval.project?.id === projectFilter)
    return statusMatch && priorityMatch && projectMatch
  })

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-sm text-gray-600">Загрузка...</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <ErrorBanner message={loadError} onDismiss={() => setLoadError(null)} />
      {/* Тосты */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 max-w-sm animate-in fade-in slide-in-from-right-5 duration-200">
          <div className={`rounded-xl shadow-lg border p-4 flex items-center gap-3 ${
            toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {toast.type === 'success' ? (
              <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
            )}
            <p className="text-sm font-medium flex-1">{toast.text}</p>
            <button onClick={() => setToast(null)} className="p-1 hover:opacity-70 shrink-0">×</button>
          </div>
        </div>
      )}

      {/* Модалка подтверждения удаления */}
      {confirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/20" onClick={() => setConfirmModal(null)} aria-hidden />
          <div className="relative bg-white rounded-2xl shadow-xl border border-gray-200 p-6 max-w-sm w-full text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {confirmModal.type === 'deleteApproval' ? 'Удалить согласование?' : 'Удалить файл?'}
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              {confirmModal.type === 'deleteApproval'
                ? 'Это действие необратимо.'
                : 'Файл будет удалён без возможности восстановления.'}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={confirmModal.type === 'deleteApproval' ? handleDeleteApprovalConfirm : handleDeleteAttachmentConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Согласования</h1>
            <p className="text-sm text-gray-600 mt-1">
              {filteredApprovals.length === approvals.length
                ? `${approvals.length} согласований`
                : `${filteredApprovals.length} из ${approvals.length} согласований`}
            </p>
          </div>
          <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Создать согласование
          </Button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg p-4 border">
          <div className="flex gap-3 flex-wrap items-center">
            {/* Project Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 shrink-0">Проект:</span>
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="pl-3 pr-8 py-1.5 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px]"
              >
                <option value="all">Все проекты</option>
                <option value="none">Без проекта</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex gap-2">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  statusFilter === 'all' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Все статусы
              </button>
              <button
                onClick={() => setStatusFilter('PENDING')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  statusFilter === 'PENDING' ? 'bg-yellow-50 text-yellow-600' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Ожидают
              </button>
              <button
                onClick={() => setStatusFilter('APPROVED')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  statusFilter === 'APPROVED' ? 'bg-green-50 text-green-600' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Одобрено
              </button>
              <button
                onClick={() => setStatusFilter('REJECTED')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  statusFilter === 'REJECTED' ? 'bg-red-50 text-red-600' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Отклонено
              </button>
            </div>

            {/* Priority Filter */}
            <div className="flex gap-2">
              <button
                onClick={() => setPriorityFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  priorityFilter === 'all' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Все приоритеты
              </button>
              <button
                onClick={() => setPriorityFilter('URGENT')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  priorityFilter === 'URGENT' ? 'bg-red-50 text-red-600' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Срочные
              </button>
              <button
                onClick={() => setPriorityFilter('HIGH')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  priorityFilter === 'HIGH' ? 'bg-orange-50 text-orange-600' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Высокие
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" style={{ width: '200px' }}>Согласование</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Тип</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Приоритет</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" style={{ width: '140px' }}>Срок</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Проект</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Создатель</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" style={{ width: '150px' }}>Действия</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredApprovals.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-sm text-gray-500">
                      Нет согласований
                    </td>
                  </tr>
                ) : (
                  filteredApprovals.map((approval) => (
                    <tr key={approval.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3" style={{ maxWidth: '260px', width: '260px' }}>
                        <div className="space-y-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-900 line-clamp-2 break-words">{approval.title}</div>
                          {approval.description && (
                            <p className="text-xs text-gray-500 line-clamp-2 break-words">
                              {approval.description.length > 100 ? approval.description.slice(0, 100) + '…' : approval.description}
                            </p>
                          )}
                          {approval.document && (
                            <div className="text-xs text-blue-600 mt-0.5">
                              Документ: {approval.document.title}
                              {approval.document.isPublished && (
                                <span className="ml-1 text-green-600">✓ Опубликован</span>
                              )}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            {approval._count.comments > 0 && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                {approval._count.comments}
                              </span>
                            )}
                            {approval._count.attachments > 0 && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Paperclip className="h-3 w-3" />
                                {approval._count.attachments}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-700">{getTypeText(approval.type)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getPriorityColor(approval.priority)}`}>
                          {getPriorityText(approval.priority)}
                        </span>
                      </td>
                      <td className="px-4 py-3" style={{ width: '140px' }}>
                        {approval.dueDate ? (
                          <div className={`text-sm ${isOverdue(approval.dueDate) ? 'text-red-600 font-medium' : 'text-gray-700'}`}>
                            {new Date(approval.dueDate).toLocaleDateString('ru-RU')}
                            {isOverdue(approval.dueDate) && (
                              <AlertCircle className="h-4 w-4 inline ml-1" />
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-400">—</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-700">{approval.project?.name || '—'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getStatusColor(approval.status)}`}>
                          {getStatusText(approval.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-700">{approval.creator.name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-700">
                          {new Date(approval.createdAt).toLocaleDateString('ru-RU')}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ width: '150px' }}>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedApproval(approval)
                              setShowDetailsModal(true)
                              fetchAttachments(approval.id)
                            }}
                            title="Детали согласования"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedApproval(approval)
                              setShowCommentsModal(true)
                            }}
                            title="Комментарии"
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedApproval(approval)
                              setShowAttachmentsModal(true)
                            }}
                            title="Вложения"
                          >
                            <Paperclip className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedApproval(approval)
                              setShowHistoryModal(true)
                            }}
                            title="История изменений"
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          {canUserRespond(approval) && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleApprove(approval.id)}
                                className="text-green-600 hover:text-green-700"
                                title="Одобрить согласование"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleReject(approval.id)}
                                className="text-red-600 hover:text-red-700"
                                title="Отклонить согласование"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteApprovalClick(approval.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Удалить согласование"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create Approval Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle>Создать согласование</CardTitle>
                <CardDescription>
                  Создайте новое согласование для документа или проекта
                </CardDescription>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          </div>
        )}

        {/* Approval Details Modal */}
        {showDetailsModal && selectedApproval && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden min-w-0">
              <CardHeader className="min-w-0">
                <CardTitle className="break-words">{selectedApproval.title}</CardTitle>
                <CardDescription>
                  Детали согласования
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 min-w-0 overflow-x-hidden">
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
              </CardContent>
            </Card>
          </div>
        )}

        {/* Comments Modal */}
        {showCommentsModal && selectedApproval && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle>Комментарии</CardTitle>
                <CardDescription>
                  Обсуждение согласования "{selectedApproval.title}"
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
              </CardContent>
            </Card>
          </div>
        )}

        {/* Attachments Modal */}
        {showAttachmentsModal && selectedApproval && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle>Вложения</CardTitle>
                <CardDescription>
                  Файлы согласования "{selectedApproval.title}"
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
              </CardContent>
            </Card>
          </div>
        )}

        {/* History Modal */}
        {showHistoryModal && selectedApproval && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle>История изменений</CardTitle>
                <CardDescription>
                  История согласования "{selectedApproval.title}"
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  )
}

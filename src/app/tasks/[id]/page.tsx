'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Layout from '@/components/layout'
import PageHeader from '@/components/page-header'
import { SkeletonList } from '@/components/ui/skeleton'
import {
  ArrowLeft, 
  Edit, 
  Calendar, 
  User, 
  FolderOpen, 
  MessageSquare, 
  Send, 
  Save, 
  X,
  CheckSquare,
  Square,
  Check,
  Plus,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Circle,
  XCircle,
  ChevronDown
} from 'lucide-react'
import Link from 'next/link'

interface TaskDetail {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  dueDate: string | null
  createdAt: string
  project: { id: string; name: string } | null
  creator: { id: string; name: string }
  assignments: Array<{ user: { id: string; name: string } }>
  subtasks?: Subtask[]
}

interface Comment {
  id: string
  content: string
  createdAt: string
  user: { name: string; id: string }
}

interface User {
  id: string
  name: string
  email: string
}

interface Subtask {
  id: string
  title: string
  isCompleted: boolean
  orderIndex: number
}

export default function TaskDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const [task, setTask] = useState<TaskDetail | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newComment, setNewComment] = useState('')
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [showSubtaskInput, setShowSubtaskInput] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [editingStatus, setEditingStatus] = useState(false)
  const [editingPriority, setEditingPriority] = useState(false)
  const [editingDueDate, setEditingDueDate] = useState(false)
  const [editingAssignees, setEditingAssignees] = useState(false)
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false)
  const [mentionSearch, setMentionSearch] = useState('')
  const [cursorPosition, setCursorPosition] = useState(0)
  const commentInputRef = useRef<HTMLTextAreaElement>(null)
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    status: 'TODO',
    priority: 'MEDIUM',
    dueDate: '',
    assigneeIds: [] as string[]
  })

  useEffect(() => {
    const taskId = Array.isArray(params?.id) ? params.id[0] : params?.id
    if (taskId) {
      fetchTask()
      fetchComments()
      fetchUsers()
      fetchSubtasks()
    } else {
      setError('ID задачи не найден в URL')
      setLoading(false)
    }
  }, [params?.id])

  const fetchTask = async () => {
    const taskId = Array.isArray(params?.id) ? params.id[0] : params?.id
    if (!taskId) {
      setError('ID задачи не указан')
      setLoading(false)
      return
    }
    
    try {
      const response = await fetch(`/api/tasks/${taskId}`)
      
      if (response.ok) {
        const data = await response.json()
        setTask(data)
        setError(null)
        // Если подзадачи пришли с задачей, используем их
        if (data.subtasks && data.subtasks.length > 0) {
          setSubtasks(data.subtasks)
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('Failed to fetch task:', response.status, errorData)
        setError(errorData.error || `Ошибка загрузки задачи (${response.status})`)
      }
    } catch (err) {
      console.error('Error fetching task:', err)
      setError('Ошибка при загрузке задачи. Проверьте консоль для деталей.')
    } finally {
      setLoading(false)
    }
  }

  const fetchComments = async () => {
    const taskId = Array.isArray(params?.id) ? params.id[0] : params?.id
    if (!taskId) return
    
    try {
      const response = await fetch(`/api/tasks/${taskId}/comments`)
      if (response.ok) {
        const data = await response.json()
        setComments(data.comments || [])
      }
    } catch (err) {
      console.error(err)
    }
  }

  const fetchSubtasks = async () => {
    const taskId = Array.isArray(params?.id) ? params.id[0] : params?.id
    if (!taskId) return
    
    try {
      const response = await fetch(`/api/tasks/${taskId}/subtasks`)
      if (response.ok) {
        const data = await response.json()
        setSubtasks(data.subtasks || [])
      } else {
        // Если API возвращает ошибку (например, таблица еще не создана), просто игнорируем
        setSubtasks([])
      }
    } catch (err) {
      // Если API не существует, просто игнорируем
      setSubtasks([])
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Быстрое изменение статуса
  const handleStatusChange = async (newStatus: string) => {
    if (!task) return
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      if (response.ok) {
        setTask({ ...task, status: newStatus })
        setEditingStatus(false)
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Быстрое изменение приоритета
  const handlePriorityChange = async (newPriority: string) => {
    if (!task) return
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: newPriority })
      })
      if (response.ok) {
        setTask({ ...task, priority: newPriority })
        setEditingPriority(false)
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Быстрое изменение дедлайна
  const handleDueDateChange = async (newDate: string) => {
    if (!task) return
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dueDate: newDate ? new Date(newDate).toISOString() : null })
      })
      if (response.ok) {
        setTask({ ...task, dueDate: newDate ? new Date(newDate).toISOString() : null })
        setEditingDueDate(false)
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Быстрое добавление/удаление исполнителя
  const handleAssigneeToggle = async (userId: string, isAdding: boolean) => {
    if (!task) return
    const currentIds = task.assignments.map(a => a.user.id)
    const newIds = isAdding 
      ? [...currentIds, userId]
      : currentIds.filter(id => id !== userId)
    
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigneeIds: newIds })
      })
      if (response.ok) {
        await fetchTask()
        setEditingAssignees(false)
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Добавление подзадачи
  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSubtaskTitle.trim() || !task) return

    try {
      const response = await fetch(`/api/tasks/${task.id}/subtasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newSubtaskTitle })
      })
      if (response.ok) {
        setNewSubtaskTitle('')
        setShowSubtaskInput(false)
        await fetchSubtasks()
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Переключение подзадачи
  const handleToggleSubtask = async (subtaskId: string, isCompleted: boolean) => {
    const taskId = Array.isArray(params?.id) ? params.id[0] : params?.id
    if (!taskId) return
    
    try {
      const response = await fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: !isCompleted })
      })
      if (response.ok) {
        await fetchSubtasks()
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Удаление подзадачи
  const handleDeleteSubtask = async (subtaskId: string) => {
    const taskId = Array.isArray(params?.id) ? params.id[0] : params?.id
    if (!taskId) return
    
    try {
      const response = await fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        await fetchSubtasks()
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Обработка комментария с упоминаниями
  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    const cursorPos = e.target.selectionStart || 0
    setNewComment(value)
    setCursorPosition(cursorPos)

    const textBeforeCursor = value.substring(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1)
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setMentionSearch(textAfterAt.toLowerCase())
        setShowMentionSuggestions(true)
      } else {
        setShowMentionSuggestions(false)
      }
    } else {
      setShowMentionSuggestions(false)
    }
  }

  const insertMention = (userName: string) => {
    const textBeforeCursor = newComment.substring(0, cursorPosition)
    const textAfterCursor = newComment.substring(cursorPosition)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    
    if (lastAtIndex !== -1) {
      const newText = 
        textBeforeCursor.substring(0, lastAtIndex) + 
        `@${userName} ` + 
        textAfterCursor
      
      setNewComment(newText)
      setShowMentionSuggestions(false)
      setTimeout(() => commentInputRef.current?.focus(), 0)
    }
  }

  const getMentionSuggestions = () => {
    const search = mentionSearch.trim()
    return users
      .filter(user =>
        !search ||
        user.name.toLowerCase().includes(search) ||
        user.email.toLowerCase().includes(search)
      )
      .slice(0, 8)
  }

  const formatCommentWithMentions = (content: string) => {
    const parts: React.ReactNode[] = []
    let lastIndex = 0
    const mentionRegex = /@([^\s@]+(?:\s+[^\s@]+)*)/g
    let match

    while ((match = mentionRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {content.substring(lastIndex, match.index)}
          </span>
        )
      }
      const name = match[1].trim()
      const isMentioningMe = name === session?.user?.name
      parts.push(
        <span
          key={`mention-${match.index}`}
          className={`${
            isMentioningMe
              ? 'bg-gray-900 text-white font-semibold'
              : 'bg-gray-100 text-gray-700 font-medium'
          } px-1 rounded`}
        >
          @{name}
        </span>
      )
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < content.length) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {content.substring(lastIndex)}
        </span>
      )
    }
    return parts.length > 0 ? parts : content
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return

    // Извлекаем упоминания
    const mentionRegex = /@([^\s@]+(?:\s+[^\s@]+)*)/g
    const mentions: string[] = []
    let match
    while ((match = mentionRegex.exec(newComment)) !== null) {
      mentions.push(match[1].trim())
    }

    const taskId = Array.isArray(params?.id) ? params.id[0] : params?.id
    if (!taskId) return
    
    try {
      const response = await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment, mentions })
      })

      if (response.ok) {
        setNewComment('')
        setShowMentionSuggestions(false)
        await fetchComments()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleEditTask = () => {
    if (!task) return
    
    setEditForm({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      assigneeIds: task.assignments.map(a => a.user.id)
    })
    setShowEditModal(true)
  }

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault()
    const taskId = Array.isArray(params?.id) ? params.id[0] : params?.id
    if (!taskId) return
    
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description,
          status: editForm.status,
          priority: editForm.priority,
          dueDate: editForm.dueDate ? new Date(editForm.dueDate).toISOString() : null,
          assigneeIds: editForm.assigneeIds
        })
      })

      if (response.ok) {
        setShowEditModal(false)
        await fetchTask()
      }
    } catch (err) {
      console.error(err)
    }
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

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      'TODO': 'К выполнению',
      'IN_PROGRESS': 'В работе',
      'COMPLETED': 'Завершена',
      'CANCELLED': 'Отменена'
    }
    return map[status] || status
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle2 className="h-4 w-4" />
      case 'IN_PROGRESS': return <Circle className="h-4 w-4" />
      case 'CANCELLED': return <XCircle className="h-4 w-4" />
      default: return <Square className="h-4 w-4" />
    }
  }

  const getPriorityColor = (priority: string) => {
    const map: Record<string, string> = {
      'HIGH': 'bg-red-100 text-red-800 border-red-200',
      'MEDIUM': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'LOW': 'bg-green-100 text-green-800 border-green-200'
    }
    return map[priority] || 'bg-gray-100 text-gray-800'
  }

  const getPriorityText = (priority: string) => {
    const map: Record<string, string> = {
      'HIGH': 'Высокий',
      'MEDIUM': 'Средний',
      'LOW': 'Низкий'
    }
    return map[priority] || priority
  }

  const getDaysUntilDue = (dueDate: string | null) => {
    if (!dueDate) return null
    const due = new Date(dueDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    due.setHours(0, 0, 0, 0)
    const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }

  const completedSubtasks = subtasks.filter(s => s.isCompleted).length
  const progressPercent = subtasks.length > 0 ? (completedSubtasks / subtasks.length) * 100 : 0

  // 8b helpers
  const AV_COLORS = ['#1c7fd6', '#0d9488', '#b45309', '#7c3aed', '#c2410c', '#0369a1']
  const initials = (name?: string) => {
    if (!name) return '?'
    const p = name.trim().split(/\s+/)
    return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '?'
  }
  const avColor = (id: string) => AV_COLORS[Math.abs(id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % AV_COLORS.length]
  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      'TODO': 'bg-neutral-50 text-neutral-700 border-neutral-200',
      'IN_PROGRESS': 'bg-amber-50 text-amber-700 border-amber-200',
      'COMPLETED': 'bg-green-50 text-green-700 border-green-200',
      'CANCELLED': 'bg-red-50 text-red-700 border-red-200'
    }
    return map[status] || 'bg-neutral-50 text-neutral-700 border-neutral-200'
  }
  const priorityDot = (priority: string) => {
    const map: Record<string, string> = { 'HIGH': '#dc2626', 'MEDIUM': '#b45309', 'LOW': '#16a34a' }
    return map[priority] || '#a1a1aa'
  }

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <PageHeader title="Задача" description="Загрузка..." back="/tasks" />
          <SkeletonList rows={6} />
        </div>
      </Layout>
    )
  }

  if (error || !task) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-lg font-medium text-gray-900 mb-2">
              {error || 'Задача не найдена'}
            </p>
            <div className="flex gap-3 justify-center mt-4">
              <Link
                href="/tasks"
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm"
              >
                Вернуться к списку задач
              </Link>
              <button
                onClick={() => {
                  setError(null)
                  setLoading(true)
                  fetchTask()
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
              >
                Попробовать снова
              </button>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  const daysUntilDue = getDaysUntilDue(task.dueDate)
  const isOverdue = daysUntilDue !== null && daysUntilDue < 0
  const dueText = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null
  const isDone = task.status === 'COMPLETED'

  return (
    <Layout>
      <div className="mx-auto w-full max-w-[980px]">
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
          {/* Шапка окна */}
          <div className="flex items-start justify-between gap-4 border-b border-neutral-100 px-6 py-5">
            <div className="min-w-0">
              <div className="text-[12px] text-neutral-400 tabular-nums">
                {task.project ? `${task.project.name} · ` : ''}Задача #{task.id.slice(-4)}
              </div>
              <h1 className="mt-1 truncate text-[19px] font-bold text-neutral-900">{task.title}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={handleEditTask}
                className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                title="Редактировать"
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                onClick={() => router.push('/tasks')}
                className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                title="Закрыть"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Тело: две колонки */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_300px]">
            {/* Левая колонка — содержание */}
            <div className="min-w-0 space-y-6 border-r border-neutral-100 p-6">
              {/* Описание */}
              <section>
                <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-neutral-400">Описание</div>
                {task.description ? (
                  <p className="whitespace-pre-wrap break-words text-[13.5px] leading-[1.55] text-neutral-700">{task.description}</p>
                ) : (
                  <p className="text-[13.5px] text-neutral-400">Нет описания</p>
                )}
              </section>

              {/* Фото и вложения */}
              <section>
                <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-neutral-400">Фото и вложения</div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleEditTask}
                    className="flex h-[78px] w-[104px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-neutral-300 text-neutral-400 transition-colors hover:border-blue-600 hover:text-blue-600"
                  >
                    <Plus className="h-5 w-5" />
                    <span className="text-[11px]">Добавить</span>
                  </button>
                </div>
              </section>

              {/* Чек-лист */}
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-neutral-400">
                    Чек-лист{subtasks.length > 0 ? ` · ${completedSubtasks} из ${subtasks.length}` : ''}
                  </div>
                  {!showSubtaskInput && (
                    <button
                      onClick={() => setShowSubtaskInput(true)}
                      className="flex items-center gap-1 text-[12.5px] text-blue-600 hover:underline"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Добавить
                    </button>
                  )}
                </div>

                {subtasks.length > 0 && (
                  <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                    <div className="h-full rounded-full bg-green-600 transition-all" style={{ width: `${progressPercent}%` }} />
                  </div>
                )}

                <div className="space-y-1">
                  {subtasks.map((subtask) => (
                    <div key={subtask.id} className="group flex items-center gap-2.5 rounded-md px-1 py-1.5 hover:bg-neutral-50">
                      <button
                        onClick={() => handleToggleSubtask(subtask.id, subtask.isCompleted)}
                        className={`flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded border transition-colors ${
                          subtask.isCompleted ? 'border-green-600 bg-green-600 text-white' : 'border-neutral-300 text-transparent hover:border-neutral-400'
                        }`}
                      >
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </button>
                      <span className={`flex-1 text-[13px] ${subtask.isCompleted ? 'text-neutral-400 line-through' : 'text-neutral-700'}`}>
                        {subtask.title}
                      </span>
                      <button
                        onClick={() => handleDeleteSubtask(subtask.id)}
                        className="text-neutral-300 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {subtasks.length === 0 && !showSubtaskInput && (
                    <p className="text-[13px] text-neutral-400">Пунктов пока нет</p>
                  )}
                </div>

                {showSubtaskInput && (
                  <form onSubmit={handleAddSubtask} className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      placeholder="Название пункта…"
                      autoFocus
                      className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring"
                      onBlur={() => { if (!newSubtaskTitle.trim()) setShowSubtaskInput(false) }}
                    />
                    <button type="submit" className="rounded-md bg-blue-600 px-3 py-1.5 text-[13px] font-medium text-white hover:opacity-90">
                      Добавить
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowSubtaskInput(false); setNewSubtaskTitle('') }}
                      className="rounded-md bg-neutral-100 px-3 py-1.5 text-[13px] text-neutral-600 hover:bg-neutral-200"
                    >
                      Отмена
                    </button>
                  </form>
                )}
              </section>

              {/* Комментарии */}
              <section>
                <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-neutral-400">
                  Комментарии{comments.length > 0 ? ` · ${comments.length}` : ''}
                </div>

                <div className="space-y-4">
                  {comments.length === 0 ? (
                    <p className="text-[13px] text-neutral-400">Пока нет комментариев</p>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} className="flex gap-3">
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                          style={{ backgroundColor: avColor(comment.user.id) }}
                        >
                          {initials(comment.user.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-0.5 flex items-center gap-1.5 text-[12.5px]">
                            <span className="font-semibold text-neutral-900">{comment.user.name}</span>
                            <span className="text-neutral-400">
                              · {new Date(comment.createdAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[13px] text-neutral-700">
                            {formatCommentWithMentions(comment.content)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Поле ввода */}
                <form onSubmit={handleAddComment} className="relative mt-4 flex gap-3">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                    style={{ backgroundColor: avColor(session?.user?.id || 'me') }}
                  >
                    {initials(session?.user?.name || undefined)}
                  </div>
                  <div className="relative flex-1">
                    {showMentionSuggestions && getMentionSuggestions().length > 0 && (
                      <div className="absolute bottom-full left-0 z-50 mb-2 w-72 rounded-lg border border-neutral-200 bg-white shadow-lg">
                        <div className="border-b border-neutral-100 p-2">
                          <p className="text-[11px] font-medium text-neutral-500">Упомянуть сотрудника</p>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {getMentionSuggestions().map((user) => (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() => insertMention(user.name)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-neutral-50"
                            >
                              <div
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                                style={{ backgroundColor: avColor(user.id) }}
                              >
                                {initials(user.name)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-medium text-neutral-900">{user.name}</p>
                                <p className="truncate text-[11px] text-neutral-500">{user.email}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <textarea
                      ref={commentInputRef}
                      value={newComment}
                      onChange={handleCommentChange}
                      onKeyDown={(e) => { if (e.key === 'Escape') setShowMentionSuggestions(false) }}
                      placeholder="Написать комментарий…"
                      rows={2}
                      className="w-full resize-none rounded-lg border border-neutral-300 px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <div className="mt-2 flex justify-end">
                      <button
                        type="submit"
                        disabled={!newComment.trim()}
                        className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-1.5 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-40"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Отправить
                      </button>
                    </div>
                  </div>
                </form>
              </section>
            </div>

            {/* Правая колонка — свойства */}
            <div className="flex flex-col gap-[18px] bg-neutral-50 p-5">
              {/* Статус */}
              <div>
                <div className="mb-1.5 text-[11.5px] font-semibold text-neutral-400">Статус</div>
                {editingStatus ? (
                  <select
                    value={task.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    onBlur={() => setEditingStatus(false)}
                    autoFocus
                    className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="TODO">К выполнению</option>
                    <option value="IN_PROGRESS">В работе</option>
                    <option value="COMPLETED">Завершена</option>
                    <option value="CANCELLED">Отменена</option>
                  </select>
                ) : (
                  <button
                    onClick={() => setEditingStatus(true)}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[13px] font-medium ${statusBadge(task.status)}`}
                  >
                    {getStatusText(task.status)}
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </button>
                )}
              </div>

              {/* Исполнители */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[11.5px] font-semibold text-neutral-400">Исполнители</div>
                  {!editingAssignees && (
                    <button onClick={() => setEditingAssignees(true)} className="text-[11.5px] text-blue-600 hover:underline">
                      Изменить
                    </button>
                  )}
                </div>

                {editingAssignees ? (
                  <div className="space-y-2">
                    <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-neutral-200 bg-white p-1.5">
                      {users.map((user) => {
                        const isAssigned = task.assignments.some(a => a.user.id === user.id)
                        return (
                          <label key={user.id} className="flex cursor-pointer items-center gap-2 rounded p-1.5 hover:bg-neutral-50">
                            <input
                              type="checkbox"
                              checked={isAssigned}
                              onChange={(e) => handleAssigneeToggle(user.id, e.target.checked)}
                              className="rounded border-neutral-300"
                            />
                            <div className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white" style={{ backgroundColor: avColor(user.id) }}>
                              {initials(user.name)}
                            </div>
                            <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-900">{user.name}</span>
                          </label>
                        )
                      })}
                    </div>
                    <button onClick={() => setEditingAssignees(false)} className="w-full rounded-md bg-neutral-200 px-3 py-1.5 text-[12.5px] text-neutral-700 hover:bg-neutral-300">
                      Готово
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {task.assignments.length > 0 ? (
                      task.assignments.map((assignment, idx) => (
                        <div key={idx} className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white" style={{ backgroundColor: avColor(assignment.user.id) }}>
                            {initials(assignment.user.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-neutral-900">{assignment.user.name}</p>
                            <p className="text-[11px] text-neutral-400">
                              {assignment.user.id === task.creator.id ? 'Ответственный' : 'Участник'}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-[12.5px] text-neutral-400">Не назначены</p>
                    )}
                    <button
                      onClick={() => setEditingAssignees(true)}
                      className="flex items-center gap-2 text-[12.5px] text-blue-600"
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-blue-600">
                        <Plus className="h-3.5 w-3.5" />
                      </span>
                      Добавить
                    </button>
                  </div>
                )}
              </div>

              {/* Приоритет */}
              <div>
                <div className="mb-1.5 text-[11.5px] font-semibold text-neutral-400">Приоритет</div>
                {editingPriority ? (
                  <select
                    value={task.priority}
                    onChange={(e) => handlePriorityChange(e.target.value)}
                    onBlur={() => setEditingPriority(false)}
                    autoFocus
                    className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="LOW">Низкий</option>
                    <option value="MEDIUM">Средний</option>
                    <option value="HIGH">Высокий</option>
                  </select>
                ) : (
                  <button onClick={() => setEditingPriority(true)} className="inline-flex items-center gap-2 text-[13px] text-neutral-700">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: priorityDot(task.priority) }} />
                    {getPriorityText(task.priority)}
                  </button>
                )}
              </div>

              {/* Срок */}
              <div>
                <div className="mb-1.5 text-[11.5px] font-semibold text-neutral-400">Срок</div>
                {editingDueDate ? (
                  <input
                    type="date"
                    value={task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''}
                    onChange={(e) => handleDueDateChange(e.target.value)}
                    onBlur={() => setEditingDueDate(false)}
                    autoFocus
                    className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                ) : (
                  <button
                    onClick={() => setEditingDueDate(true)}
                    className={`text-[13px] tabular-nums ${isOverdue && !isDone ? 'font-semibold text-red-600' : 'text-neutral-700'}`}
                  >
                    {dueText ? (
                      <>
                        {dueText}
                        {!isDone && daysUntilDue !== null && (
                          <span className="ml-1">
                            {isOverdue ? `· просрочено ${Math.abs(daysUntilDue)} дн.` : daysUntilDue === 0 ? '· сегодня' : daysUntilDue === 1 ? '· завтра' : ''}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-neutral-400">Не задан</span>
                    )}
                  </button>
                )}
              </div>

              {/* Проект */}
              {task.project && (
                <div>
                  <div className="mb-1.5 text-[11.5px] font-semibold text-neutral-400">Проект</div>
                  <Link href={`/projects/${task.project.id}`} className="text-[13px] font-medium text-neutral-700 hover:underline">
                    {task.project.name}
                  </Link>
                </div>
              )}

              {/* Завершить задачу */}
              <button
                onClick={() => handleStatusChange(isDone ? 'IN_PROGRESS' : 'COMPLETED')}
                className={`mt-auto flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[13.5px] font-semibold transition-colors ${
                  isDone
                    ? 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100'
                    : 'bg-green-700 text-white hover:bg-green-800'
                }`}
              >
                <Check className="h-4 w-4" strokeWidth={2.5} />
                {isDone ? 'Возобновить задачу' : 'Завершить задачу'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={(o) => !o && setShowEditModal(false)}>
        <DialogContent className="max-h-[90vh] w-full max-w-2xl overflow-y-auto">
          <DialogHeader className="mb-2">
            <DialogTitle>Редактировать задачу</DialogTitle>
          </DialogHeader>

            <form onSubmit={handleSaveTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Название задачи
                </label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Описание
                </label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Статус
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    <option value="TODO">К выполнению</option>
                    <option value="IN_PROGRESS">В работе</option>
                    <option value="COMPLETED">Завершена</option>
                    <option value="CANCELLED">Отменена</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Приоритет
                  </label>
                  <select
                    value={editForm.priority}
                    onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    <option value="LOW">Низкий</option>
                    <option value="MEDIUM">Средний</option>
                    <option value="HIGH">Высокий</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Срок выполнения
                </label>
                <input
                  type="date"
                  value={editForm.dueDate}
                  onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Исполнители
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3">
                  {users.map((user) => (
                    <label
                      key={user.id}
                      className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={editForm.assigneeIds.includes(user.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditForm({
                              ...editForm,
                              assigneeIds: [...editForm.assigneeIds, user.id]
                            })
                          } else {
                            setEditForm({
                              ...editForm,
                              assigneeIds: editForm.assigneeIds.filter(id => id !== user.id)
                            })
                          }
                        }}
                        className="rounded border-gray-300 text-gray-700 focus:ring-gray-900"
                      />
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold">
                        {user.name[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {user.name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Сохранить
                </button>
              </div>
            </form>
        </DialogContent>
      </Dialog>
    </Layout>
  )
}

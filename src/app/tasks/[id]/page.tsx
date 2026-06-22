'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Layout from '@/components/layout'
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
              ? 'bg-blue-200 text-blue-900 font-semibold'
              : 'bg-blue-100 text-blue-700 font-medium'
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

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-sm text-gray-600">Загрузка...</p>
          </div>
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
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
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

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Link 
            href={task.project ? `/projects/${task.project.id}` : '/tasks'}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            {task.project ? `Вернуться к проекту "${task.project.name}"` : 'Назад к задачам'}
          </Link>
          
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{task.title}</h1>
              {task.description && (
                <p className="text-gray-600 text-lg mb-4">{task.description}</p>
              )}
              
              {/* Быстрые действия: Статус, Приоритет, Дедлайн */}
              <div className="flex flex-wrap items-center gap-3 mt-4">
                {/* Статус */}
                {editingStatus ? (
                  <div className="relative">
                    <select
                      value={task.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      onBlur={() => setEditingStatus(false)}
                      autoFocus
                      className="px-3 py-1.5 text-sm font-medium rounded-lg border-2 border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="TODO">К выполнению</option>
                      <option value="IN_PROGRESS">В работе</option>
                      <option value="COMPLETED">Завершена</option>
                      <option value="CANCELLED">Отменена</option>
                    </select>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingStatus(true)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border transition-all hover:shadow-sm ${getStatusColor(task.status)}`}
                  >
                    {getStatusIcon(task.status)}
                    {getStatusText(task.status)}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </button>
                )}

                {/* Приоритет */}
                {editingPriority ? (
                  <div className="relative">
                    <select
                      value={task.priority}
                      onChange={(e) => handlePriorityChange(e.target.value)}
                      onBlur={() => setEditingPriority(false)}
                      autoFocus
                      className="px-3 py-1.5 text-sm font-medium rounded-lg border-2 border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="LOW">Низкий</option>
                      <option value="MEDIUM">Средний</option>
                      <option value="HIGH">Высокий</option>
                    </select>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingPriority(true)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border transition-all hover:shadow-sm ${getPriorityColor(task.priority)}`}
                  >
                    {task.priority === 'HIGH' && <AlertTriangle className="h-4 w-4" />}
                    {getPriorityText(task.priority)} приоритет
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </button>
                )}

                {/* Дедлайн */}
                {editingDueDate ? (
                  <div className="relative">
                    <input
                      type="date"
                      value={task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''}
                      onChange={(e) => handleDueDateChange(e.target.value)}
                      onBlur={() => setEditingDueDate(false)}
                      autoFocus
                      className="px-3 py-1.5 text-sm font-medium rounded-lg border-2 border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingDueDate(true)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border transition-all hover:shadow-sm ${
                      isOverdue 
                        ? 'bg-red-50 text-red-700 border-red-200' 
                        : daysUntilDue !== null && daysUntilDue <= 3
                        ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                        : 'bg-gray-50 text-gray-700 border-gray-200'
                    }`}
                  >
                    <Calendar className="h-4 w-4" />
                    {task.dueDate ? (
                      <>
                        {new Date(task.dueDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                        {daysUntilDue !== null && (
                          <span className="text-xs">
                            {isOverdue ? ` (просрочено на ${Math.abs(daysUntilDue)} дн.)` : daysUntilDue === 0 ? ' (сегодня)' : daysUntilDue === 1 ? ' (завтра)' : ` (через ${daysUntilDue} дн.)`}
                          </span>
                        )}
                      </>
                    ) : (
                      'Установить срок'
                    )}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </button>
                )}
              </div>
            </div>
            <button
              onClick={handleEditTask}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shrink-0"
            >
              <Edit className="h-4 w-4" />
              Редактировать
            </button>
          </div>
        </div>

        {/* Основной контент: 2 колонки */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Левая колонка: Основная информация */}
          <div className="lg:col-span-2 space-y-6">
            {/* Подзадачи */}
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-5 w-5 text-gray-600" />
                  <h2 className="text-lg font-semibold text-gray-900">Подзадачи</h2>
                  {subtasks.length > 0 && (
                    <span className="text-sm text-gray-500">
                      ({completedSubtasks}/{subtasks.length})
                    </span>
                  )}
                </div>
                {!showSubtaskInput && (
                  <button
                    onClick={() => setShowSubtaskInput(true)}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    Добавить
                  </button>
                )}
              </div>

              {/* Прогресс-бар */}
              {subtasks.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                    <span>Прогресс</span>
                    <span className="font-medium">{Math.round(progressPercent)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Список подзадач */}
              <div className="space-y-2">
                {subtasks.map((subtask) => (
                  <div
                    key={subtask.id}
                    className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg group"
                  >
                    <button
                      onClick={() => handleToggleSubtask(subtask.id, subtask.isCompleted)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {subtask.isCompleted ? (
                        <CheckSquare className="h-5 w-5 text-green-600" />
                      ) : (
                        <Square className="h-5 w-5" />
                      )}
                    </button>
                    <span
                      className={`flex-1 text-sm ${
                        subtask.isCompleted
                          ? 'line-through text-gray-500'
                          : 'text-gray-900'
                      }`}
                    >
                      {subtask.title}
                    </span>
                    <button
                      onClick={() => handleDeleteSubtask(subtask.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition-opacity"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Форма добавления подзадачи */}
              {showSubtaskInput && (
                <form onSubmit={handleAddSubtask} className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    placeholder="Название подзадачи..."
                    autoFocus
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onBlur={() => {
                      if (!newSubtaskTitle.trim()) {
                        setShowSubtaskInput(false)
                      }
                    }}
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                  >
                    Добавить
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSubtaskInput(false)
                      setNewSubtaskTitle('')
                    }}
                    className="px-3 py-2 text-gray-600 bg-gray-100 rounded-lg text-sm hover:bg-gray-200"
                  >
                    Отмена
                  </button>
                </form>
              )}
            </div>

            {/* Комментарии */}
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="h-5 w-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Комментарии ({comments.length})
                </h2>
              </div>

              {/* Список комментариев */}
              <div className="space-y-4 mb-6">
                {comments.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">Пока нет комментариев</p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                        {comment.user.name[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-gray-900">
                              {comment.user.name}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(comment.createdAt).toLocaleString('ru-RU', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          <div className="text-sm text-gray-700">
                            {formatCommentWithMentions(comment.content)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Форма добавления комментария */}
              <form onSubmit={handleAddComment} className="relative">
                <div className="relative">
                  {/* Подсказки упоминаний */}
                  {showMentionSuggestions && getMentionSuggestions().length > 0 && (
                    <div className="absolute bottom-full left-0 mb-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                      <div className="p-2 border-b border-gray-100">
                        <p className="text-xs text-gray-500 font-medium">Упомянуть сотрудника</p>
                        <p className="text-xs text-gray-400 mt-0.5">Введите имя или email для поиска</p>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {getMentionSuggestions().map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => insertMention(user.name)}
                            className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center gap-2 transition-colors"
                          >
                            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-xs text-white font-medium">
                                {user.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {user.name}
                              </p>
                              <p className="text-xs text-gray-500 truncate">{user.email}</p>
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
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setShowMentionSuggestions(false)
                      }
                    }}
                    placeholder="Добавить комментарий... (@ — упомянуть сотрудника)"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
                <div className="flex justify-end mt-2">
                  <button
                    type="submit"
                    disabled={!newComment.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Send className="h-4 w-4" />
                    Отправить
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Правая колонка: Метаданные */}
          <div className="space-y-6">
            {/* Детали задачи */}
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Детали</h2>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                    <User className="h-4 w-4" />
                    <span>Создатель</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">{task.creator.name}</p>
                </div>

                {task.project && (
                  <div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                      <FolderOpen className="h-4 w-4" />
                      <span>Проект</span>
                    </div>
                    <Link
                      href={`/projects/${task.project.id}`}
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      {task.project.name}
                    </Link>
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                    <Clock className="h-4 w-4" />
                    <span>Создана</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(task.createdAt).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Исполнители */}
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Исполнители</h2>
                {!editingAssignees && (
                  <button
                    onClick={() => setEditingAssignees(true)}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Изменить
                  </button>
                )}
              </div>

              {editingAssignees ? (
                <div className="space-y-3">
                  <div className="max-h-48 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-2">
                    {users.map((user) => {
                      const isAssigned = task.assignments.some(a => a.user.id === user.id)
                      return (
                        <label
                          key={user.id}
                          className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={isAssigned}
                            onChange={(e) => handleAssigneeToggle(user.id, e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                            {user.name[0]?.toUpperCase() || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {user.name}
                            </p>
                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                  <button
                    onClick={() => setEditingAssignees(false)}
                    className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Готово
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {task.assignments.length > 0 ? (
                    task.assignments.map((assignment, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg"
                      >
                        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-semibold">
                          {assignment.user.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {assignment.user.name}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">Исполнители не назначены</p>
                  )}
                </div>
              )}
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold">
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
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

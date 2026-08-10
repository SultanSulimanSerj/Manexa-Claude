'use client'



import { confirm } from '@/components/ui/confirm'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/components/ui/use-toast'
import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Layout from '@/components/layout'
import PageHeader from '@/components/page-header'
import { SkeletonList } from '@/components/ui/skeleton'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

const EXPENSE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']
import { ArrowLeft, Edit, Users, FileText, Flag, DollarSign, Calendar, X, MessageSquare, Send, TrendingUp, TrendingDown, Percent, Plus, UserMinus, UserPlus, MapPin, FileSignature, Clock, CheckCircle2, Copy, ChevronRight } from 'lucide-react'
import { copyText } from '@/lib/clipboard'
import Link from 'next/link'
import { PermissionButton, usePermissions } from '@/components/permission-guard'
import { useSocket } from '@/contexts/SocketContext'
import { useSession } from 'next-auth/react'
import { extractMentionNames } from '@/lib/mention-utils'

interface ProjectDetail {
  id: string
  name: string
  description: string | null
  status: string
  priority: string
  budget: number | null
  startDate: string | null
  endDate: string | null
  creator: { name: string }
  users: Array<{ user: { id: string; name: string; email: string } }>
  _count: { tasks: number; documents: number; users: number }
  // Реквизиты клиента
  clientName?: string
  clientLegalName?: string
  clientInn?: string
  clientKpp?: string
  clientOgrn?: string
  clientLegalAddress?: string
  clientActualAddress?: string
  clientDirectorName?: string
  clientContactPhone?: string
  clientContactEmail?: string
  clientBankAccount?: string
  clientBankName?: string
  clientBankBik?: string
  clientCorrespondentAccount?: string
  // Дополнительные поля проекта
  objectAddress?: string
  contractNumber?: string
  contractDate?: string
}

interface Message {
  id: string
  content: string
  createdAt: string
  user: { id: string; name: string; email: string }
}

interface FinanceStats {
  invoiced: number
  received: number
  totalExpenses: number
  profit: number
  margin: number
  expenseByCategory: { category: string; amount: number }[]
}

interface User {
  id: string
  name: string
  email: string
  position: string | null
  phone: string | null
}

const PROJECT_TABS = [
  { key: 'overview', label: 'Обзор' },
  { key: 'client', label: 'Реквизиты' },
  { key: 'team', label: 'Команда' },
  { key: 'chat', label: 'Чат' },
] as const
type ProjectTab = (typeof PROJECT_TABS)[number]['key']

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<ProjectTab>('overview')
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [financeStats, setFinanceStats] = useState<FinanceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false)
  const [mentionSearch, setMentionSearch] = useState('')
  const [cursorPosition, setCursorPosition] = useState(0)
  const messageInputRef = React.useRef<HTMLInputElement>(null)
  const { socket, isConnected } = useSocket()
  const { data: session } = useSession()
  const { userRole, hasPermission } = usePermissions()
  const isExternal = userRole === 'CONTRACTOR' || userRole === 'CLIENT'
  // Реквизиты заказчика — не для внешних ролей
  const visibleTabs = PROJECT_TABS.filter((t) => (t.key === 'client' ? !isExternal : true))

  // Если активная вкладка стала недоступной — вернуться на «Обзор»
  useEffect(() => {
    if (!visibleTabs.some((t) => t.key === activeTab)) {
      setActiveTab('overview')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExternal, activeTab])
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'PLANNING',
    priority: 'MEDIUM',
    budget: '',
    startDate: '',
    endDate: '',
    objectAddress: '',
    contractNumber: '',
    contractDate: ''
  })
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [availableUsers, setAvailableUsers] = useState<User[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [membersLoading, setMembersLoading] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteData, setInviteData] = useState({ name: '', email: '', role: 'CONTRACTOR' })
  const [inviteResult, setInviteResult] = useState<{ email: string; tempPassword: string } | null>(null)
  const [inviteCopied, setInviteCopied] = useState(false)
  const [showContactModal, setShowContactModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState<User | null>(null)
  const [estimatesTotal, setEstimatesTotal] = useState<number>(0)
  const [estimatesCount, setEstimatesCount] = useState<number>(0)
  const [stages, setStages] = useState<any[]>([])
  const [overview, setOverview] = useState<{ counts: { tasksOverdue: number; approvalsPending: number; materialsMovements: number }; activity: any[] } | null>(null)
  const [workStagesStats, setWorkStagesStats] = useState<{
    total: number
    completed: number
    inProgress: number
    delayed: number
    progress: number
  } | null>(null)
  const [showClientModal, setShowClientModal] = useState(false)
  const [isClientSectionExpanded, setIsClientSectionExpanded] = useState(false)
  const [clientFormData, setClientFormData] = useState({
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

  // Функции для загрузки данных
  const fetchProject = async () => {
    try {
      const response = await fetch(`/api/projects/${params?.id}`, {
      })
      if (response.ok) {
        const data = await response.json()
        setProject(data)
      } else {
        router.push('/projects')
      }
    } catch (err) {
      console.error(err)
      router.push('/projects')
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${params?.id}/messages`, {
      })
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages || [])
      }
    } catch (err) {
      console.error(err)
    }
  }, [params?.id])

  // Загрузка данных при монтировании
  useEffect(() => {
    if (params?.id) {
      fetchProject()
      fetchMessages()
      fetchFinanceStats()
      fetchEstimatesTotal()
      fetchWorkStagesStats()
      fetchOverview()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.id])

  const appendChatMessage = (message: Message) => {
    setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]))
  }

  // WebSocket для реального времени чата
  useEffect(() => {
    if (!socket || !isConnected || !params?.id) return

    const projectId = params.id as string

    // Присоединяемся к комнате проекта после установки соединения
    socket.emit('join-project', projectId)

    // Слушаем новые сообщения
    const handleNewMessage = (message: Message & { projectId?: string }) => {
      if (message.projectId && message.projectId !== projectId) return
      appendChatMessage(message)
    }

    socket.on('new-message', handleNewMessage)

    // Слушаем индикатор печати
    socket.on('user-typing', (data: { userName: string; isTyping: boolean }) => {
      if (data.isTyping) {
        setTypingUsers((prev) => {
          if (!prev.includes(data.userName)) {
            return [...prev, data.userName]
          }
          return prev
        })
      } else {
        setTypingUsers((prev) => prev.filter(name => name !== data.userName))
      }
      
      // Автоматически убираем индикатор через 3 секунды
      setTimeout(() => {
        setTypingUsers((prev) => prev.filter(name => name !== data.userName))
      }, 3000)
    })

    // Cleanup при размонтировании
    return () => {
      socket.emit('leave-project', projectId)
      socket.off('new-message', handleNewMessage)
      socket.off('user-typing')
    }
  }, [socket, isConnected, params?.id])

  const fetchFinanceStats = async () => {
    try {
      const response = await fetch(`/api/finance?projectId=${params?.id}`, {
      })
      if (response.ok) {
        const data = await response.json()
        const finances = data.finances || []

        const invoicedTotal = finances.filter((f: any) => f.type === 'INCOME').reduce((sum: number, f: any) => sum + Number(f.amount), 0)
        const received = finances.filter((f: any) => f.type === 'INCOME' && f.isPaid).reduce((sum: number, f: any) => sum + Number(f.amount), 0)
        const totalExpenses = finances.filter((f: any) => f.type === 'EXPENSE').reduce((sum: number, f: any) => sum + Number(f.amount), 0)
        // Прибыль и маржа считаем по фактически полученным деньгам
        const profit = received - totalExpenses
        const margin = received > 0 ? ((profit / received) * 100) : 0

        // Структура расходов по категориям (для диаграммы)
        const catMap = new Map<string, number>()
        finances
          .filter((f: any) => f.type === 'EXPENSE')
          .forEach((f: any) => {
            const key = f.category || 'Без категории'
            catMap.set(key, (catMap.get(key) || 0) + Number(f.amount))
          })
        const expenseByCategory = Array.from(catMap.entries())
          .map(([category, amount]) => ({ category, amount }))
          .sort((a, b) => b.amount - a.amount)

        setFinanceStats({
          invoiced: invoicedTotal,
          received,
          totalExpenses,
          profit,
          margin,
          expenseByCategory,
        })
      }
    } catch (err) {
      console.error(err)
    }
  }

  const fetchEstimatesTotal = async () => {
    try {
      const response = await fetch(`/api/projects/${params?.id}/estimates`)
      if (response.ok) {
        const estimates = await response.json()
        const total = estimates.reduce((sum: number, estimate: any) => {
          return sum + Number(estimate.totalWithVat || estimate.total || 0)
        }, 0)
        setEstimatesTotal(total)
        setEstimatesCount(Array.isArray(estimates) ? estimates.length : 0)
      }
    } catch (error) {
      console.error('Error fetching estimates total:', error)
    }
  }

  const fetchOverview = async () => {
    try {
      const response = await fetch(`/api/projects/${params?.id}/overview`)
      if (response.ok) setOverview(await response.json())
    } catch (err) {
      console.error(err)
    }
  }

  const fetchWorkStagesStats = async () => {
    try {
      const response = await fetch(`/api/projects/${params?.id}/stages`)
      if (response.ok) {
        const stages = await response.json()
        setStages(Array.isArray(stages) ? stages : [])
        const total = stages.length
        const completed = stages.filter((s: any) => s.status === 'COMPLETED').length
        const inProgress = stages.filter((s: any) => s.status === 'IN_PROGRESS').length
        const delayed = stages.filter((s: any) => s.status === 'DELAYED').length
        const progress = total > 0
          ? Math.round(stages.reduce((sum: number, s: any) => sum + s.progress, 0) / total)
          : 0

        setWorkStagesStats({ total, completed, inProgress, delayed, progress })
      }
    } catch (error) {
      console.error('Error fetching work stages:', error)
    }
  }

  const fetchAvailableUsers = async () => {
    try {
      const response = await fetch('/api/users')
      if (response.ok) {
        const data = await response.json()
        setAvailableUsers(data.users || [])
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleAddMember = async () => {
    if (!selectedUserId) return
    
    setMembersLoading(true)
    try {
      const response = await fetch(`/api/projects/${params?.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId })
      })
      
      if (response.ok) {
        await fetchProject() // Обновляем данные проекта
        setSelectedUserId('')
        setShowMembersModal(false)
        // Принудительно обновляем страницу через небольшую задержку
        setTimeout(() => {
          window.location.reload()
        }, 500)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Ошибка при добавлении участника')
      }
    } catch (err) {
      console.error(err)
      toast.error('Ошибка при добавлении участника')
    } finally {
      setMembersLoading(false)
    }
  }

  const handleInviteExternal = async () => {
    if (!inviteData.name.trim() || !inviteData.email.trim()) return
    setMembersLoading(true)
    try {
      const response = await fetch(`/api/projects/${params?.id}/members/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteData),
      })
      const data = await response.json()
      if (response.ok) {
        setInviteResult({ email: data.user.email, tempPassword: data.tempPassword })
        setInviteData({ name: '', email: '', role: 'CONTRACTOR' })
        await fetchProject()
      } else {
        toast.error(data.error || 'Не удалось пригласить')
      }
    } catch (err) {
      console.error(err)
      toast.error('Ошибка при приглашении')
    } finally {
      setMembersLoading(false)
    }
  }

  const copyInviteCredentials = async () => {
    if (!inviteResult) return
    const ok = await copyText(
      `Manexa — доступ\nАдрес: ${window.location.origin}/auth/signin\nEmail: ${inviteResult.email}\nВременный пароль: ${inviteResult.tempPassword}\n\nПри первом входе система попросит сменить пароль.`
    )
    if (ok) {
      setInviteCopied(true)
      setTimeout(() => setInviteCopied(false), 2000)
    } else {
      toast.error('Не удалось скопировать — выделите вручную')
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!await confirm('Удалить участника из проекта?')) return
    
    try {
      const response = await fetch(`/api/projects/${params?.id}/members?userId=${userId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        await fetchProject() // Обновляем данные проекта
      } else {
        const error = await response.json()
        toast.error(error.error || 'Ошибка при удалении участника')
      }
    } catch (err) {
      console.error(err)
      toast.error('Ошибка при удалении участника')
    }
  }

  const handleShowContact = (member: any) => {
    setSelectedMember(member.user)
    setShowContactModal(true)
  }

  const handleEditClient = () => {
    if (!project) return
    
    setClientFormData({
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
    setShowClientModal(true)
  }

  const handleSaveClient = async () => {
    try {
      const response = await fetch(`/api/projects/${params?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientFormData)
      })
      
      if (response.ok) {
        await fetchProject()
        setShowClientModal(false)
        toast.success('Данные клиента обновлены!')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Ошибка при сохранении')
      }
    } catch (err) {
      console.error(err)
      toast.error('Ошибка при сохранении данных клиента')
    }
  }

  const handleEdit = () => {
    if (!project) return
    
    setFormData({
      name: project.name,
      description: project.description || '',
      status: project.status,
      priority: project.priority,
      budget: project.budget?.toString() || '',
      startDate: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : '',
      endDate: project.endDate ? new Date(project.endDate).toISOString().split('T')[0] : '',
      objectAddress: project.objectAddress || '',
      contractNumber: project.contractNumber || '',
      contractDate: project.contractDate ? new Date(project.contractDate).toISOString().split('T')[0] : ''
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch(`/api/projects/${params?.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          budget: formData.budget ? parseFloat(formData.budget) : null,
          startDate: formData.startDate || null,
          endDate: formData.endDate || null,
          contractDate: formData.contractDate || null
        })
      })

      if (response.ok) {
        setShowModal(false)
        fetchProject()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    try {
      // Останавливаем индикатор печати
      if (socket && params?.id) {
        socket.emit('typing', {
          projectId: params.id,
          userName: session?.user?.name || 'Пользователь',
          isTyping: false
        })
      }

      const mentions = extractMentionNames(newMessage)

      const response = await fetch(`/api/projects/${params?.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newMessage,
          mentions: mentions // Передаём упоминания в API
        })
      })

      if (response.ok) {
        const message = await response.json()
        appendChatMessage(message)
        setNewMessage('')
        setShowMentionSuggestions(false)
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Обработчик печати для индикатора "печатает..."
  const handleTyping = () => {
    if (socket && params?.id && newMessage.trim()) {
      socket.emit('typing', {
        projectId: params.id,
        userName: session?.user?.name || 'Пользователь',
        isTyping: true
      })
    }
  }

  // Обработка ввода сообщения с упоминаниями
  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const cursorPos = e.target.selectionStart || 0
    
    setNewMessage(value)
    setCursorPosition(cursorPos)
    handleTyping()

    // Проверяем, есть ли @ перед курсором
    const textBeforeCursor = value.substring(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1)
      // Проверяем, что после @ нет пробелов
      if (!textAfterAt.includes(' ') && textAfterAt.length >= 0) {
        setMentionSearch(textAfterAt.toLowerCase())
        setShowMentionSuggestions(true)
      } else {
        setShowMentionSuggestions(false)
      }
    } else {
      setShowMentionSuggestions(false)
    }
  }

  // Вставка упоминания пользователя
  const insertMention = (userName: string) => {
    const textBeforeCursor = newMessage.substring(0, cursorPosition)
    const textAfterCursor = newMessage.substring(cursorPosition)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    
    if (lastAtIndex !== -1) {
      const newText = 
        textBeforeCursor.substring(0, lastAtIndex) + 
        `@${userName} ` + 
        textAfterCursor
      
      setNewMessage(newText)
      setShowMentionSuggestions(false)
      
      // Возвращаем фокус на input
      setTimeout(() => {
        messageInputRef.current?.focus()
      }, 0)
    }
  }

  // Подсказки для упоминаний сотрудников (поиск по имени/email, до 10 результатов)
  const getMentionSuggestions = () => {
    if (!project?.users) return []
    const search = mentionSearch.trim()
    return project.users
      .filter(member =>
        !search ||
        member.user.name.toLowerCase().includes(search) ||
        member.user.email.toLowerCase().includes(search)
      )
      .slice(0, 10)
  }

  // Форматирование сообщения с подсветкой упоминаний
  const formatMessageWithMentions = (content: string) => {
    // Регулярное выражение для поиска @упоминаний
    const mentionRegex = /@(\w+(?:\s+\w+)?)/g
    const parts = []
    let lastIndex = 0
    let match

    while ((match = mentionRegex.exec(content)) !== null) {
      // Добавляем текст перед упоминанием
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {content.substring(lastIndex, match.index)}
          </span>
        )
      }

      // Добавляем упоминание с подсветкой
      const currentUserName = session?.user?.name
      const isMentioningMe = match[1] === currentUserName

      parts.push(
        <span
          key={`mention-${match.index}`}
          className={`${
            isMentioningMe 
              ? 'bg-gray-900 text-white font-semibold' 
              : 'bg-gray-100 text-gray-700 font-medium'
          } px-1 rounded`}
        >
          @{match[1]}
        </span>
      )

      lastIndex = match.index + match[0].length
    }

    // Добавляем оставшийся текст
    if (lastIndex < content.length) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {content.substring(lastIndex)}
        </span>
      )
    }

    return parts.length > 0 ? parts : content
  }

  const getStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'PLANNING': 'Планирование',
      'ACTIVE': 'Активный',
      'COMPLETED': 'Завершен',
      'ON_HOLD': 'Приостановлен',
      'CANCELLED': 'Отменен'
    }
    return statusMap[status] || status
  }

  const getStatusColor = (status: string) => {
    const colorMap: { [key: string]: string } = {
      'PLANNING': 'bg-blue-100 text-blue-800 border-blue-200',
      'ACTIVE': 'bg-green-100 text-green-800 border-green-200',
      'COMPLETED': 'bg-gray-100 text-gray-800 border-gray-200',
      'ON_HOLD': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'CANCELLED': 'bg-red-100 text-red-800 border-red-200'
    }
    return colorMap[status] || 'bg-gray-100 text-gray-800'
  }

  const getPriorityText = (priority: string) => {
    const priorityMap: { [key: string]: string } = {
      'LOW': 'Низкий',
      'MEDIUM': 'Средний',
      'HIGH': 'Высокий',
      'URGENT': 'Срочный'
    }
    return priorityMap[priority] || priority
  }

  const getPriorityColor = (priority: string) => {
    const colorMap: { [key: string]: string } = {
      'LOW': 'bg-green-100 text-green-800',
      'MEDIUM': 'bg-blue-100 text-blue-800',
      'HIGH': 'bg-orange-100 text-orange-800',
      'URGENT': 'bg-red-100 text-red-800'
    }
    return colorMap[priority] || 'bg-gray-100 text-gray-800'
  }

  // ——— helpers 10a ———
  const priorityDot = (p: string) => (p === 'URGENT' || p === 'HIGH' ? '#dc2626' : p === 'MEDIUM' ? '#d97706' : '#16a34a')
  const statusBadge10a = (s: string) => {
    const m: Record<string, string> = {
      PLANNING: 'bg-blue-50 text-blue-700 border-blue-200',
      ACTIVE: 'bg-green-50 text-green-700 border-green-200',
      COMPLETED: 'bg-neutral-100 text-neutral-600 border-neutral-200',
      ON_HOLD: 'bg-amber-50 text-amber-700 border-amber-200',
      CANCELLED: 'bg-red-50 text-red-700 border-red-200',
    }
    return m[s] || 'bg-neutral-100 text-neutral-600 border-neutral-200'
  }
  const stageMeta = (s: string) => {
    const m: Record<string, { dot: string; bar: string; label: string }> = {
      COMPLETED: { dot: '#16803c', bar: 'bg-green-600', label: 'Завершён' },
      IN_PROGRESS: { dot: '#1c7fd6', bar: 'bg-blue-600', label: 'В работе' },
      PAUSED: { dot: '#d97706', bar: 'bg-amber-500', label: 'Пауза' },
      DELAYED: { dot: '#dc2626', bar: 'bg-red-600', label: 'Задержка' },
      NOT_STARTED: { dot: '#c4c4c9', bar: 'bg-neutral-300', label: 'Не начат' },
    }
    return m[s] || m.NOT_STARTED
  }
  // Компактная сумма с корректной единицей (₽ / млн ₽) — единица считается сама, не хардкодить снаружи
  const money = (n: number) => {
    const a = Math.abs(n)
    if (a >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.', ',') + ' млн ₽'
    return new Intl.NumberFormat('ru-RU').format(Math.round(n)) + ' ₽'
  }
  const avColorHex = (id: string) => ['#1c7fd6', '#0d9488', '#b45309', '#7c3aed', '#c2410c', '#0369a1'][Math.abs((id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 6]
  const initials = (name?: string) => { const p = (name || '?').trim().split(/\s+/); return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '?' }

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <PageHeader title="Проект" description="Загрузка..." back="/projects" />
          <SkeletonList rows={6} />
        </div>
      </Layout>
    )
  }

  if (!project) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-500">Проект не найден</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Шапка проекта (10a) */}
        <div>
          <div className="text-[12.5px] text-neutral-400">
            <Link href="/projects" className="hover:underline">Проекты</Link> · {project.name}
          </div>
          <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-[23px] font-bold text-neutral-900">{project.name}</h1>
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[12px] font-medium ${statusBadge10a(project.status)}`}>
                  {getStatusText(project.status)}
                </span>
                <span className="inline-flex items-center gap-1.5 text-[13px] text-neutral-600">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: priorityDot(project.priority) }} />
                  {getPriorityText(project.priority)} приоритет
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-neutral-600">
                {(project.clientLegalName || project.clientName) && (
                  <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-neutral-400" />{project.clientLegalName || project.clientName}</span>
                )}
                {project.objectAddress && (
                  <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-neutral-400" />{project.objectAddress}</span>
                )}
                {project.contractNumber && (
                  <span className="inline-flex items-center gap-1.5"><FileSignature className="h-3.5 w-3.5 text-neutral-400" />Договор № {project.contractNumber}{project.contractDate ? ` от ${new Date(project.contractDate).toLocaleDateString('ru-RU')}` : ''}</span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link href={`/projects/${project.id}/schedule`} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3.5 py-2 text-[13px] font-medium text-neutral-700 hover:bg-neutral-50">
                <Calendar className="h-4 w-4" /> График работ
              </Link>
              <button onClick={handleEdit} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-blue-700">
                <Edit className="h-4 w-4" /> Редактировать
              </button>
            </div>
          </div>
        </div>

        {/* Вкладки (10a): Обзор + ссылки в разделы + Команда/Реквизиты/Чат */}
        <div className="border-b border-neutral-200">
          <nav className="flex gap-1 -mb-px overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[13.5px] font-medium transition-colors ${activeTab === 'overview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-neutral-500 hover:text-neutral-900'}`}
            >
              Обзор
            </button>
            {([
              { label: 'Сметы', href: `/projects/${project.id}/estimates`, count: estimatesCount || null },
              ...(hasPermission('canViewFinances') ? [{ label: 'Финансы', href: `/finance?projectId=${project.id}`, count: null as number | null }] : []),
              { label: 'Задачи', href: `/tasks?projectId=${project.id}`, count: project._count.tasks || null },
              { label: 'Материалы', href: `/materials`, count: null as number | null },
              { label: 'Документы', href: `/documents?projectId=${project.id}`, count: project._count.documents || null },
              { label: 'Согласования', href: `/approvals?projectId=${project.id}`, count: overview?.counts.approvalsPending || null },
            ]).map((t) => (
              <Link
                key={t.label}
                href={t.href}
                className="inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-3.5 py-2.5 text-[13.5px] font-medium text-neutral-500 transition-colors hover:text-neutral-900"
              >
                {t.label}
                {t.count != null && <span className="text-neutral-400 tabular-nums">{t.count}</span>}
              </Link>
            ))}
            <button onClick={() => setActiveTab('team')} className={`whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[13.5px] font-medium transition-colors ${activeTab === 'team' ? 'border-blue-600 text-blue-600' : 'border-transparent text-neutral-500 hover:text-neutral-900'}`}>Бригада</button>
            {!isExternal && (
              <button onClick={() => setActiveTab('client')} className={`whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[13.5px] font-medium transition-colors ${activeTab === 'client' ? 'border-blue-600 text-blue-600' : 'border-transparent text-neutral-500 hover:text-neutral-900'}`}>Реквизиты</button>
            )}
            <button onClick={() => setActiveTab('chat')} className={`whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[13.5px] font-medium transition-colors ${activeTab === 'chat' ? 'border-blue-600 text-blue-600' : 'border-transparent text-neutral-500 hover:text-neutral-900'}`}>Чат</button>
          </nav>
        </div>

        {activeTab === 'overview' && (
        <>
        {/* KPI */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="text-[12.5px] text-neutral-500">Прогресс работ</div>
            <div className="mt-1 text-[26px] font-bold tabular-nums text-neutral-900">{workStagesStats?.progress ?? 0}%</div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full rounded-full bg-blue-600" style={{ width: `${workStagesStats?.progress ?? 0}%` }} />
            </div>
          </div>
          {hasPermission('canViewFinances') && (
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="text-[12.5px] text-neutral-500">Бюджет · факт / план</div>
            <div className="mt-1 text-[22px] font-bold tabular-nums text-neutral-900">
              {money(financeStats?.totalExpenses ?? 0)} <span className="text-[14px] font-medium text-neutral-400">/ {project.budget ? money(Number(project.budget)) : '—'}</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full rounded-full bg-green-600" style={{ width: `${project.budget ? Math.min(100, ((financeStats?.totalExpenses ?? 0) / Number(project.budget)) * 100) : 0}%` }} />
            </div>
          </div>
          )}
          {hasPermission('canViewFinances') && (
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="text-[12.5px] text-neutral-500">Прибыль · маржа</div>
            <div className={`mt-1 text-[22px] font-bold tabular-nums ${(financeStats?.profit ?? 0) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              {(financeStats?.profit ?? 0) >= 0 ? '+' : '−'}{money(Math.abs(financeStats?.profit ?? 0))} <span className="text-[14px]">{(financeStats?.margin ?? 0).toFixed(1)}%</span>
            </div>
            <div className="mt-1 text-[12px] text-neutral-400">по полученным платежам</div>
          </div>
          )}
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="text-[12.5px] text-neutral-500">Срок</div>
            {project.endDate ? (() => {
              const days = Math.ceil((new Date(project.endDate as string).getTime() - Date.now()) / 86400000)
              const overdue = days < 0
              return (<>
                <div className={`mt-1 text-[22px] font-bold tabular-nums ${overdue ? 'text-red-600' : 'text-neutral-900'}`}>{Math.abs(days)} <span className="text-[14px] font-medium text-neutral-400">{overdue ? 'дн. просрочка' : 'дн. осталось'}</span></div>
                <div className="mt-1 text-[12px] tabular-nums text-neutral-400">{project.startDate ? `${new Date(project.startDate).toLocaleDateString('ru-RU')} — ` : ''}{new Date(project.endDate as string).toLocaleDateString('ru-RU')}</div>
              </>)
            })() : <div className="mt-1 text-[15px] text-neutral-400">Срок не задан</div>}
          </div>
        </div>

        {/* Тело: 1fr 340px */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            {/* Этапы работ */}
            <div className="rounded-xl border border-neutral-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-neutral-900">Этапы работ{stages.length ? ` · ${stages.length}` : ''}</h2>
                <Link href={`/projects/${project.id}/schedule`} className="text-[13px] font-medium text-blue-600 hover:underline">Весь график →</Link>
              </div>
              {stages.length === 0 ? (
                <div className="py-6 text-center text-[13px] text-neutral-400">Этапы не заданы. <Link href={`/projects/${project.id}/schedule`} className="text-blue-600 hover:underline">Создать график →</Link></div>
              ) : (() => {
                const done = stages.filter((s:any)=>s.status==='COMPLETED').length
                const active = stages.filter((s:any)=>s.status==='IN_PROGRESS').length
                const ahead = stages.length - done - active
                const activeList = stages.filter((s:any)=>s.status==='IN_PROGRESS' || s.status==='PAUSED' || s.status==='DELAYED').slice(0,4)
                return (<>
                  <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
                    <span className="text-neutral-500">Готово {done} · в работе {active} · впереди {ahead}</span>
                    <span className="font-semibold tabular-nums text-neutral-900">{workStagesStats?.progress ?? 0}%</span>
                  </div>
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-neutral-200">
                    {stages.map((s:any)=>(<div key={s.id} className={stageMeta(s.status).bar} style={{ width: `${100/stages.length}%` }} />))}
                  </div>
                  {activeList.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-400">Сейчас в работе</div>
                    <div className="space-y-2.5">
                      {activeList.map((s:any)=>{ const m = stageMeta(s.status); return (
                        <div key={s.id} className="flex items-center gap-3">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: m.dot }} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13.5px] font-medium text-neutral-900">{s.name}</div>
                            <div className="text-[12px] text-neutral-400">{s.status==='PAUSED' ? 'приостановлен' : s.plannedEndDate ? `до ${new Date(s.plannedEndDate).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'})}` : ''}{s.status!=='PAUSED' ? ` · ${s.progress}%` : ''}</div>
                          </div>
                          {s.status==='PAUSED' ? (
                            <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">Пауза</span>
                          ) : (
                            <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-neutral-100 sm:block"><div className={m.bar+' h-full rounded-full'} style={{ width: `${s.progress}%` }} /></div>
                          )}
                        </div>
                      )})}
                    </div>
                  </div>
                  )}
                  {ahead > 0 && (
                    <Link href={`/projects/${project.id}/schedule`} className="mt-3 block border-t border-neutral-100 pt-3 text-center text-[13px] text-neutral-500 hover:text-neutral-800">Ещё {ahead} запланированных этапов →</Link>
                  )}
                </>)
              })()}
            </div>

            {/* Последняя активность (единый фид) */}
            {(() => {
              const acts = (overview?.activity || []).filter((a: any) => a.kind !== 'finance' || hasPermission('canViewFinances'))
              if (acts.length === 0) return null
              const iconFor = (a: any) => {
                if (a.kind === 'document') return { icon: <FileText className="h-3.5 w-3.5" />, cls: 'bg-neutral-100 text-neutral-500' }
                if (a.kind === 'approval') return { icon: <CheckCircle2 className="h-3.5 w-3.5" />, cls: a.positive ? 'bg-green-50 text-green-600' : 'bg-indigo-50 text-indigo-600' }
                if (a.kind === 'material') return { icon: <TrendingDown className="h-3.5 w-3.5" />, cls: 'bg-red-50 text-red-600' }
                return a.positive ? { icon: <TrendingUp className="h-3.5 w-3.5" />, cls: 'bg-green-50 text-green-600' } : { icon: <TrendingDown className="h-3.5 w-3.5" />, cls: 'bg-red-50 text-red-600' }
              }
              const hrefFor = (a: any) => a.kind === 'document' ? `/documents?projectId=${project.id}` : a.kind === 'approval' ? `/approvals?projectId=${project.id}` : a.kind === 'material' ? '/materials' : `/finance?projectId=${project.id}`
              return (
                <div className="rounded-xl border border-neutral-200 bg-white p-5">
                  <h2 className="mb-3 text-[15px] font-semibold text-neutral-900">Последняя активность</h2>
                  <div className="space-y-3">
                    {acts.map((a: any) => { const ic = iconFor(a); return (
                      <Link key={a.id} href={hrefFor(a)} className="flex items-start gap-3 rounded-lg -mx-1 px-1 py-0.5 hover:bg-neutral-50">
                        <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${ic.cls}`}>{ic.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] text-neutral-800">
                            {a.actor && <span className="font-semibold text-neutral-900">{a.actor} </span>}{a.text}
                            {a.amount != null && <span className={`font-semibold tabular-nums ${a.positive ? 'text-green-700' : 'text-neutral-900'}`}> {a.positive ? '+' : '−'}{Number(a.amount).toLocaleString('ru-RU')} ₽</span>}
                          </div>
                          <div className="text-[12px] tabular-nums text-neutral-400">{new Date(a.date).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      </Link>
                    )})}
                  </div>
                </div>
              )
            })()}

            {project.description && (
            <div className="rounded-xl border border-neutral-200 bg-white p-5">
              <h2 className="mb-2 text-[15px] font-semibold text-neutral-900">Описание</h2>
              <p className="whitespace-pre-wrap text-[13.5px] leading-[1.55] text-neutral-700">{project.description}</p>
            </div>
            )}
          </div>

          <div className="space-y-5">
            {/* Команда */}
            <div className="rounded-xl border border-neutral-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-neutral-900">Команда</h2>
                <span className="text-[12.5px] text-neutral-400">{project._count.users} чел.</span>
              </div>
              <div className="space-y-3">
                {project.users.slice(0,5).map((u:any)=>(
                  <div key={u.user.id} className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white" style={{ backgroundColor: avColorHex(u.user.id) }}>{initials(u.user.name)}</span>
                    <div className="min-w-0"><div className="truncate text-[13.5px] font-medium text-neutral-900">{u.user.name}</div><div className="truncate text-[12px] text-neutral-400">{u.user.email}</div></div>
                  </div>
                ))}
              </div>
              <button onClick={()=>setActiveTab('team')} className="mt-3 flex items-center gap-2 text-[12.5px] text-blue-600 hover:underline"><span className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-blue-600"><Plus className="h-3.5 w-3.5" /></span>Управление командой</button>
            </div>

            {/* Разделы */}
            <div className="rounded-xl border border-neutral-200 bg-white p-2">
              <div className="px-3 pb-1 pt-2 text-[15px] font-semibold text-neutral-900">Разделы</div>
              {([
                { label:'Сметы', href:`/projects/${project.id}/estimates`, val: (estimatesCount || 0) as number | null, badge: null as { text: string; cls: string } | null },
                { label:'Задачи', href:`/tasks?projectId=${project.id}`, val: project._count.tasks as number | null, badge: overview?.counts.tasksOverdue ? { text: `${overview.counts.tasksOverdue} просрочено`, cls: 'border-amber-200 bg-amber-50 text-amber-700' } : null },
                { label:'Документы', href:`/documents?projectId=${project.id}`, val: project._count.documents as number | null, badge: null as { text: string; cls: string } | null },
                { label:'Материалы', href:`/materials`, val: null as number | null, badge: null as { text: string; cls: string } | null },
                { label:'Согласования', href:`/approvals?projectId=${project.id}`, val: null as number | null, badge: overview?.counts.approvalsPending ? { text: `${overview.counts.approvalsPending} ждут`, cls: 'border-indigo-200 bg-indigo-50 text-indigo-700' } : null },
              ]).map((r)=>(
                <Link key={r.label} href={r.href} className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-neutral-50">
                  <span className="text-[13.5px] text-neutral-700">{r.label}</span>
                  <span className="flex items-center gap-2 text-neutral-400">
                    {r.badge && <span className={`rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${r.badge.cls}`}>{r.badge.text}</span>}
                    {r.val!=null && <span className="text-[13px] font-medium tabular-nums text-neutral-700">{r.val}</span>}
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </Link>
              ))}
            </div>

            {/* Реквизиты заказчика */}
            {!isExternal && (project.clientLegalName || project.clientInn || project.contractNumber || project.budget != null) && (
            <div className="rounded-xl border border-neutral-200 bg-white p-5">
              <h2 className="mb-3 text-[15px] font-semibold text-neutral-900">Реквизиты заказчика</h2>
              <div className="space-y-2 text-[13px]">
                {(project.clientLegalName||project.clientName) && (<div className="flex justify-between gap-3"><span className="text-neutral-400">Организация</span><span className="text-right font-medium text-neutral-900">{project.clientLegalName||project.clientName}</span></div>)}
                {project.clientInn && (<div className="flex justify-between gap-3"><span className="text-neutral-400">ИНН / КПП</span><span className="text-right font-medium tabular-nums text-neutral-900">{project.clientInn}{project.clientKpp?` / ${project.clientKpp}`:''}</span></div>)}
                {project.contractNumber && (<div className="flex justify-between gap-3"><span className="text-neutral-400">Договор</span><span className="text-right font-medium text-neutral-900">№ {project.contractNumber}</span></div>)}
                {project.budget != null && (<div className="flex justify-between gap-3"><span className="text-neutral-400">Сумма договора</span><span className="text-right font-medium tabular-nums text-neutral-900">{Number(project.budget).toLocaleString('ru-RU')} ₽</span></div>)}
              </div>
              <button onClick={()=>setActiveTab('client')} className="mt-3 text-[12.5px] text-blue-600 hover:underline">Все реквизиты →</button>
            </div>
            )}
          </div>
        </div>
        </>
        )}

        {activeTab === 'client' && (
        <>
        {/* Client Details */}
        <div className="bg-white rounded-lg border">
          <div 
            className="flex items-center justify-between p-6 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => setIsClientSectionExpanded(!isClientSectionExpanded)}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Данные клиента</h2>
              {project.clientName && (
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                  Заполнено
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {project.clientName && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleEditClient()
                  }}
                  className="text-sm text-gray-700 hover:text-gray-900 flex items-center gap-1 px-2 py-1 hover:bg-gray-50 rounded"
                >
                  <Edit className="h-4 w-4" />
                  Редактировать
                </button>
              )}
              <div className="transition-transform duration-200" style={{ transform: isClientSectionExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
          
          {isClientSectionExpanded && (
            <div className="px-6 pb-6 border-t">
              {project.clientName ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
              {project.clientName && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Название клиента</p>
                  <p className="text-sm font-medium text-gray-900">{project.clientName}</p>
                </div>
              )}
              {project.clientLegalName && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Юридическое наименование</p>
                  <p className="text-sm font-medium text-gray-900">{project.clientLegalName}</p>
                </div>
              )}
              {project.clientInn && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">ИНН</p>
                  <p className="text-sm font-medium text-gray-900">{project.clientInn}</p>
                </div>
              )}
              {project.clientKpp && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">КПП</p>
                  <p className="text-sm font-medium text-gray-900">{project.clientKpp}</p>
                </div>
              )}
              {project.clientOgrn && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">ОГРН</p>
                  <p className="text-sm font-medium text-gray-900">{project.clientOgrn}</p>
                </div>
              )}
              {project.clientDirectorName && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Директор</p>
                  <p className="text-sm font-medium text-gray-900">{project.clientDirectorName}</p>
                </div>
              )}
              {project.clientContactPhone && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Телефон</p>
                  <p className="text-sm font-medium text-gray-900">{project.clientContactPhone}</p>
                </div>
              )}
              {project.clientContactEmail && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Email</p>
                  <p className="text-sm font-medium text-gray-900">{project.clientContactEmail}</p>
                </div>
              )}
              {project.clientLegalAddress && (
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-500 mb-1">Юридический адрес</p>
                  <p className="text-sm font-medium text-gray-900">{project.clientLegalAddress}</p>
                </div>
              )}
              {project.clientActualAddress && (
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-500 mb-1">Фактический адрес</p>
                  <p className="text-sm font-medium text-gray-900">{project.clientActualAddress}</p>
                </div>
              )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500 mb-3">Данные клиента не заполнены</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEditClient()
                    }}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90"
                  >
                    Добавить данные клиента
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        </>
        )}


        {activeTab === 'team' && (
        <>
        {/* Team */}
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Команда ({project._count.users})</h2>
            <div className="flex items-center gap-2">
              <PermissionButton
                permission="canManageProjectMembers"
                onClick={() => {
                  setInviteResult(null)
                  setInviteData({ name: '', email: '', role: 'CONTRACTOR' })
                  setShowInviteModal(true)
                }}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                <UserPlus className="h-4 w-4" />
                Пригласить внешнего
              </PermissionButton>
              <PermissionButton
                permission="canManageProjectMembers"
                onClick={() => {
                  fetchAvailableUsers()
                  setShowMembersModal(true)
                }}
                className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
              >
                <Plus className="h-4 w-4" />
                Добавить участника
              </PermissionButton>
            </div>
          </div>
          
          {project._count.users > 0 ? (
            <div className="flex flex-wrap gap-2">
              {project.users.map((member) => {
                return (
                  <div key={member.user.id} className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
                    <div 
                      className="w-6 h-6 bg-primary rounded-full flex items-center justify-center cursor-pointer"
                      onClick={() => handleShowContact(member)}
                      title="Показать контакты"
                    >
                      <span className="text-xs text-primary-foreground font-medium">
                        {member.user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span 
                      className="text-sm text-gray-700 cursor-pointer hover:text-gray-900"
                      onClick={() => handleShowContact(member)}
                      title="Показать контакты"
                    >
                    {member.user.name}
                  </span>
                    <PermissionButton
                      permission="canManageProjectMembers"
                      onClick={() => handleRemoveMember(member.user.id)}
                      className="ml-2 p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                    >
                      <UserMinus className="h-3 w-3" />
                    </PermissionButton>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Участники не добавлены</p>
          )}
        </div>

        </>
        )}

        {activeTab === 'chat' && (
        <>
        {/* Chat */}
        <div className="bg-white rounded-lg border">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Обсуждение проекта
            </h2>
          </div>
          
          <div className="p-6 max-h-96 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Пока нет сообщений</p>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className="flex gap-3">
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-xs text-primary-foreground font-medium">
                        {message.user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">{message.user.name}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(message.createdAt).toLocaleString('ru-RU')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{formatMessageWithMentions(message.content)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <form onSubmit={handleSendMessage} className="p-6 border-t">
            {/* Индикатор печати */}
            {typingUsers.length > 0 && (
              <div className="px-3 py-2 mb-2 text-xs text-gray-500 italic">
                {typingUsers.join(', ')} {typingUsers.length === 1 ? 'печатает' : 'печатают'}...
              </div>
            )}
            
            {/* Индикатор подключения WebSocket */}
            <div className="px-3 mb-2 flex items-center gap-2 text-xs">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
              <span className="text-gray-500">
                {isConnected ? 'Подключено' : 'Подключение...'}
              </span>
            </div>

            <div className="relative flex gap-3">
              {/* Подсказки: сотрудники (@) — поиск по имени/email, до 10 результатов */}
              {showMentionSuggestions && (
                <div className="absolute bottom-full left-0 mb-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <div className="p-2 border-b border-gray-100">
                    <p className="text-xs text-gray-500 font-medium">Упомянуть сотрудника</p>
                    <p className="text-xs text-gray-400 mt-0.5">Введите имя или email для поиска</p>
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {getMentionSuggestions().length === 0 ? (
                      <p className="px-3 py-4 text-sm text-gray-500">Никого не найдено</p>
                    ) : (
                      getMentionSuggestions().map((member) => (
                        <button
                          key={member.user.id}
                          type="button"
                          onClick={() => insertMention(member.user.name)}
                          className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 transition-colors"
                        >
                          <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-xs text-primary-foreground font-medium">
                              {member.user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {member.user.name}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {member.user.email}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              <input
                ref={messageInputRef}
                type="text"
                value={newMessage}
                onChange={handleMessageChange}
                onKeyDown={(e) => {
                  // Закрыть подсказки по Escape
                  if (e.key === 'Escape') {
                    setShowMentionSuggestions(false)
                  }
                }}
                placeholder="Написать сообщение... (используйте @ для упоминания)"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Send className="h-4 w-4" />
                Отправить
              </button>
            </div>
          </form>
        </div>

        </>
        )}

        {/* Edit Modal */}
        <Dialog open={showModal} onOpenChange={(o) => !o && setShowModal(false)}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-0">
            <DialogHeader className="border-b p-6 pb-4">
              <DialogTitle>Редактировать проект</DialogTitle>
            </DialogHeader>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Название *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Описание</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Статус</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    >
                      <option value="PLANNING">Планирование</option>
                      <option value="ACTIVE">Активный</option>
                      <option value="COMPLETED">Завершен</option>
                      <option value="ON_HOLD">Приостановлен</option>
                      <option value="CANCELLED">Отменен</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Приоритет</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({...formData, priority: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    >
                      <option value="LOW">Низкий</option>
                      <option value="MEDIUM">Средний</option>
                      <option value="HIGH">Высокий</option>
                      <option value="URGENT">Срочный</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Бюджет (₽)</label>
                    <input
                      type="number"
                      value={formData.budget}
                      onChange={(e) => setFormData({...formData, budget: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      💡 Изменение бюджета обновит финансовую запись планируемого дохода
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Дата начала</label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Дата окончания</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>

                {/* Дополнительные поля */}
                <div className="border-t pt-4 mt-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Дополнительная информация</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Адрес объекта</label>
                      <input
                        type="text"
                        value={formData.objectAddress}
                        onChange={(e) => setFormData({...formData, objectAddress: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                        placeholder="г. Москва, ул. Примерная, д. 1"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Номер договора</label>
                        <input
                          type="text"
                          value={formData.contractNumber}
                          onChange={(e) => setFormData({...formData, contractNumber: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                          placeholder="ДОГ-2026/001"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Дата договора</label>
                        <input
                          type="date"
                          value={formData.contractDate}
                          onChange={(e) => setFormData({...formData, contractDate: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
                  >
                    Сохранить
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                  >
                    Отмена
                  </button>
                </div>
              </form>
          </DialogContent>
        </Dialog>

        {/* Add Member Modal */}
        <Dialog open={showMembersModal} onOpenChange={(o) => !o && setShowMembersModal(false)}>
          <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto p-0">
            <DialogHeader className="border-b p-6 pb-4">
              <DialogTitle>Добавить участника</DialogTitle>
            </DialogHeader>

              <div className="p-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Выберите пользователя
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                  >
                    <option value="">Выберите пользователя...</option>
                    {availableUsers
                      .filter(user => !project?.users.some(member => member.user.id === user.id))
                      .map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.email}) {user.position && `- ${user.position}`}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleAddMember}
                    disabled={!selectedUserId || membersLoading}
                    className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {membersLoading ? 'Добавление...' : 'Добавить'}
                  </button>
                  <button
                    onClick={() => setShowMembersModal(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                  >
                    Отмена
                  </button>
                </div>
              </div>
          </DialogContent>
        </Dialog>

        {/* Invite External Modal */}
        <Dialog open={showInviteModal} onOpenChange={(o) => !o && setShowInviteModal(false)}>
          <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto p-0">
            <DialogHeader className="border-b p-6 pb-4">
              <DialogTitle>Пригласить внешнего участника</DialogTitle>
            </DialogHeader>

            <div className="p-6">
              {inviteResult ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                    <p className="text-sm font-medium text-green-900">Участник добавлен в проект</p>
                    <p className="mt-1 text-xs text-amber-600">
                      Временный пароль показывается один раз — передайте сейчас.
                    </p>
                    <dl className="mt-3 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Email</dt>
                        <dd className="font-mono text-gray-900">{inviteResult.email}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Пароль</dt>
                        <dd className="font-mono font-bold text-gray-900">{inviteResult.tempPassword}</dd>
                      </div>
                    </dl>
                  </div>
                  <button
                    onClick={copyInviteCredentials}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <Copy className="h-4 w-4" />
                    {inviteCopied ? 'Скопировано' : 'Скопировать данные для передачи'}
                  </button>
                  <button
                    onClick={() => setShowInviteModal(false)}
                    className="w-full rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                  >
                    Готово
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Тип</label>
                    <select
                      value={inviteData.role}
                      onChange={(e) => setInviteData({ ...inviteData, role: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:ring-2 focus:ring-gray-900"
                    >
                      <option value="CONTRACTOR">Подрядчик — задачи, документы, согласования, чат (без финансов)</option>
                      <option value="CLIENT">Заказчик — график, документы, согласования, чат</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Имя / организация</label>
                    <input
                      value={inviteData.name}
                      onChange={(e) => setInviteData({ ...inviteData, name: e.target.value })}
                      placeholder="Название организации или ФИО"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Email для входа</label>
                    <input
                      type="email"
                      value={inviteData.email}
                      onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                      placeholder="user@example.com"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Будет создан аккаунт с временным паролем и доступом только к этому проекту.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleInviteExternal}
                      disabled={!inviteData.name.trim() || !inviteData.email.trim() || membersLoading}
                      className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {membersLoading ? 'Создание…' : 'Пригласить'}
                    </button>
                    <button
                      onClick={() => setShowInviteModal(false)}
                      className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Contact Modal */}
        <Dialog
          open={showContactModal && !!selectedMember}
          onOpenChange={(o) => !o && setShowContactModal(false)}
        >
          <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto p-0">
            <DialogHeader className="border-b p-6 pb-4">
              <DialogTitle>Контактные данные</DialogTitle>
            </DialogHeader>

              {selectedMember && (
              <div className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-2xl text-primary-foreground font-medium">
                      {selectedMember.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{selectedMember.name}</h3>
                    {selectedMember.position && (
                      <p className="text-sm text-gray-600">{selectedMember.position}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                      <span className="text-sm">📧</span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="text-sm font-medium text-gray-900">{selectedMember.email}</p>
                    </div>
                  </div>

                  {selectedMember.phone && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                        <span className="text-sm">📞</span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Телефон</p>
                        <p className="text-sm font-medium text-gray-900">{selectedMember.phone}</p>
                      </div>
                    </div>
                  )}

                  {selectedMember.position && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                        <span className="text-sm">💼</span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Должность</p>
                        <p className="text-sm font-medium text-gray-900">{selectedMember.position}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-6">
                  <button
                    onClick={() => setShowContactModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                  >
                    Закрыть
                  </button>
                </div>
              </div>
              )}
          </DialogContent>
        </Dialog>

        {/* Client Edit Modal */}
        <Dialog open={showClientModal} onOpenChange={(o) => !o && setShowClientModal(false)}>
          <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto p-0">
            <DialogHeader className="sticky top-0 z-10 border-b bg-white p-6 pb-4">
              <DialogTitle>Данные клиента</DialogTitle>
            </DialogHeader>

              <div className="p-6 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Название клиента</label>
                    <input
                      type="text"
                      value={clientFormData.clientName}
                      onChange={(e) => setClientFormData({...clientFormData, clientName: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      placeholder="ООО 'Название компании'"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Полное юридическое наименование</label>
                    <input
                      type="text"
                      value={clientFormData.clientLegalName}
                      onChange={(e) => setClientFormData({...clientFormData, clientLegalName: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      placeholder="Общество с ограниченной ответственностью..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">ИНН</label>
                    <input
                      type="text"
                      value={clientFormData.clientInn}
                      onChange={(e) => setClientFormData({...clientFormData, clientInn: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      placeholder="1234567890"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">КПП</label>
                    <input
                      type="text"
                      value={clientFormData.clientKpp}
                      onChange={(e) => setClientFormData({...clientFormData, clientKpp: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      placeholder="123456789"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">ОГРН</label>
                    <input
                      type="text"
                      value={clientFormData.clientOgrn}
                      onChange={(e) => setClientFormData({...clientFormData, clientOgrn: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      placeholder="1234567890123"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Юридический адрес</label>
                    <textarea
                      value={clientFormData.clientLegalAddress}
                      onChange={(e) => setClientFormData({...clientFormData, clientLegalAddress: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      rows={2}
                      placeholder="г. Москва, ул. Примерная, д. 1, офис 101"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Фактический адрес</label>
                    <textarea
                      value={clientFormData.clientActualAddress}
                      onChange={(e) => setClientFormData({...clientFormData, clientActualAddress: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      rows={2}
                      placeholder="г. Москва, ул. Фактическая, д. 2, офис 201"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">ФИО директора</label>
                    <input
                      type="text"
                      value={clientFormData.clientDirectorName}
                      onChange={(e) => setClientFormData({...clientFormData, clientDirectorName: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      placeholder="Иванов Иван Иванович"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Телефон</label>
                    <input
                      type="text"
                      value={clientFormData.clientContactPhone}
                      onChange={(e) => setClientFormData({...clientFormData, clientContactPhone: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      placeholder="+7 (495) 123-45-67"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={clientFormData.clientContactEmail}
                    onChange={(e) => setClientFormData({...clientFormData, clientContactEmail: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="info@company.ru"
                  />
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Банковские реквизиты</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Расчетный счет</label>
                      <input
                        type="text"
                        value={clientFormData.clientBankAccount}
                        onChange={(e) => setClientFormData({...clientFormData, clientBankAccount: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                        placeholder="40702810000000000001"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Наименование банка</label>
                      <input
                        type="text"
                        value={clientFormData.clientBankName}
                        onChange={(e) => setClientFormData({...clientFormData, clientBankName: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                        placeholder="ПАО СБЕРБАНК"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">БИК банка</label>
                      <input
                        type="text"
                        value={clientFormData.clientBankBik}
                        onChange={(e) => setClientFormData({...clientFormData, clientBankBik: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                        placeholder="044525225"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Корреспондентский счет</label>
                      <input
                        type="text"
                        value={clientFormData.clientCorrespondentAccount}
                        onChange={(e) => setClientFormData({...clientFormData, clientCorrespondentAccount: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                        placeholder="30101810000000000225"
                      />
                    </div>
                  </div>
                </div>

                <p className="text-xs text-gray-500 mt-4">
                  💡 Эти данные будут автоматически использоваться в договорах и других документах проекта
                </p>
              </div>

              <div className="flex gap-3 p-6 border-t sticky bottom-0 bg-white">
                <button
                  onClick={handleSaveClient}
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
                >
                  Сохранить
                </button>
                <button
                  onClick={() => setShowClientModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                >
                  Отмена
                </button>
              </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  )
}

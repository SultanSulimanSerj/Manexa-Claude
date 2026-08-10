'use client'



import { confirm } from '@/components/ui/confirm'
import { toast } from '@/components/ui/use-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Layout from '@/components/layout'
import PageHeader from '@/components/page-header'
import { SkeletonList } from '@/components/ui/skeleton'
import {
  ArrowLeft, 
  Plus, 
  Calendar, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  X,
  Check,
  Clock,
  AlertTriangle,
  Pause,
  Play,
  User,
  Download,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Loader2,
  Camera,
  Image as ImageIcon,
  Upload,
  ZoomIn
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

interface ChecklistItem {
  id: string
  title: string
  isCompleted: boolean
  orderIndex: number
  completedAt: string | null
  completedBy: { id: string; name: string } | null
}

interface StagePhoto {
  id: string
  filename: string
  originalName: string
  description: string | null
  mimeType: string
  size: number
  url: string
  createdAt: string
  uploadedBy: { id: string; name: string }
}

interface WorkStage {
  id: string
  name: string
  description: string | null
  orderIndex: number
  plannedStart: string
  plannedEnd: string
  plannedStartDate?: string
  plannedEndDate?: string
  actualStart: string | null
  actualEnd: string | null
  actualStartDate?: string | null
  actualEndDate?: string | null
  progress: number
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'DELAYED'
  color: string
  responsible: { id: string; name: string; email: string } | null
  dependsOn: Array<{
    dependsOn: { id: string; name: string }
  }>
  checklist?: ChecklistItem[]
}

interface ProjectUser {
  id: string
  name: string
  email: string
}

const statusLabels: Record<string, string> = {
  NOT_STARTED: 'Не начат',
  IN_PROGRESS: 'В работе',
  PAUSED: 'Приостановлен',
  COMPLETED: 'Завершён',
  DELAYED: 'Задерживается'
}

const statusColors: Record<string, string> = {
  NOT_STARTED: 'bg-gray-200 text-gray-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  PAUSED: 'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-green-100 text-green-700',
  DELAYED: 'bg-red-100 text-red-700'
}

const statusIcons: Record<string, any> = {
  NOT_STARTED: Clock,
  IN_PROGRESS: Play,
  PAUSED: Pause,
  COMPLETED: Check,
  DELAYED: AlertTriangle
}

// Цвета полос Ганта по статусу (10b): фон = светлый тон, fill = насыщенный на % выполнения
const STAGE_BAR: Record<string, { bg: string; fill: string; dot: string; dashed?: boolean }> = {
  NOT_STARTED: { bg: '#fafafa', fill: '#c4c4c9', dot: '#c4c4c9', dashed: true },
  IN_PROGRESS: { bg: '#d7e9fa', fill: '#1c7fd6', dot: '#1c7fd6' },
  PAUSED: { bg: '#fdf6e7', fill: '#d97706', dot: '#d97706' },
  COMPLETED: { bg: '#dff0e4', fill: '#16803c', dot: '#16803c' },
  DELAYED: { bg: '#fdeef0', fill: '#dc2626', dot: '#dc2626' },
}
const avInit = (name?: string) => { const p = (name || '?').trim().split(/\s+/); return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '?' }

const defaultColors = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
]

export default function ProjectSchedulePage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  
  const [stages, setStages] = useState<WorkStage[]>([])
  const [projectUsers, setProjectUsers] = useState<ProjectUser[]>([])
  const [projectName, setProjectName] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingStage, setEditingStage] = useState<WorkStage | null>(null)
  const [viewStartDate, setViewStartDate] = useState(new Date())
  const [exporting, setExporting] = useState(false)
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    plannedStart: '',
    plannedEnd: '',
    actualStart: '',
    actualEnd: '',
    progress: 0,
    status: 'NOT_STARTED',
    responsibleId: '',
    color: '#3B82F6',
    dependsOnIds: [] as string[]
  })
  
  // Чек-лист
  const [expandedStageId, setExpandedStageId] = useState<string | null>(null)
  const [checklistItems, setChecklistItems] = useState<Record<string, ChecklistItem[]>>({})
  const [loadingChecklist, setLoadingChecklist] = useState<string | null>(null)
  const [newItemTitle, setNewItemTitle] = useState('')
  const [addingItem, setAddingItem] = useState(false)
  const [togglingItemId, setTogglingItemId] = useState<string | null>(null)
  
  // Фото-отчёты
  const [stagePhotos, setStagePhotos] = useState<Record<string, StagePhoto[]>>({})
  const [loadingPhotos, setLoadingPhotos] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<StagePhoto | null>(null)
  const [activeTab, setActiveTab] = useState<'checklist' | 'photos'>('checklist')

  // Загрузка данных
  useEffect(() => {
    fetchData()
  }, [projectId])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Загружаем проект
      const projectRes = await fetch(`/api/projects/${projectId}`)
      if (projectRes.ok) {
        const projectData = await projectRes.json()
        setProjectName(projectData.name)
        setProjectUsers(projectData.users?.map((u: any) => u.user) || [])
      }
      
      // Загружаем этапы
      const stagesRes = await fetch(`/api/projects/${projectId}/stages`)
      if (stagesRes.ok) {
        const stagesData = await stagesRes.json()
        setStages(stagesData)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Вычисляем диапазон дат для отображения (4 недели) — каждый день строго в полночь локального времени
  const dateRange = useMemo(() => {
    const dates: Date[] = []
    const start = new Date(viewStartDate)
    start.setHours(0, 0, 0, 0) // Обнуляем время до полночи
    const dayOfWeek = start.getDay()
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Дней до понедельника
    start.setDate(start.getDate() - daysToMonday) // Начало недели (понедельник) в полночь
    
    for (let i = 0; i < 28; i++) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, 0, 0, 0, 0)
      dates.push(date)
    }
    return dates
  }, [viewStartDate])

  // Календарная дата (YYYY-MM-DD) → timestamp локальной полуночи. Работает в любом часовом поясе.
  const parseDateToLocalMidnight = (value: string | Date): number => {
    if (value instanceof Date) {
      return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
    }
    const str = String(value)
    const datePart = str.slice(0, 10)
    const [y, m, d] = datePart.split('-').map(Number)
    if (!y || !m || !d) return new Date(str).getTime()
    return new Date(y, m - 1, d).getTime()
  }

  const getPlannedStartDate = (stage: WorkStage): string =>
    stage.plannedStartDate ?? stage.plannedStart?.slice(0, 10) ?? ''
  const getPlannedEndDate = (stage: WorkStage): string =>
    stage.plannedEndDate ?? stage.plannedEnd?.slice(0, 10) ?? ''

  const getStagePosition = (stage: WorkStage) => {
    const startStr = getPlannedStartDate(stage)
    const endStr = getPlannedEndDate(stage)
    if (!startStr || !endStr || !dateRange.length) return { left: '0%', width: '2%' }
    
    // Парсим календарные даты этапа
    const [startY, startM, startD] = startStr.split('-').map(Number)
    const [endY, endM, endD] = endStr.split('-').map(Number)
    if (!startY || !startM || !startD || !endY || !endM || !endD) return { left: '0%', width: '2%' }
    
    // Находим индексы колонок для дат начала и окончания
    let startColIndex = -1
    let endColIndex = -1
    
    for (let i = 0; i < dateRange.length; i++) {
      const colDate = dateRange[i]
      if (colDate.getFullYear() === startY && colDate.getMonth() === startM - 1 && colDate.getDate() === startD) {
        startColIndex = i
      }
      if (colDate.getFullYear() === endY && colDate.getMonth() === endM - 1 && colDate.getDate() === endD) {
        endColIndex = i
      }
    }
    
    // Если даты не найдены в диапазоне, возвращаем минимальную позицию
    if (startColIndex < 0 || endColIndex < 0) {
      return { left: '0%', width: '2%' }
    }
    
    // Позиция: каждая колонка = 100% / 28 колонок
    const colWidth = 100 / dateRange.length
    const left = (startColIndex * colWidth)
    const right = ((endColIndex + 1) * colWidth) // Конец = начало следующей колонки
    const width = right - left

    return { left: `${left}%`, width: `${Math.max(width, colWidth)}%` }
  }

  // Обработчики
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const url = editingStage 
        ? `/api/projects/${projectId}/stages/${editingStage.id}`
        : `/api/projects/${projectId}/stages`
      
      const method = editingStage ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          plannedStart: formData.plannedStart,
          plannedEnd: formData.plannedEnd,
          actualStart: formData.actualStart || null,
          actualEnd: formData.actualEnd || null,
          progress: formData.progress,
          status: formData.status,
          responsibleId: formData.responsibleId || null,
          color: formData.color,
          dependsOnIds: formData.dependsOnIds
        })
      })

      if (response.ok) {
        await fetchData()
        closeModal()
      }
    } catch (error) {
      console.error('Error saving stage:', error)
    }
  }

  const handleDeleteClick = async (stageId: string) => {
    const ok = await confirm({
      title: 'Удалить этап?',
      description: 'Действие необратимо. Этап будет удалён вместе со всеми связанными данными (чек-лист, фото).',
      confirmText: 'Удалить',
      destructive: true,
    })
    if (!ok) return
    try {
      const response = await fetch(`/api/projects/${projectId}/stages/${stageId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        await fetchData()
      }
    } catch (error) {
      console.error('Error deleting stage:', error)
    }
  }

  const handleProgressChange = async (stageId: string, progress: number) => {
    try {
      await fetch(`/api/projects/${projectId}/stages/${stageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress })
      })
      
      setStages(stages.map(s => s.id === stageId ? { ...s, progress } : s))
    } catch (error) {
      console.error('Error updating progress:', error)
    }
  }

  const openEditModal = (stage: WorkStage) => {
    setEditingStage(stage)
    setFormData({
      name: stage.name,
      description: stage.description || '',
      plannedStart: getPlannedStartDate(stage),
      plannedEnd: getPlannedEndDate(stage),
      actualStart: stage.actualStartDate ?? stage.actualStart?.slice(0, 10) ?? '',
      actualEnd: stage.actualEndDate ?? stage.actualEnd?.slice(0, 10) ?? '',
      progress: stage.progress,
      status: stage.status,
      responsibleId: stage.responsible?.id || '',
      color: stage.color,
      dependsOnIds: stage.dependsOn.map(d => d.dependsOn.id)
    })
    setShowModal(true)
  }

  const openCreateModal = () => {
    setEditingStage(null)
    const today = new Date().toISOString().split('T')[0]
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    setFormData({
      name: '',
      description: '',
      plannedStart: today,
      plannedEnd: nextWeek,
      actualStart: '',
      actualEnd: '',
      progress: 0,
      status: 'NOT_STARTED',
      responsibleId: '',
      color: defaultColors[stages.length % defaultColors.length],
      dependsOnIds: []
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingStage(null)
  }

  const navigateWeeks = (direction: number) => {
    const newDate = new Date(viewStartDate)
    newDate.setDate(newDate.getDate() + direction * 7)
    setViewStartDate(newDate)
  }

  // Функции чек-листа
  const toggleStageExpand = async (stageId: string) => {
    if (expandedStageId === stageId) {
      setExpandedStageId(null)
      return
    }
    
    setExpandedStageId(stageId)
    setActiveTab('checklist')
    
    // Загружаем чек-лист и фото если ещё не загружены
    if (!checklistItems[stageId]) {
      fetchChecklist(stageId)
    }
    if (!stagePhotos[stageId]) {
      fetchPhotos(stageId)
    }
  }

  const fetchChecklist = async (stageId: string) => {
    try {
      setLoadingChecklist(stageId)
      const res = await fetch(`/api/projects/${projectId}/stages/${stageId}/checklist`)
      if (res.ok) {
        const data = await res.json()
        setChecklistItems(prev => ({ ...prev, [stageId]: data }))
      }
    } catch (error) {
      console.error('Error fetching checklist:', error)
    } finally {
      setLoadingChecklist(null)
    }
  }

  const handleAddChecklistItem = async (stageId: string) => {
    if (!newItemTitle.trim()) return
    
    try {
      setAddingItem(true)
      const res = await fetch(`/api/projects/${projectId}/stages/${stageId}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newItemTitle })
      })
      
      if (res.ok) {
        const newItem = await res.json()
        setChecklistItems(prev => ({
          ...prev,
          [stageId]: [...(prev[stageId] || []), newItem]
        }))
        setNewItemTitle('')
        
        // Обновляем прогресс этапа
        await fetchData()
      }
    } catch (error) {
      console.error('Error adding checklist item:', error)
    } finally {
      setAddingItem(false)
    }
  }

  const handleToggleChecklistItem = async (stageId: string, itemId: string, isCompleted: boolean) => {
    try {
      setTogglingItemId(itemId)
      const res = await fetch(`/api/projects/${projectId}/stages/${stageId}/checklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, isCompleted: !isCompleted })
      })
      
      if (res.ok) {
        const updated = await res.json()
        setChecklistItems(prev => ({
          ...prev,
          [stageId]: prev[stageId].map(item => item.id === itemId ? updated : item)
        }))
        
        // Обновляем прогресс этапа
        await fetchData()
      }
    } catch (error) {
      console.error('Error toggling checklist item:', error)
    } finally {
      setTogglingItemId(null)
    }
  }

  const handleDeleteChecklistItem = async (stageId: string, itemId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/stages/${stageId}/checklist?itemId=${itemId}`, {
        method: 'DELETE'
      })
      
      if (res.ok) {
        setChecklistItems(prev => ({
          ...prev,
          [stageId]: prev[stageId].filter(item => item.id !== itemId)
        }))
        
        // Обновляем прогресс этапа
        await fetchData()
      }
    } catch (error) {
      console.error('Error deleting checklist item:', error)
    }
  }

  // Функции фото-отчётов
  const fetchPhotos = async (stageId: string) => {
    try {
      setLoadingPhotos(stageId)
      const res = await fetch(`/api/projects/${projectId}/stages/${stageId}/photos`)
      if (res.ok) {
        const data = await res.json()
        setStagePhotos(prev => ({ ...prev, [stageId]: data }))
      }
    } catch (error) {
      console.error('Error fetching photos:', error)
    } finally {
      setLoadingPhotos(null)
    }
  }

  const handleUploadPhoto = async (stageId: string, file: File) => {
    try {
      setUploadingPhoto(true)
      const formData = new FormData()
      formData.append('file', file)
      
      const res = await fetch(`/api/projects/${projectId}/stages/${stageId}/photos`, {
        method: 'POST',
        body: formData
      })
      
      if (res.ok) {
        const newPhoto = await res.json()
        setStagePhotos(prev => ({
          ...prev,
          [stageId]: [newPhoto, ...(prev[stageId] || [])]
        }))
      } else {
        const error = await res.json()
        toast.error(error.error || 'Ошибка загрузки')
      }
    } catch (error) {
      console.error('Error uploading photo:', error)
      toast.error('Ошибка загрузки фото')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleDeletePhoto = async (stageId: string, photoId: string) => {
    if (!await confirm('Удалить это фото?')) return
    
    try {
      const res = await fetch(`/api/projects/${projectId}/stages/${stageId}/photos?photoId=${photoId}`, {
        method: 'DELETE'
      })
      
      if (res.ok) {
        setStagePhotos(prev => ({
          ...prev,
          [stageId]: prev[stageId].filter(p => p.id !== photoId)
        }))
        if (selectedPhoto?.id === photoId) {
          setSelectedPhoto(null)
        }
      }
    } catch (error) {
      console.error('Error deleting photo:', error)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' Б'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ'
    return (bytes / (1024 * 1024)).toFixed(1) + ' МБ'
  }

  // Экспорт в Excel
  const handleExport = async () => {
    try {
      setExporting(true)
      const response = await fetch(`/api/projects/${projectId}/stages/export`)
      
      if (!response.ok) {
        throw new Error('Ошибка экспорта')
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      
      // Получаем имя файла из заголовка или создаём своё
      const contentDisposition = response.headers.get('Content-Disposition')
      const dateStr = new Date().toISOString().split('T')[0]
      let fileName = `График_работ_${projectName.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}_${dateStr}.xlsx`
      
      if (contentDisposition) {
        // Сначала пробуем UTF-8 версию (filename*=UTF-8'')
        const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/)
        if (utf8Match) {
          fileName = decodeURIComponent(utf8Match[1])
        } else {
          // Иначе берём обычный filename
          const match = contentDisposition.match(/filename="([^"]+)"/)
          if (match) {
            fileName = match[1]
          }
        }
      }
      
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Ошибка при экспорте графика')
    } finally {
      setExporting(false)
    }
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const isWeekend = (date: Date) => {
    const day = date.getDay()
    return day === 0 || day === 6
  }

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <PageHeader title="График работ" description="Загрузка..." />
          <SkeletonList rows={6} />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Шапка 10b */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[12.5px] text-neutral-400">
              <Link href="/projects" className="hover:underline">Проекты</Link> · <Link href={`/projects/${projectId}`} className="hover:underline">{projectName || 'Проект'}</Link>
            </div>
            <h1 className="mt-0.5 text-[23px] font-bold text-neutral-900">График работ</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-neutral-200 bg-white">
              <button onClick={() => navigateWeeks(-1)} className="flex h-9 w-9 items-center justify-center rounded-l-lg text-neutral-500 hover:bg-neutral-50"><ChevronLeft className="h-4 w-4" /></button>
              <span className="min-w-[180px] px-2 text-center text-[13px] font-medium tabular-nums text-neutral-800">{formatDate(dateRange[0])} — {formatDate(dateRange[dateRange.length - 1])}</span>
              <button onClick={() => navigateWeeks(1)} className="flex h-9 w-9 items-center justify-center rounded-r-lg text-neutral-500 hover:bg-neutral-50"><ChevronRight className="h-4 w-4" /></button>
            </div>
            <button onClick={() => setViewStartDate(new Date())} className="h-9 rounded-lg border border-neutral-200 bg-white px-3.5 text-[13px] font-medium text-neutral-700 hover:bg-neutral-50">Сегодня</button>
            <button onClick={handleExport} disabled={exporting || stages.length === 0} className="flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3.5 text-[13px] font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}<span className="hidden sm:inline">Экспорт</span>
            </button>
            <button onClick={openCreateModal} className="flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white hover:bg-blue-700"><Plus className="h-4 w-4" /> Добавить этап</button>
          </div>
        </div>

        {/* Gantt Chart */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {/* Заголовок: месяцы + дни */}
          <div className="flex border-b border-neutral-200 bg-neutral-50/40">
            <div className="w-[300px] shrink-0 border-r border-neutral-100 px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-neutral-400">Этап работ</div>
            <div className="min-w-0 flex-1">
              <div className="flex border-b border-neutral-100">
                {(() => {
                  const months: { label: string; span: number }[] = []
                  dateRange.forEach((d) => {
                    const label = d.toLocaleDateString('ru-RU', { month: 'long' })
                    const last = months[months.length - 1]
                    if (last && last.label === label) last.span++
                    else months.push({ label, span: 1 })
                  })
                  return months.map((m, i) => (
                    <div key={i} className="truncate px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400" style={{ width: `${(m.span / dateRange.length) * 100}%` }}>{m.label}</div>
                  ))
                })()}
              </div>
              <div className="flex">
                {dateRange.map((date, i) => (
                  <div key={i} className={`min-w-0 flex-1 border-l border-neutral-50 py-1.5 text-center text-[11px] tabular-nums ${isToday(date) ? 'font-bold text-neutral-900' : isWeekend(date) ? 'text-neutral-300' : 'text-neutral-400'}`}>{date.getDate()}</div>
                ))}
              </div>
            </div>
          </div>

          {/* Этапы */}
          {stages.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">Нет этапов работ</p>
              <p className="text-sm mb-4">Добавьте первый этап для планирования графика</p>
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                <Plus className="w-4 h-4" />
                Добавить этап
              </button>
            </div>
          ) : (
            <div className="divide-y">
              {stages.map((stage) => {
                const position = getStagePosition(stage)
                const isExpanded = expandedStageId === stage.id
                const stageChecklist = checklistItems[stage.id] || []
                const completedCount = stageChecklist.filter(i => i.isCompleted).length
                
                return (
                  <div key={stage.id}>
                    <div className="flex hover:bg-neutral-50/60 group">
                      {/* Левая колонка */}
                      <div className="flex w-[300px] shrink-0 items-center justify-between gap-2 border-r border-neutral-100 px-3 py-2.5">
                        <div className="flex min-w-0 flex-1 items-start gap-1.5">
                          <button onClick={() => toggleStageExpand(stage.id)} className="mt-0.5 rounded p-0.5 text-neutral-400 hover:bg-neutral-200">
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: STAGE_BAR[stage.status].dot }} />
                              <span className="truncate text-[13.5px] font-semibold text-neutral-900">{stage.name}</span>
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 pl-[18px] text-[12px] text-neutral-400">
                              {stage.responsible && <span className="truncate">{stage.responsible.name}</span>}
                              <span className="tabular-nums">· {stage.progress}%</span>
                              {stageChecklist.length > 0 && <span className="flex items-center gap-0.5"><CheckSquare className="h-3 w-3" />{completedCount}/{stageChecklist.length}</span>}
                              {(stagePhotos[stage.id]?.length || 0) > 0 && <span className="flex items-center gap-0.5"><Camera className="h-3 w-3" />{stagePhotos[stage.id]?.length}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <button onClick={() => openEditModal(stage)} className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"><Edit2 className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleDeleteClick(stage.id)} className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                      {/* Полоса Ганта */}
                      <div className="relative flex h-14 min-w-0 flex-1 items-center">
                        <div className="absolute inset-0 flex">
                          {dateRange.map((date, i) => (
                            <div key={i} className={`min-w-0 flex-1 border-l border-neutral-50 ${isWeekend(date) ? 'bg-neutral-50/70' : ''}`} />
                          ))}
                        </div>
                        {dateRange.some((d) => isToday(d)) && (
                          <div className="absolute top-0 bottom-0 z-20 w-px bg-neutral-900" style={{ left: `${((new Date().getTime() - dateRange[0].getTime()) / (dateRange[dateRange.length - 1].getTime() - dateRange[0].getTime())) * 100}%` }} />
                        )}
                        {(() => {
                          const bar = STAGE_BAR[stage.status]
                          const whiteText = stage.status === 'COMPLETED' || stage.progress >= 35
                          return (
                            <div
                              className="absolute z-10 flex h-7 items-center overflow-hidden rounded-md cursor-pointer hover:brightness-95"
                              style={{ left: position.left, width: position.width, backgroundColor: bar.bg, border: bar.dashed ? `1px dashed ${bar.dot}` : 'none' }}
                              onClick={() => openEditModal(stage)}
                              title={`${stage.name} · ${stage.progress}%`}
                            >
                              <div className="absolute inset-y-0 left-0 rounded-md" style={{ width: `${stage.progress}%`, backgroundColor: bar.fill }} />
                              <span className={`relative z-10 truncate px-2 text-[12px] font-medium ${whiteText ? 'text-white' : 'text-neutral-700'}`}>{stage.name}{stage.progress > 0 ? ` · ${stage.progress}%` : ''}</span>
                              {stage.responsible && (
                                <span className="relative z-10 ml-auto mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/90 text-[9px] font-semibold text-neutral-700 ring-1 ring-black/5" title={stage.responsible.name}>{avInit(stage.responsible.name)}</span>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                    
                    {/* Чек-лист и Фото-отчёты (раскрывающийся) */}
                    {isExpanded && (
                      <div className="bg-gray-50 border-t">
                        <div className="p-3">
                          {/* Вкладки */}
                          <div className="flex gap-2 mb-3">
                            <button
                              onClick={() => setActiveTab('checklist')}
                              className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                                activeTab === 'checklist' 
                                  ? 'bg-primary text-primary-foreground' 
                                  : 'bg-white text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              <CheckSquare className="w-4 h-4" />
                              Чек-лист
                              {stageChecklist.length > 0 && (
                                <span className={`ml-1 px-1.5 py-0.5 text-xs rounded ${
                                  activeTab === 'checklist' ? 'bg-gray-900' : 'bg-gray-200'
                                }`}>
                                  {completedCount}/{stageChecklist.length}
                                </span>
                              )}
                            </button>
                            <button
                              onClick={() => setActiveTab('photos')}
                              className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                                activeTab === 'photos' 
                                  ? 'bg-primary text-primary-foreground' 
                                  : 'bg-white text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              <Camera className="w-4 h-4" />
                              Фото-отчёт
                              {(stagePhotos[stage.id]?.length || 0) > 0 && (
                                <span className={`ml-1 px-1.5 py-0.5 text-xs rounded ${
                                  activeTab === 'photos' ? 'bg-gray-900' : 'bg-gray-200'
                                }`}>
                                  {stagePhotos[stage.id]?.length}
                                </span>
                              )}
                            </button>
                          </div>
                          
                          {/* Содержимое вкладки Чек-лист */}
                          {activeTab === 'checklist' && (
                            <div className="bg-white rounded-lg p-3 border">
                              {loadingChecklist === stage.id ? (
                                <div className="flex items-center justify-center py-4">
                                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                                </div>
                              ) : (
                                <>
                                  {/* Список пунктов */}
                                  <div className="space-y-1 mb-3">
                                    {stageChecklist.length === 0 ? (
                                      <p className="text-sm text-gray-400 py-2 text-center">Нет пунктов чек-листа</p>
                                    ) : (
                                      stageChecklist.map((item) => (
                                        <div 
                                          key={item.id} 
                                          className="flex items-center gap-2 group/item py-1.5 px-2 hover:bg-gray-50 rounded"
                                        >
                                          <button
                                            onClick={() => handleToggleChecklistItem(stage.id, item.id, item.isCompleted)}
                                            disabled={togglingItemId === item.id}
                                            className="flex-shrink-0"
                                          >
                                            {togglingItemId === item.id ? (
                                              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                            ) : item.isCompleted ? (
                                              <CheckSquare className="w-4 h-4 text-green-600" />
                                            ) : (
                                              <Square className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                                            )}
                                          </button>
                                          <span className={`text-sm flex-1 ${item.isCompleted ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                                            {item.title}
                                          </span>
                                          <button
                                            onClick={() => handleDeleteChecklistItem(stage.id, item.id)}
                                            className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-opacity"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                  
                                  {/* Добавление нового пункта */}
                                  <div className="flex gap-2 pt-2 border-t">
                                    <input
                                      type="text"
                                      value={newItemTitle}
                                      onChange={(e) => setNewItemTitle(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !addingItem) {
                                          handleAddChecklistItem(stage.id)
                                        }
                                      }}
                                      placeholder="Добавить пункт..."
                                      className="flex-1 text-sm border rounded px-2 py-1.5"
                                    />
                                    <button
                                      onClick={() => handleAddChecklistItem(stage.id)}
                                      disabled={addingItem || !newItemTitle.trim()}
                                      className="px-3 py-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
                                    >
                                      {addingItem ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <>
                                          <Plus className="w-4 h-4" />
                                          <span className="text-sm">Добавить</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                          
                          {/* Содержимое вкладки Фото */}
                          {activeTab === 'photos' && (
                            <div className="bg-white rounded-lg p-3 border">
                              {loadingPhotos === stage.id ? (
                                <div className="flex items-center justify-center py-4">
                                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                                </div>
                              ) : (
                                <>
                                  {/* Кнопка загрузки */}
                                  <div className="mb-3">
                                    <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors">
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0]
                                          if (file) {
                                            handleUploadPhoto(stage.id, file)
                                          }
                                          e.target.value = ''
                                        }}
                                        disabled={uploadingPhoto}
                                      />
                                      {uploadingPhoto ? (
                                        <>
                                          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                                          <span className="text-sm text-gray-500">Загрузка...</span>
                                        </>
                                      ) : (
                                        <>
                                          <Upload className="w-5 h-5 text-gray-400" />
                                          <span className="text-sm text-gray-500">Загрузить фото</span>
                                        </>
                                      )}
                                    </label>
                                  </div>
                                  
                                  {/* Сетка фото */}
                                  {(stagePhotos[stage.id]?.length || 0) === 0 ? (
                                    <p className="text-sm text-gray-400 py-4 text-center">Нет фотографий</p>
                                  ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                      {stagePhotos[stage.id]?.map((photo) => (
                                        <div 
                                          key={photo.id} 
                                          className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-pointer"
                                          onClick={() => setSelectedPhoto(photo)}
                                        >
                                          <img
                                            src={photo.url}
                                            alt={photo.originalName}
                                            className="w-full h-full object-cover"
                                          />
                                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                            <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                          </div>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleDeletePhoto(stage.id, photo.id)
                                            }}
                                            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Легенда 10b */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-[12.5px] text-neutral-500">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-neutral-900" /> Сегодня</span>
          {([['NOT_STARTED', 'Не начат'], ['IN_PROGRESS', 'В работе'], ['PAUSED', 'Приостановлен'], ['COMPLETED', 'Завершён'], ['DELAYED', 'Задерживается']] as const).map(([k, l]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="h-3 w-5 rounded" style={STAGE_BAR[k].dashed ? { backgroundColor: STAGE_BAR[k].bg, border: `1px dashed ${STAGE_BAR[k].dot}` } : { backgroundColor: STAGE_BAR[k].fill }} />
              {l}
            </span>
          ))}
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rotate-45 bg-neutral-900" /> Веха</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded bg-neutral-100" /> Выходные</span>
        </div>
      </div>

      {/* Модальное окно */}
      <Dialog open={showModal} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto p-0">
          <DialogHeader className="border-b p-6 pb-4">
            <DialogTitle>
              {editingStage ? 'Редактировать этап' : 'Новый этап работ'}
            </DialogTitle>
          </DialogHeader>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Название */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название этапа *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Например: Монтаж фундамента"
                  required
                />
              </div>
              
              {/* Описание */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Описание
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  rows={2}
                  placeholder="Подробности этапа..."
                />
              </div>
              
              {/* Плановые даты */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Плановое начало *
                  </label>
                  <input
                    type="date"
                    value={formData.plannedStart}
                    onChange={(e) => setFormData({ ...formData, plannedStart: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Плановое окончание *
                  </label>
                  <input
                    type="date"
                    value={formData.plannedEnd}
                    onChange={(e) => setFormData({ ...formData, plannedEnd: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    required
                  />
                </div>
              </div>
              
              {/* Фактические даты (только при редактировании) */}
              {editingStage && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Фактическое начало
                    </label>
                    <input
                      type="date"
                      value={formData.actualStart}
                      onChange={(e) => setFormData({ ...formData, actualStart: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Фактическое окончание
                    </label>
                    <input
                      type="date"
                      value={formData.actualEnd}
                      onChange={(e) => setFormData({ ...formData, actualEnd: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                </div>
              )}
              
              {/* Прогресс и статус */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Прогресс: {formData.progress}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={formData.progress}
                    onChange={(e) => setFormData({ ...formData, progress: Number(e.target.value) })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Статус
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    {Object.entries(statusLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Ответственный и цвет */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ответственный
                  </label>
                  <select
                    value={formData.responsibleId}
                    onChange={(e) => setFormData({ ...formData, responsibleId: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">Не назначен</option>
                    {projectUsers.map((user) => (
                      <option key={user.id} value={user.id}>{user.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Цвет
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {defaultColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData({ ...formData, color })}
                        className={`w-8 h-8 rounded-full border-2 ${
                          formData.color === color ? 'border-gray-800' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Зависимости */}
              {stages.filter(s => s.id !== editingStage?.id).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Зависит от этапов
                  </label>
                  <div className="space-y-2 max-h-32 overflow-y-auto border rounded-lg p-2">
                    {stages
                      .filter(s => s.id !== editingStage?.id)
                      .map((s) => (
                        <label key={s.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={formData.dependsOnIds.includes(s.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({ 
                                  ...formData, 
                                  dependsOnIds: [...formData.dependsOnIds, s.id] 
                                })
                              } else {
                                setFormData({ 
                                  ...formData, 
                                  dependsOnIds: formData.dependsOnIds.filter(id => id !== s.id) 
                                })
                              }
                            }}
                            className="rounded"
                          />
                          <div 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: s.color }}
                          />
                          {s.name}
                        </label>
                      ))}
                  </div>
                </div>
              )}
              
              {/* Кнопки */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                  {editingStage ? 'Сохранить' : 'Создать'}
                </button>
              </div>
            </form>
        </DialogContent>
      </Dialog>

      {/* Модальное окно просмотра фото */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] w-full">
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute -top-10 right-0 p-2 text-white hover:text-gray-300"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={selectedPhoto.url}
              alt={selectedPhoto.originalName}
              className="w-full h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-3 rounded-b-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{selectedPhoto.originalName}</p>
                  <p className="text-sm text-gray-300">
                    {formatFileSize(selectedPhoto.size)} • {new Date(selectedPhoto.createdAt).toLocaleDateString('ru-RU')}
                    {selectedPhoto.uploadedBy && ` • ${selectedPhoto.uploadedBy.name}`}
                  </p>
                </div>
                <a
                  href={selectedPhoto.url}
                  download={selectedPhoto.originalName}
                  onClick={(e) => e.stopPropagation()}
                  className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm flex items-center gap-1"
                >
                  <Download className="w-4 h-4" />
                  Скачать
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

    </Layout>
  )
}

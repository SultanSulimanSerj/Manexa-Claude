'use client'


import { toast } from '@/components/ui/use-toast'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Layout from '@/components/layout'
import { useState as useStateNav } from 'react'
import { ArrowLeft, Plus, Edit, Trash2, Save, Calculator, FileText, DollarSign, Download, Copy, Search, Filter, SortAsc, SortDesc, Eye, EyeOff, Check, X, AlertCircle, Info, Zap, Menu, Home, FolderOpen, Flag, CheckCircle, MessageSquare, BarChart3, Users, Settings } from 'lucide-react'
import Link from 'next/link'
import { PermissionButton } from '@/components/permission-guard'
import { CreateDocumentMenu } from '@/components/documents/CreateDocumentMenu'

interface EstimateItem {
  id: string
  name: string
  description: string
  notes?: string | null
  quantity: number
  unit: string
  unitPrice: number
  costPrice: number
  total: number
  category: string
  isNew?: boolean
  isEditing?: boolean
}

interface Estimate {
  id: string
  name: string
  description: string
  total: number
  totalCost: number
  profit: number
  vatEnabled: boolean
  vatRate: number
  vatAmount: number
  totalWithVat: number
  items: EstimateItem[]
  createdAt: string
  updatedAt: string
  isEditing?: boolean
}

/** Актуальные ставки НДС */
const VAT_RATES_RU = [
  { value: 0, label: '0% — без НДС / экспорт' },
  { value: 5, label: '5%' },
  { value: 7, label: '7%' },
  { value: 10, label: '10%' },
  { value: 22, label: '22%' }
] as const

interface ProjectInfo {
  id: string
  name: string
  budget: number | null
}

interface EstimateTemplate {
  id: string
  name: string
  items: Omit<EstimateItem, 'id'>[]
}

export default function EstimatePage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params?.id as string

  const [project, setProject] = useState<ProjectInfo | null>(null)
  const [estimates, setEstimates] = useState<Estimate[]>([])
  const [loading, setLoading] = useState(true)
  const [activeEstimate, setActiveEstimate] = useState<Estimate | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showTemplatesModal, setShowTemplatesModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'total' | 'createdAt'>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showCategories, setShowCategories] = useState(true)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [newItemId, setNewItemId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isNavCollapsed, setIsNavCollapsed] = useStateNav(true)
  const [isHoveringNav, setIsHoveringNav] = useState(false)

  // Обработчики для навигации при наведении
  const handleMouseEnter = () => {
    if (isNavCollapsed) {
      setIsHoveringNav(true)
    }
  }

  const handleMouseLeave = () => {
    setIsHoveringNav(false)
  }

  // Форма создания/редактирования сметы
  const [estimateForm, setEstimateForm] = useState({
    name: '',
    description: ''
  })

  // Шаблоны смет
  const [templates, setTemplates] = useState<EstimateTemplate[]>([])

  const tableRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchProject()
    fetchEstimates()
    fetchEstimateTemplates()
  }, [projectId])

  const fetchEstimateTemplates = async () => {
    try {
      const response = await fetch('/api/estimate-templates')
      if (response.ok) {
        const data = await response.json()
        setTemplates(data.templates || [])
      }
    } catch (error) {
      console.error('Error fetching estimate templates:', error)
    }
  }


  const fetchProject = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`)
      if (response.ok) {
        const data = await response.json()
        setProject({
          id: data.id,
          name: data.name,
          budget: data.budget
        })
      }
    } catch (error) {
      console.error('Error fetching project:', error)
    }
  }

  const fetchEstimates = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/projects/${projectId}/estimates`)
      if (response.ok) {
        const data = await response.json()
        setEstimates(data)
      }
    } catch (error) {
      console.error('Error fetching estimates:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateEstimate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch(`/api/projects/${projectId}/estimates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(estimateForm)
      })

      if (response.ok) {
        const newEstimate = await response.json()
        setEstimates([...estimates, newEstimate])
        setActiveEstimate(newEstimate)
        setShowCreateModal(false)
        setEstimateForm({ name: '', description: '' })
      }
    } catch (error) {
      console.error('Error creating estimate:', error)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(value)
  }

  const recalculateEstimate = (estimate: Estimate) => {
    // Пересчитываем total для каждого элемента
    const itemsWithRecalculatedTotal = estimate.items.map(item => ({
      ...item,
      total: item.quantity * item.unitPrice
    }))
    
    const total = itemsWithRecalculatedTotal.reduce((sum, item) => sum + item.total, 0)
    const totalCost = itemsWithRecalculatedTotal.reduce((sum, item) => sum + (item.quantity * item.costPrice), 0)
    const profit = total - totalCost
    const vatAmount = estimate.vatEnabled ? (total * estimate.vatRate / 100) : 0
    const totalWithVat = total + vatAmount
    
    
    return {
      ...estimate,
      items: itemsWithRecalculatedTotal,
      total,
      totalCost,
      profit,
      vatAmount,
      totalWithVat
    }
  }

  const addNewItem = () => {
    if (!activeEstimate) return
    
    const newItem: EstimateItem = {
      id: `new_${Date.now()}`,
      name: '',
      description: '',
      quantity: 1,
      unit: 'шт',
      unitPrice: 0,
      costPrice: 0,
      total: 0,
      category: 'Материалы',
      isNew: true,
      isEditing: true
    }
    
    const updatedItems = [...activeEstimate.items, newItem]
    const total = updatedItems.reduce((sum, item) => sum + item.total, 0)
    const totalCost = updatedItems.reduce((sum, item) => sum + (item.quantity * item.costPrice), 0)
    const profit = total - totalCost
    const vatAmount = activeEstimate.vatEnabled ? (total * activeEstimate.vatRate / 100) : 0
    const totalWithVat = total + vatAmount
    
    setActiveEstimate({
      ...activeEstimate,
      items: updatedItems,
      total,
      totalCost,
      profit,
      vatAmount,
      totalWithVat
    })
    setNewItemId(newItem.id)
  }

  const updateItem = (itemId: string, field: keyof EstimateItem, value: any) => {
    if (!activeEstimate) return
    
    const updatedItems = activeEstimate.items.map(item => {
      if (item.id === itemId) {
        const updatedItem = { ...item, [field]: value }
        if (field === 'quantity' || field === 'unitPrice') {
          updatedItem.total = updatedItem.quantity * updatedItem.unitPrice
        }
        // costPrice не влияет на total, только на расчеты себестоимости
        return updatedItem
      }
      return item
    })
    
    const total = updatedItems.reduce((sum, item) => sum + item.total, 0)
    const totalCost = updatedItems.reduce((sum, item) => sum + (item.quantity * item.costPrice), 0)
    const profit = total - totalCost
    const vatAmount = activeEstimate.vatEnabled ? (total * activeEstimate.vatRate / 100) : 0
    const totalWithVat = total + vatAmount
    
    
    setActiveEstimate({
      ...activeEstimate,
      items: updatedItems,
      total,
      totalCost,
      profit,
      vatAmount,
      totalWithVat
    })
    
    setHasUnsavedChanges(true)
  }

  const deleteItem = (itemId: string) => {
    if (!activeEstimate) return
    
    const updatedItems = activeEstimate.items.filter(item => item.id !== itemId)
    const total = updatedItems.reduce((sum, item) => sum + item.total, 0)
    const totalCost = updatedItems.reduce((sum, item) => sum + (item.quantity * item.costPrice), 0)
    const profit = total - totalCost
    const vatAmount = activeEstimate.vatEnabled ? (total * activeEstimate.vatRate / 100) : 0
    const totalWithVat = total + vatAmount
    
    setActiveEstimate({
      ...activeEstimate,
      items: updatedItems,
      total,
      totalCost,
      profit,
      vatAmount,
      totalWithVat
    })
    
    setHasUnsavedChanges(true)
  }

  const duplicateItem = (itemId: string) => {
    if (!activeEstimate) return
    
    const item = activeEstimate.items.find(item => item.id === itemId)
    if (!item) return
    
    const duplicatedItem: EstimateItem = {
      ...item,
      id: `dup_${Date.now()}`,
      name: `${item.name} (копия)`,
      isNew: true,
      isEditing: true
    }
    
    const updatedItems = [...activeEstimate.items, duplicatedItem]
    const total = updatedItems.reduce((sum, item) => sum + item.total, 0)
    const totalCost = updatedItems.reduce((sum, item) => sum + (item.quantity * item.costPrice), 0)
    const profit = total - totalCost
    const vatAmount = activeEstimate.vatEnabled ? (total * activeEstimate.vatRate / 100) : 0
    const totalWithVat = total + vatAmount
    
    setActiveEstimate({
      ...activeEstimate,
      items: updatedItems,
      total,
      totalCost,
      profit,
      vatAmount,
      totalWithVat
    })
    
    setHasUnsavedChanges(true)
  }

  const applyTemplate = (template: EstimateTemplate) => {
    if (!activeEstimate) return
    
    const templateItems: EstimateItem[] = template.items.map(item => ({
      ...item,
      id: `tpl_${Date.now()}_${Math.random()}`,
      isNew: true
    }))
    
    const updatedItems = [...activeEstimate.items, ...templateItems]
    const total = updatedItems.reduce((sum, item) => sum + item.total, 0)
    const totalCost = updatedItems.reduce((sum, item) => sum + (item.quantity * item.costPrice), 0)
    const profit = total - totalCost
    const vatAmount = activeEstimate.vatEnabled ? (total * activeEstimate.vatRate / 100) : 0
    const totalWithVat = total + vatAmount
    
    setActiveEstimate({
      ...activeEstimate,
      items: updatedItems,
      total,
      totalCost,
      profit,
      vatAmount,
      totalWithVat
    })
    setShowTemplatesModal(false)
    setHasUnsavedChanges(true)
  }

  const toggleVat = () => {
    if (!activeEstimate) return
    
    const vatEnabled = !activeEstimate.vatEnabled
    const vatAmount = vatEnabled ? (activeEstimate.total * activeEstimate.vatRate / 100) : 0
    const totalWithVat = activeEstimate.total + vatAmount
    
    setActiveEstimate({
      ...activeEstimate,
      vatEnabled,
      vatAmount,
      totalWithVat
    })
    
    setHasUnsavedChanges(true)
  }

  const updateVatRate = (rate: number) => {
    if (!activeEstimate) return
    
    const vatAmount = activeEstimate.vatEnabled ? (activeEstimate.total * rate / 100) : 0
    const totalWithVat = activeEstimate.total + vatAmount
    
    setActiveEstimate({
      ...activeEstimate,
      vatRate: rate,
      vatAmount,
      totalWithVat
    })
    
    setHasUnsavedChanges(true)
  }

  const saveEstimate = async () => {
    if (!activeEstimate) return
    
    try {
      setIsSaving(true)
      const response = await fetch(`/api/projects/${projectId}/estimates/${activeEstimate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: activeEstimate.name,
          description: activeEstimate.description,
          vatEnabled: activeEstimate.vatEnabled,
          vatRate: activeEstimate.vatRate,
          items: activeEstimate.items
        })
      })

      if (response.ok) {
        const updated = await response.json()
        const recalc = recalculateEstimate(updated)
        setEstimates(prev => prev.map(e => e.id === recalc.id ? recalc : e))
        setActiveEstimate(recalc)
        setHasUnsavedChanges(false)
      }
    } catch (error) {
      console.error('Error saving estimate:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const exportToExcel = () => {
    if (!activeEstimate) {
      console.log('No active estimate')
      return
    }

    console.log('Starting Excel export...')

    // Импортируем XLSX динамически
    import('xlsx').then((XLSX) => {
      console.log('XLSX library loaded successfully')
      // Создаем новую рабочую книгу
      const workbook = XLSX.utils.book_new()

      // Подготавливаем данные для таблицы
      const tableData = [
        // Заголовки
        ['№', 'Наименование', 'Количество', 'Единица измерения', 'Цена', 'Себестоимость', 'Сумма', 'Комментарий'],
        // Позиции сметы
        ...activeEstimate.items.map((item, index) => [
          index + 1,
          item.name,
          item.quantity,
          item.unit,
          item.unitPrice,
          item.costPrice,
          item.quantity * item.unitPrice,
          item.notes || ''
        ]),
        // Пустая строка
        [],
        // Итоговые расчеты
        ['', '', '', '', '', '', 'Себестоимость:', activeEstimate.totalCost],
        ['', '', '', '', '', '', 'Прибыль:', activeEstimate.profit],
        ['', '', '', '', '', '', 'Сумма без НДС:', activeEstimate.total],
        ...(activeEstimate.vatEnabled ? [
          ['', '', '', '', '', '', `НДС (${activeEstimate.vatRate}%):`, activeEstimate.vatAmount],
          ['', '', '', '', '', '', 'ИТОГО:', activeEstimate.totalWithVat]
        ] : [
          ['', '', '', '', '', '', 'ИТОГО:', activeEstimate.total]
        ])
      ]

      // Создаем лист с данными
      const worksheet = XLSX.utils.aoa_to_sheet(tableData)

      // Настраиваем ширину колонок
      const colWidths = [
        { wch: 5 },   // №
        { wch: 30 },  // Наименование
        { wch: 12 },  // Количество
        { wch: 15 },  // Единица измерения
        { wch: 15 },  // Цена
        { wch: 15 },  // Себестоимость
        { wch: 15 },  // Сумма
        { wch: 40 }   // Комментарий
      ]
      worksheet['!cols'] = colWidths

      // Стилизация заголовков
      const headerRange = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:H1')
      for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col })
        if (!worksheet[cellAddress]) continue
        
        worksheet[cellAddress].s = {
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '4472C4' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'thin', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } }
          }
        }
      }

      // Стилизация итоговых строк
      const totalStartRow = activeEstimate.items.length + 2
      for (let row = totalStartRow; row < tableData.length; row++) {
        for (let col = 0; col < 8; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
          if (!worksheet[cellAddress]) continue
          
          worksheet[cellAddress].s = {
            font: { bold: row === tableData.length - 1 }, // Последняя строка (ИТОГО) жирным
            fill: row === tableData.length - 1 ? { fgColor: { rgb: 'E2EFDA' } } : undefined,
            border: {
              top: { style: 'thin', color: { rgb: '000000' } },
              bottom: { style: 'thin', color: { rgb: '000000' } },
              left: { style: 'thin', color: { rgb: '000000' } },
              right: { style: 'thin', color: { rgb: '000000' } }
            }
          }
        }
      }

      // Добавляем лист в книгу
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Смета')

      // Создаем и скачиваем файл
      const fileName = `Смета_${activeEstimate.name}_${new Date().toLocaleDateString('ru-RU').replace(/\./g, '-')}.xlsx`
      console.log('Creating file:', fileName)
      XLSX.writeFile(workbook, fileName)
      console.log('File created successfully')
    }).catch((error) => {
      console.error('Ошибка при экспорте в Excel:', error)
    })
  }

  const openDocumentWizard = (type: 'COMMERCIAL_OFFER' | 'INVOICE') => {
    if (!activeEstimate) {
      toast.error('Выберите смету')
      return
    }
    setShowExportModal(false)
    router.push(
      `/documents/new?type=${type}&projectId=${projectId}&estimateId=${activeEstimate.id}`
    )
  }

  const filteredEstimates = estimates.filter(estimate => 
    estimate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    estimate.description.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => {
    const aValue = a[sortBy]
    const bValue = b[sortBy]
    
    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1
    } else {
      return aValue < bValue ? 1 : -1
    }
  })

  const categories = ['Материалы', 'Работы', 'Оборудование', 'Услуги', 'Прочее']
  const units = ['шт', 'м²', 'м³', 'кг', 'т', 'час', 'день', 'м', 'п.м.', 'л', 'мл', 'кв.м', 'куб.м', 'км', 'см', 'мм', 'г', 'мг', 'кВт', 'кВт⋅ч', 'руб', 'у.е.', 'компл', 'набор', 'партия', 'лист', 'лист.', 'стр.', 'стр', 'экз.', 'экз', 'ед.', 'ед', 'поз.', 'поз', 'усл.', 'усл', 'раз', 'мес.', 'мес', 'год', 'нед.', 'нед', 'квартал', 'полугодие']

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <div className="text-sm text-gray-500 mt-2">Загрузка смет...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Кастомная навигация для сметы */}
      {isNavCollapsed && !isHoveringNav && (
        <div className="fixed top-0 left-0 z-40">
          <button
            onClick={() => setIsNavCollapsed(!isNavCollapsed)}
            className="p-3 bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            title={isNavCollapsed ? 'Развернуть навигацию' : 'Свернуть навигацию'}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      )}
      
      {/* Развернутая навигация */}
      {(!isNavCollapsed || isHoveringNav) && (
        <div 
          className="fixed top-0 left-0 z-30 w-64 h-full bg-white shadow-lg transform transition-transform duration-300"
          onMouseEnter={() => setIsHoveringNav(true)}
          onMouseLeave={() => setIsHoveringNav(false)}
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Навигация</h2>
              <button
                onClick={() => setIsNavCollapsed(true)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <nav className="space-y-2">
              <Link href="/" className="flex items-center gap-3 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                <Home className="h-4 w-4" />
                Главная
              </Link>
              <Link href="/projects" className="flex items-center gap-3 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                <FolderOpen className="h-4 w-4" />
                Проекты
              </Link>
              <Link href="/tasks" className="flex items-center gap-3 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                <Flag className="h-4 w-4" />
                Задачи
              </Link>
              <Link href="/documents" className="flex items-center gap-3 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                <FileText className="h-4 w-4" />
                Документы
              </Link>
              <Link href="/finance" className="flex items-center gap-3 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                <DollarSign className="h-4 w-4" />
                Финансы
              </Link>
              <Link href="/approvals" className="flex items-center gap-3 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                <CheckCircle className="h-4 w-4" />
                Согласования
              </Link>
              <Link href="/chat" className="flex items-center gap-3 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                <MessageSquare className="h-4 w-4" />
                Чат
              </Link>
              <Link href="/reports" className="flex items-center gap-3 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                <BarChart3 className="h-4 w-4" />
                Отчеты
              </Link>
              <Link href="/users" className="flex items-center gap-3 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                <Users className="h-4 w-4" />
                Пользователи
              </Link>
              <Link href="/settings" className="flex items-center gap-3 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                <Settings className="h-4 w-4" />
                Настройки
              </Link>
            </nav>
          </div>
        </div>
      )}
      
      {/* Невидимая зона для наведения мыши слева */}
      {isNavCollapsed && (
        <div 
          className="fixed top-0 left-0 z-20 w-8 h-full"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        />
      )}
      
      <div 
        className="min-h-screen bg-gray-50" 
        style={{ marginLeft: isNavCollapsed ? '0' : '0' }}
      >
        <div className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-12 py-10">
          {/* Заголовок */}
          <div className="mb-10">
            <div className="flex items-center gap-4 mb-4">
              <Link 
                href={`/projects/${projectId}`}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Назад к проекту
              </Link>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-2">Сметы проекта</h1>
                <p className="text-lg text-gray-600">
                  {project?.name} • Бюджет: {project?.budget ? formatCurrency(project.budget) : 'Не установлен'}
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                <PermissionButton
                  permission="canCreateEstimates"
                  onClick={() => setShowTemplatesModal(true)}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Zap className="h-4 w-4" />
                  Шаблоны
                </PermissionButton>
                
                <PermissionButton
                  permission="canCreateEstimates"
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Создать смету
                </PermissionButton>
              </div>
            </div>
          </div>

          {/* Панель инструментов */}
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Поиск смет..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSortBy('name')}
                    className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm ${
                      sortBy === 'name' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Название
                    {sortBy === 'name' && (sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />)}
                  </button>
                  
                  <button
                    onClick={() => setSortBy('total')}
                    className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm ${
                      sortBy === 'total' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Сумма
                    {sortBy === 'total' && (sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />)}
                  </button>
                  
                  <button
                    onClick={() => setSortBy('createdAt')}
                    className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm ${
                      sortBy === 'createdAt' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Дата
                    {sortBy === 'createdAt' && (sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />)}
                  </button>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  title="Изменить порядок сортировки"
                >
                  {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                </button>
                
                <button
                  onClick={() => setShowCategories(!showCategories)}
                  className={`p-2 rounded-lg ${showCategories ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                  title="Показать/скрыть категории"
                >
                  {showCategories ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Основной контент */}
          <div className="space-y-6">
            {/* Табы со сметами */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="border-b border-gray-200">
                <nav className="flex space-x-8 px-6 overflow-x-auto" aria-label="Tabs">
                  {filteredEstimates.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-gray-500">
                      <Calculator className="h-6 w-6 mr-2" />
                      <span>Сметы не найдены</span>
                    </div>
                  ) : (
                    filteredEstimates.map((estimate) => (
                      <button
                        key={estimate.id}
                        onClick={() => setActiveEstimate(recalculateEstimate(estimate))}
                        className={`py-4 px-3 border-b-2 font-medium text-sm transition-all duration-200 whitespace-nowrap ${
                          activeEstimate?.id === estimate.id
                            ? 'border-blue-500 text-blue-600 bg-blue-50'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="truncate max-w-40 font-medium">{estimate.name}</span>
                          <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full font-medium">
                            {estimate.items.length}
                          </span>
                          <span className="text-xs font-bold text-green-600">
                            {formatCurrency(estimate.totalWithVat || estimate.total)}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                  
                  {/* Кнопка добавления новой сметы */}
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="py-4 px-3 border-b-2 border-transparent text-gray-400 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 rounded-t-lg"
                    title="Создать новую смету"
                  >
                    <div className="flex items-center gap-2">
                      <Plus className="h-5 w-5" />
                      <span className="font-medium">Новая смета</span>
                    </div>
                  </button>
                </nav>
              </div>
            </div>

            {/* Редактор сметы */}
            <div className="bg-white rounded-xl shadow-sm border min-h-[600px]">
              {activeEstimate ? (
                <>

                  {/* Заголовок сметы */}
                  <div className="p-8 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">{activeEstimate.name}</h2>
                        {activeEstimate.description && (
                          <p className="text-base text-gray-600">{activeEstimate.description}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Таблица позиций */}
                  <div className="overflow-x-auto" ref={tableRef}>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gradient-to-r from-gray-100 to-gray-50 border-b-2 border-gray-300">
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider w-16 border-r border-gray-200">
                            №
                          </th>
                          {showCategories && (
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider w-48 border-r border-gray-200">
                              Категория
                            </th>
                          )}
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[250px] border-r border-gray-200">
                            Наименование
                          </th>
                          <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider w-40 border-r border-gray-200">
                            Кол-во
                          </th>
                          <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider w-48 border-r border-gray-200">
                            Ед. изм.
                          </th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider w-56 border-r border-gray-200">
                            Цена
                          </th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider w-56 border-r border-gray-200">
                            Себест.
                          </th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider w-56 border-r border-gray-200">
                            Сумма
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[200px] border-r border-gray-200">
                            Комментарий
                          </th>
                          <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider w-24">
                            Действия
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeEstimate.items.map((item, index) => (
                          <tr 
                            key={item.id} 
                            className={`
                              border-b border-gray-200 transition-all duration-150
                              ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                              ${item.isNew ? 'bg-blue-50 border-blue-200' : ''}
                              hover:bg-blue-50/50 hover:shadow-sm
                            `}
                          >
                            <td className="px-4 py-4 text-center text-sm font-semibold text-gray-600 border-r border-gray-200">
                              {index + 1}
                            </td>
                            {showCategories && (
                              <td className="px-4 py-4 border-r border-gray-200">
                                <select
                                  value={item.category}
                                  onChange={(e) => updateItem(item.id, 'category', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm bg-white"
                                >
                                  {categories.map(category => (
                                    <option key={category} value={category}>{category}</option>
                                  ))}
                                </select>
                              </td>
                            )}
                            <td className="px-4 py-4 border-r border-gray-200">
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm bg-white"
                                placeholder="Наименование позиции"
                              />
                            </td>
                            <td className="px-4 py-4 text-center border-r border-gray-200">
                              <input
                                type="text"
                                value={item.quantity > 0 ? formatNumber(item.quantity) : ''}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/\s/g, '').replace(',', '.')
                                  updateItem(item.id, 'quantity', Number(value) || 0)
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-right text-sm bg-white font-medium"
                                placeholder="0"
                              />
                            </td>
                            <td className="px-4 py-4 text-center border-r border-gray-200">
                              <div className="relative">
                                <input
                                  type="text"
                                  list={`units-${item.id}`}
                                  value={item.unit || ''}
                                  onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                                  className="w-full px-3 py-2 border-2 border-blue-400 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm font-bold text-center bg-blue-100 text-gray-900"
                                  placeholder="шт"
                                />
                                <datalist id={`units-${item.id}`}>
                                  {units.map(unit => (
                                    <option key={unit} value={unit} />
                                  ))}
                                </datalist>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-right border-r border-gray-200">
                              <input
                                type="text"
                                value={item.unitPrice > 0 ? formatNumber(item.unitPrice) : ''}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/\s/g, '').replace(',', '.')
                                  updateItem(item.id, 'unitPrice', Number(value) || 0)
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-right text-sm font-semibold bg-white whitespace-nowrap"
                                placeholder="0.00"
                              />
                            </td>
                            <td className="px-4 py-4 text-right border-r border-gray-200">
                              <input
                                type="text"
                                value={item.costPrice > 0 ? formatNumber(item.costPrice) : ''}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/\s/g, '').replace(',', '.')
                                  updateItem(item.id, 'costPrice', Number(value) || 0)
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-right text-sm font-semibold bg-white whitespace-nowrap"
                                placeholder="0.00"
                              />
                            </td>
                            <td className="px-4 py-4 text-right border-r border-gray-200">
                              <div className="text-sm font-bold text-gray-900 bg-gray-100 px-3 py-2 rounded-md text-right whitespace-nowrap">
                                {formatCurrency(item.total)}
                              </div>
                            </td>
                            <td className="px-4 py-4 border-r border-gray-200">
                              <div className="relative group">
                                <button
                                  onClick={() => {
                                    const notes = prompt('Комментарий к позиции:', item.notes || '')
                                    if (notes !== null) {
                                      updateItem(item.id, 'notes', notes)
                                    }
                                  }}
                                  className={`w-full px-3 py-2 border border-gray-300 rounded-md hover:border-blue-400 transition-colors text-left text-xs ${
                                    item.notes ? 'bg-blue-50 border-blue-300' : 'bg-white'
                                  }`}
                                  title={item.notes || 'Добавить комментарий'}
                                >
                                  {item.notes ? (
                                    <div className="flex items-center gap-1.5">
                                      <MessageSquare className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                                      <span className="truncate text-gray-700">{item.notes}</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 text-gray-400">
                                      <MessageSquare className="h-3.5 w-3.5" />
                                      <span>Добавить</span>
                                    </div>
                                  )}
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => duplicateItem(item.id)}
                                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                  title="Дублировать"
                                >
                                  <Copy className="h-4 w-4" />
                                </button>
                                
                                <button
                                  onClick={() => deleteItem(item.id)}
                                  className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                  title="Удалить"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Кнопка добавления позиции */}
                  <div className="p-8 border-t border-gray-200 bg-gray-50">
                    <button
                      onClick={addNewItem}
                      className="w-full flex items-center justify-center gap-3 py-5 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200 text-base font-medium"
                    >
                      <Plus className="h-6 w-6" />
                      <span>Добавить позицию</span>
                    </button>
                  </div>

                  {/* Панель НДС и расчеты */}
                  <div className="p-8 bg-gray-50 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <label className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={activeEstimate.vatEnabled}
                            onChange={toggleVat}
                            className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-base font-medium text-gray-700">Включить НДС</span>
                        </label>
                        
                        {activeEstimate.vatEnabled && (
                          <div className="flex items-center gap-3">
                            <span className="text-base text-gray-600">Ставка НДС:</span>
                            <select
                              value={activeEstimate.vatRate}
                              onChange={(e) => updateVatRate(Number(e.target.value))}
                              className="px-4 py-2 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[280px]"
                            >
                              {VAT_RATES_RU.map(({ value, label }) => (
                                <option key={value} value={value}>{label}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-8">
                        {/* Расчеты сметы */}
                        <div className="text-right space-y-2">
                          <div className="flex items-center gap-6">
                            <span className="text-base text-gray-600">Себестоимость:</span>
                            <span className="text-base font-semibold">{formatCurrency(activeEstimate.totalCost)}</span>
                          </div>
                          <div className="flex items-center gap-6">
                            <span className="text-base text-gray-600">Прибыль:</span>
                            <span className={`text-base font-semibold ${activeEstimate.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(activeEstimate.profit)}
                            </span>
                          </div>
                          <div className="flex items-center gap-6">
                            <span className="text-base text-gray-600">Сумма без НДС:</span>
                            <span className="text-base font-semibold">{formatCurrency(activeEstimate.total)}</span>
                          </div>
                          {activeEstimate.vatEnabled && (
                            <div className="flex items-center gap-6">
                              <span className="text-base text-gray-600">НДС ({activeEstimate.vatRate}%):</span>
                              <span className="text-base font-semibold text-orange-600">{formatCurrency(activeEstimate.vatAmount)}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-6 border-t border-gray-300 pt-2 mt-2">
                            <span className="text-lg font-bold text-gray-800">Итого:</span>
                            <span className="text-2xl font-bold text-green-600">
                              {formatCurrency(activeEstimate.vatEnabled ? activeEstimate.totalWithVat : activeEstimate.total)}
                            </span>
                          </div>
                        </div>
                        
                        {/* Кнопки действий */}
                        <div className="flex gap-3">
                          <button
                            onClick={saveEstimate}
                            disabled={!hasUnsavedChanges || isSaving}
                            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors text-base ${
                              hasUnsavedChanges 
                                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            <Save className="h-5 w-5" />
                            {isSaving ? 'Сохранение...' : 'Сохранить'}
                          </button>
                          
                          <button
                            onClick={exportToExcel}
                            className="p-3 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Экспорт в Excel"
                          >
                            <FileText className="h-5 w-5" />
                          </button>
                          
                          {activeEstimate && (
                            <CreateDocumentMenu
                              projectId={projectId}
                              estimateId={activeEstimate.id}
                              buttonLabel="Документ"
                              className="inline-flex"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-96">
                  <div className="text-center">
                    <Calculator className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Выберите смету</h3>
                    <p className="text-gray-600 mb-6">Выберите смету из вкладок выше или создайте новую</p>
                    <PermissionButton
                      permission="canCreateEstimates"
                      onClick={() => setShowCreateModal(true)}
                      className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="h-5 w-5" />
                      Создать смету
                    </PermissionButton>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Модальное окно создания сметы */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold mb-4">Создать смету</h3>
              
              <form onSubmit={handleCreateEstimate}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Название сметы
                    </label>
                    <input
                      type="text"
                      value={estimateForm.name}
                      onChange={(e) => setEstimateForm({ ...estimateForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Например: Смета на ремонт офиса"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Описание
                    </label>
                    <textarea
                      value={estimateForm.description}
                      onChange={(e) => setEstimateForm({ ...estimateForm, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows={3}
                      placeholder="Дополнительная информация о смете"
                    />
                  </div>
                </div>
                
                <div className="flex gap-3 mt-6">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Создать
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false)
                      setEstimateForm({ name: '', description: '' })
                    }}
                    className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Модальное окно шаблонов */}
        {showTemplatesModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4">
              <h3 className="text-lg font-semibold mb-4">Шаблоны смет</h3>
              <p className="text-gray-600 mb-6">Выберите готовый шаблон для быстрого создания сметы</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((template) => (
                  <div key={template.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                    <h4 className="font-medium text-gray-900 mb-2">{template.name}</h4>
                    <p className="text-sm text-gray-600 mb-3">{template.items.length} позиций</p>
                    
                    <div className="space-y-1 mb-4">
                      {template.items.slice(0, 3).map((item, index) => (
                        <div key={index} className="text-xs text-gray-500">
                          • {item.name}
                        </div>
                      ))}
                      {template.items.length > 3 && (
                        <div className="text-xs text-gray-400">
                          ... и еще {template.items.length - 3} позиций
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={() => applyTemplate(template)}
                      className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Применить шаблон
                    </button>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowTemplatesModal(false)}
                  className="bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Модальное окно экспорта */}
        {showExportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold mb-4">Экспорт сметы</h3>
              <p className="text-gray-600 mb-6">Выберите формат для экспорта сметы</p>
              
              <div className="space-y-4">
                <button
                  onClick={exportToExcel}
                  className="w-full flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50 transition-colors"
                >
                  <FileText className="h-5 w-5 text-green-600" />
                  <div className="text-left">
                    <div className="font-medium text-gray-900">Excel таблица</div>
                    <div className="text-sm text-gray-600">Для дальнейшего редактирования</div>
                  </div>
                </button>
                
                <button
                  onClick={() => openDocumentWizard('COMMERCIAL_OFFER')}
                  disabled={!activeEstimate}
                  className="w-full flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors disabled:opacity-50"
                >
                  <Calculator className="h-5 w-5 text-purple-600" />
                  <div className="text-left">
                    <div className="font-medium text-gray-900">Коммерческое предложение</div>
                    <div className="text-sm text-gray-600">Черновик в редакторе</div>
                  </div>
                </button>

                <button
                  onClick={() => openDocumentWizard('INVOICE')}
                  disabled={!activeEstimate}
                  className="w-full flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-amber-300 hover:bg-amber-50 transition-colors disabled:opacity-50"
                >
                  <FileText className="h-5 w-5 text-amber-600" />
                  <div className="text-left">
                    <div className="font-medium text-gray-900">Счёт на оплату</div>
                    <div className="text-sm text-gray-600">УПД создаётся из счёта</div>
                  </div>
                </button>
              </div>
              
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

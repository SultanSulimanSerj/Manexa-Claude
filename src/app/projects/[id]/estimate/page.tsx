'use client'


import { toast } from '@/components/ui/use-toast'
import { Tooltip } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Layout from '@/components/layout'
import PageHeader from '@/components/page-header'
import { SkeletonList } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
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
      return
    }


    // Импортируем XLSX динамически
    import('xlsx').then((XLSX) => {
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
      XLSX.writeFile(workbook, fileName)
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
      <Layout>
        <div className="space-y-6">
          <PageHeader title="Сметы проекта" description="Загрузка..." />
          <SkeletonList rows={6} />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          title="Сметы проекта"
          description={project ? `${project.name} · Бюджет: ${project.budget ? formatCurrency(project.budget) : 'не установлен'}` : undefined}
          back={`/projects/${projectId}`}
          breadcrumbs={[
            { label: 'Проекты', href: '/projects' },
            ...(project ? [{ label: project.name, href: `/projects/${projectId}` }] : []),
            { label: 'Сметы' },
          ]}
          actions={
            <>
              <PermissionButton
                permission="canCreateEstimates"
                onClick={() => setShowTemplatesModal(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-input px-4 py-2 text-sm font-medium shadow-xs hover:bg-accent transition-colors"
              >
                <Zap className="h-4 w-4" />
                Шаблоны
              </PermissionButton>
              <PermissionButton
                permission="canCreateEstimates"
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium shadow-xs hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Создать смету
              </PermissionButton>
            </>
          }
        />

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
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring/55 focus:border-ring"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSortBy('name')}
                    className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm ${
                      sortBy === 'name' ? 'bg-neutral-100 text-neutral-900' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Название
                    {sortBy === 'name' && (sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />)}
                  </button>
                  
                  <button
                    onClick={() => setSortBy('total')}
                    className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm ${
                      sortBy === 'total' ? 'bg-neutral-100 text-neutral-900' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Сумма
                    {sortBy === 'total' && (sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />)}
                  </button>
                  
                  <button
                    onClick={() => setSortBy('createdAt')}
                    className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm ${
                      sortBy === 'createdAt' ? 'bg-neutral-100 text-neutral-900' : 'text-gray-600 hover:bg-gray-100'
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
                  className={`p-2 rounded-lg ${showCategories ? 'bg-neutral-100 text-neutral-900' : 'text-gray-600 hover:bg-gray-100'}`}
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
                            ? 'border-primary text-primary bg-neutral-50'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="truncate max-w-40 font-medium">{estimate.name}</span>
                          <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full font-medium">
                            {estimate.items.length}
                          </span>
                          <span className="text-xs font-semibold text-neutral-700">
                            {formatCurrency(estimate.totalWithVat || estimate.total)}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                  
                  {/* Кнопка добавления новой сметы */}
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="py-4 px-3 border-b-2 border-transparent text-gray-400 hover:text-primary hover:border-neutral-300 hover:bg-neutral-50 transition-all duration-200 rounded-t-lg"
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
                  <div className="p-6 border-b border-gray-200 bg-white">
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
                        <tr className="sticky top-0 z-10 bg-neutral-50 border-b border-gray-200">
                          <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 w-16">
                            №
                          </th>
                          {showCategories && (
                            <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 w-48">
                              Категория
                            </th>
                          )}
                          <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 min-w-[250px]">
                            Наименование
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 w-40">
                            Кол-во
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 w-48">
                            Ед. изм.
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500 w-56">
                            Цена
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500 w-56">
                            Себест.
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500 w-56">
                            Сумма
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 min-w-[200px]">
                            Комментарий
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 w-24">
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
                              ${item.isNew ? 'bg-neutral-50' : ''}
                              hover:bg-neutral-50
                            `}
                          >
                            <td className="px-4 py-4 text-center text-sm font-semibold text-gray-600">
                              {index + 1}
                            </td>
                            {showCategories && (
                              <td className="px-4 py-4">
                                <select
                                  value={item.category}
                                  onChange={(e) => updateItem(item.id, 'category', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-ring/55 focus:border-ring transition-colors text-sm bg-white"
                                >
                                  {categories.map(category => (
                                    <option key={category} value={category}>{category}</option>
                                  ))}
                                </select>
                              </td>
                            )}
                            <td className="px-4 py-4 w-[280px] max-w-[280px]">
                              <Tooltip content={item.name || undefined} className="block w-full min-w-0">
                                <input
                                  type="text"
                                  value={item.name}
                                  onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                                  className="w-full min-w-0 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-ring/55 focus:border-ring transition-colors text-sm bg-white"
                                  placeholder="Наименование позиции"
                                />
                              </Tooltip>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <input
                                type="text"
                                value={item.quantity > 0 ? formatNumber(item.quantity) : ''}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/\s/g, '').replace(',', '.')
                                  updateItem(item.id, 'quantity', Number(value) || 0)
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-ring/55 focus:border-ring transition-colors text-right text-sm bg-white font-medium"
                                placeholder="0"
                              />
                            </td>
                            <td className="px-4 py-4 text-center">
                              <div className="relative">
                                <input
                                  type="text"
                                  list={`units-${item.id}`}
                                  value={item.unit || ''}
                                  onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-ring/55 focus:border-ring transition-colors text-sm font-medium text-center bg-white text-gray-900"
                                  placeholder="шт"
                                />
                                <datalist id={`units-${item.id}`}>
                                  {units.map(unit => (
                                    <option key={unit} value={unit} />
                                  ))}
                                </datalist>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <input
                                type="text"
                                value={item.unitPrice > 0 ? formatNumber(item.unitPrice) : ''}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/\s/g, '').replace(',', '.')
                                  updateItem(item.id, 'unitPrice', Number(value) || 0)
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-ring/55 focus:border-ring transition-colors text-right text-sm font-semibold bg-white whitespace-nowrap"
                                placeholder="0.00"
                              />
                            </td>
                            <td className="px-4 py-4 text-right">
                              <input
                                type="text"
                                value={item.costPrice > 0 ? formatNumber(item.costPrice) : ''}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/\s/g, '').replace(',', '.')
                                  updateItem(item.id, 'costPrice', Number(value) || 0)
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-ring/55 focus:border-ring transition-colors text-right text-sm font-semibold bg-white whitespace-nowrap"
                                placeholder="0.00"
                              />
                            </td>
                            <td className="px-4 py-4 text-right">
                              <div className="text-sm font-bold text-gray-900 bg-gray-100 px-3 py-2 rounded-md text-right whitespace-nowrap">
                                {formatCurrency(item.total)}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="relative group">
                                <button
                                  onClick={() => {
                                    const notes = prompt('Комментарий к позиции:', item.notes || '')
                                    if (notes !== null) {
                                      updateItem(item.id, 'notes', notes)
                                    }
                                  }}
                                  className={`w-full px-3 py-2 border border-gray-300 rounded-md hover:border-neutral-300 transition-colors text-left text-xs ${
                                    item.notes ? "bg-neutral-100 border-neutral-300" : "bg-white"
                                  }`}
                                  title={item.notes || 'Добавить комментарий'}
                                >
                                  {item.notes ? (
                                    <div className="flex items-center gap-1.5">
                                      <MessageSquare className="h-3.5 w-3.5 text-neutral-900 flex-shrink-0" />
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
                                  className="p-2 text-gray-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
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
                  <div className="p-5 border-t border-gray-200 bg-white">
                    <button
                      onClick={addNewItem}
                      className="w-full flex items-center justify-center gap-3 py-5 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-neutral-300 hover:text-primary hover:bg-neutral-50 transition-all duration-200 text-base font-medium"
                    >
                      <Plus className="h-6 w-6" />
                      <span>Добавить позицию</span>
                    </button>
                  </div>

                  {/* Панель НДС и расчеты */}
                  <div className="sticky bottom-0 z-10 p-5 bg-white border-t border-gray-200 shadow-[0_-2px_8px_-4px_rgba(16,16,20,0.08)]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <label className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={activeEstimate.vatEnabled}
                            onChange={toggleVat}
                            className="w-5 h-5 text-neutral-900 border-gray-300 rounded focus:ring-ring/55"
                          />
                          <span className="text-base font-medium text-gray-700">Включить НДС</span>
                        </label>
                        
                        {activeEstimate.vatEnabled && (
                          <div className="flex items-center gap-3">
                            <span className="text-base text-gray-600">Ставка НДС:</span>
                            <select
                              value={activeEstimate.vatRate}
                              onChange={(e) => updateVatRate(Number(e.target.value))}
                              className="px-4 py-2 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-ring/55 focus:border-ring min-w-[280px]"
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
                              <span className="text-base font-semibold text-neutral-700">{formatCurrency(activeEstimate.vatAmount)}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-6 border-t border-gray-300 pt-2 mt-2">
                            <span className="text-lg font-bold text-gray-800">Итого:</span>
                            <span className="text-2xl font-bold text-neutral-900">
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
                                ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            <Save className="h-5 w-5" />
                            {isSaving ? 'Сохранение...' : 'Сохранить'}
                          </button>
                          
                          <button
                            onClick={exportToExcel}
                            className="p-3 text-gray-600 hover:text-primary hover:bg-neutral-100 rounded-lg transition-colors"
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
                <div className="p-6">
                  <EmptyState
                    icon={Calculator}
                    title="Выберите смету"
                    description="Выберите смету из вкладок выше или создайте новую."
                    action={
                      <PermissionButton
                        permission="canCreateEstimates"
                        onClick={() => setShowCreateModal(true)}
                        className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                        Создать смету
                      </PermissionButton>
                    }
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Модальное окно создания сметы */}
        <Dialog open={showCreateModal} onOpenChange={(o) => !o && setShowCreateModal(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Создать смету</DialogTitle>
            </DialogHeader>

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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring/55 focus:border-ring"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring/55 focus:border-ring"
                      rows={3}
                      placeholder="Дополнительная информация о смете"
                    />
                  </div>
                </div>
                
                <div className="flex gap-3 mt-6">
                  <button
                    type="submit"
                    className="flex-1 bg-primary text-primary-foreground py-2 px-4 rounded-lg hover:bg-primary/90 transition-colors"
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
          </DialogContent>
        </Dialog>

        {/* Модальное окно шаблонов */}
        <Dialog open={showTemplatesModal} onOpenChange={(o) => !o && setShowTemplatesModal(false)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Шаблоны смет</DialogTitle>
              <DialogDescription>Выберите готовый шаблон для быстрого создания сметы</DialogDescription>
            </DialogHeader>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((template) => (
                  <div key={template.id} className="border border-gray-200 rounded-lg p-4 hover:border-neutral-300 transition-colors">
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
                      className="w-full bg-primary text-primary-foreground py-2 px-4 rounded-lg hover:bg-primary/90 transition-colors"
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
          </DialogContent>
        </Dialog>

        {/* Модальное окно экспорта */}
        <Dialog open={showExportModal} onOpenChange={(o) => !o && setShowExportModal(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Экспорт сметы</DialogTitle>
              <DialogDescription>Выберите формат для экспорта сметы</DialogDescription>
            </DialogHeader>

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
          </DialogContent>
        </Dialog>
    </Layout>
  )
}

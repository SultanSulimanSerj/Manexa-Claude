'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { PageSuspense } from '@/components/page-suspense'
import Layout from '@/components/layout'
import PageHeader from '@/components/page-header'
import { SkeletonList } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { Plus, TrendingUp, TrendingDown, X, Trash2, ArrowLeft, DollarSign, Percent, Download, Settings, Building2, ChevronRight, FileText, Clock } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { confirm } from '@/components/ui/confirm'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { KpiCard } from '@/components/finance/KpiCard'
import { ExpenseStructureChart } from '@/components/finance/ExpenseStructureChart'
import { BudgetProgressBar } from '@/components/finance/BudgetProgressBar'
import { BudgetCategoriesWithOperations } from '@/components/finance/BudgetCategoriesWithOperations'
import { ErrorBanner } from '@/components/ui/error-banner'
import { usePermissions } from '@/components/permission-guard'

interface FinanceRecord {
  id: string
  type: string
  category: string
  amount: number
  date: string
  description: string | null
  project: { id: string; name: string } | null
  invoiceNumber?: string | null
  counterparty?: string | null
  isPaid?: boolean
  purchasedBy?: string | null
  receiptKeys?: string[]
  estimateItemId?: string | null
  estimateItem?: { id: string; name: string } | null
  dueDate?: string | null
}

const PROJECT_STATUS_LABELS: Record<string, string> = {
  PLANNING: 'Планирование',
  ACTIVE: 'Активный',
  ON_HOLD: 'Приостановлен',
  COMPLETED: 'Завершён',
  CANCELLED: 'Отменён'
}

function FinancePageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const projectIdFromUrl = searchParams?.get('projectId')
  const { hasPermission, loading: permsLoading } = usePermissions()

  const [records, setRecords] = useState<FinanceRecord[]>([])
  const [financeSummary, setFinanceSummary] = useState<{
    income: number
    expenses: number
    expensesByCategory?: Record<string, number>
  } | null>(null)
  const [projects, setProjects] = useState<any[]>([])
  const [currentProject, setCurrentProject] = useState<any>(null)
  const [projectSearch, setProjectSearch] = useState('')
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month')
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showBudgetModal, setShowBudgetModal] = useState(false)
  const [budgetFormData, setBudgetFormData] = useState('')
  const [budgetData, setBudgetData] = useState({
    budget: 0,
    estimateTotal: 0,
    spent: 0,
    received: 0
  })
  const [expenseStructure, setExpenseStructure] = useState<Array<{category: string, amount: number}>>([])
  const [categoriesData, setCategoriesData] = useState<Array<{id: string, category: string, plan: number, fact: number, percentage: number}>>([])
  const [invoicesData, setInvoicesData] = useState<Array<{
    id: string
    number: string
    type: 'invoice' | 'payment'
    amount: number
    dueDate: string | null
    date?: string
    isPaid: boolean
    paidAt: string | null
    paidBy: { id: string; name: string } | null
    status: 'paid' | 'pending' | 'overdue'
    description?: string
    category?: string
    counterparty?: string | null
  }>>([])
  const [formData, setFormData] = useState({
    type: 'INCOME',
    category: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    projectId: projectIdFromUrl || '',
    estimateItemId: '',
    invoiceNumber: '',
    dueDate: '',
    counterparty: '',
    purchasedBy: ''
  })
  const [receiptUploads, setReceiptUploads] = useState<Array<{ key: string; url: string; name: string }>>([])
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [estimateItems, setEstimateItems] = useState<Array<{id: string, name: string, category: string}>>([])
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    fetchRecords()
    fetchProjects()
    if (projectIdFromUrl) {
      fetchCurrentProject()
      fetchEstimateItems(projectIdFromUrl)
      fetchCategoriesData(projectIdFromUrl)
      fetchInvoicesData(projectIdFromUrl)
    } else {
      setCurrentProject(null)
      setCategoriesData([])
      setInvoicesData([])
    }
  }, [projectIdFromUrl])

  // Загружаем позиции сметы при изменении проекта
  useEffect(() => {
    if (formData.projectId && formData.type === 'EXPENSE') {
      fetchEstimateItems(formData.projectId)
    } else {
      setEstimateItems([])
    }
  }, [formData.projectId, formData.type])

  const fetchEstimateItems = async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/estimates`)
      if (response.ok) {
        const estimates = await response.json()
        const items: Array<{id: string, name: string, category: string}> = []
        estimates.forEach((est: any) => {
          est.items?.forEach((item: any) => {
            items.push({
              id: item.id,
              name: `${item.name} (${est.name})`,
              category: item.category || 'Материалы'
            })
          })
        })
        setEstimateItems(items)
      }
    } catch (err) {
      console.error('Error fetching estimate items:', err)
    }
  }

  // Уникальные категории из сметы проекта (для выбора при расходе)
  const estimateCategories = Array.from(new Set(estimateItems.map(i => i.category))).sort()

  // Для расхода при появлении категорий из сметы подставляем первую категорию, если категория пустая
  useEffect(() => {
    if (formData.type === 'EXPENSE' && formData.projectId && estimateCategories.length > 0 && !formData.category?.trim()) {
      setFormData(prev => ({ ...prev, category: estimateCategories[0] }))
    }
  }, [formData.type, formData.projectId, estimateCategories.join(','), formData.category])

  // Пересчитываем данные бюджета когда records или currentProject меняются
  useEffect(() => {
    fetchBudgetData()
  }, [records, currentProject, projectIdFromUrl, financeSummary])

  const fetchCurrentProject = async () => {
    if (!projectIdFromUrl) return
    try {
      const response = await fetch(`/api/projects/${projectIdFromUrl}`)
      if (response.ok) {
        const data = await response.json()
        setCurrentProject(data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const fetchRecords = async () => {
    try {
      setPageError(null)
      const params = new URLSearchParams({ limit: '5000' })
      if (projectIdFromUrl) params.set('projectId', projectIdFromUrl)
      const response = await fetch(`/api/finance?${params}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      if (response.ok) {
        const data = await response.json()
        setRecords(data.finances || [])
        setFinanceSummary(data.summary || null)
      } else {
        const data = await response.json().catch(() => ({}))
        setPageError(data.error || 'Не удалось загрузить финансовые данные')
      }
    } catch {
      setPageError('Ошибка при загрузке финансовых данных')
    } finally {
      setLoading(false)
    }
  }

  const fetchBudgetData = async () => {
    try {
      // Получаем данные о бюджете и смете
      let budget = 0
      let estimateTotal = 0
      
      if (projectIdFromUrl && currentProject) {
        budget = Number(currentProject.budget) || 0
        
        // Загружаем сумму сметы
        const estimateRes = await fetch(`/api/projects/${projectIdFromUrl}/estimates`)
        if (estimateRes.ok) {
          const estimates = await estimateRes.json()
          estimateTotal = estimates.reduce((sum: number, est: any) => 
            sum + Number(est.totalWithVat || est.total || 0), 0)
        }
      }

      // Считаем расходы и доходы из records
      const projectRecords = projectIdFromUrl
        ? records.filter(r => r.project?.id === projectIdFromUrl)
        : records

      const spent =
        projectIdFromUrl
          ? projectRecords
              .filter(r => r.type === 'EXPENSE')
              .reduce((sum, r) => sum + Number(r.amount), 0)
          : financeSummary?.expenses ?? projectRecords
              .filter(r => r.type === 'EXPENSE')
              .reduce((sum, r) => sum + Number(r.amount), 0)

      // «Получено» — только фактически оплаченные доходы (isPaid)
      const received =
        projectIdFromUrl
          ? projectRecords
              .filter(r => r.type === 'INCOME' && r.isPaid)
              .reduce((sum, r) => sum + Number(r.amount), 0)
          : financeSummary?.income ?? projectRecords
              .filter(r => r.type === 'INCOME' && r.isPaid)
              .reduce((sum, r) => sum + Number(r.amount), 0)

      setBudgetData({ budget, estimateTotal, spent, received })

      const expensesByCategory =
        !projectIdFromUrl && financeSummary?.expensesByCategory
          ? financeSummary.expensesByCategory
          : projectRecords
              .filter(r => r.type === 'EXPENSE')
              .reduce((acc: Record<string, number>, r) => {
                acc[r.category] = (acc[r.category] || 0) + Number(r.amount)
                return acc
              }, {})

      const structureData = Object.entries(expensesByCategory)
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount)

      setExpenseStructure(structureData)
    } catch (err) {
      console.error('Error fetching budget data:', err)
    }
  }

  const fetchCategoriesData = async (projectId?: string | null) => {
    try {
      const url = projectId ? `/api/finance/categories?projectId=${projectId}` : '/api/finance/categories'
      const response = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
      if (response.ok) {
        const data = await response.json()
        setCategoriesData(data)
      }
    } catch (err) {
      console.error('Error fetching categories data:', err)
    }
  }

  const fetchInvoicesData = async (projectId?: string | null) => {
    try {
      const url = projectId ? `/api/finance/invoices?projectId=${projectId}` : '/api/finance/invoices'
      const response = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
      if (response.ok) {
        const data = await response.json()
        setInvoicesData(data.invoices ?? data)
      }
    } catch (err) {
      console.error('Error fetching invoices data:', err)
    }
  }

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects?limit=200')
      if (response.ok) {
        const data = await response.json()
        setProjects(data.projects || [])
      }
    } catch (err) {
      console.error(err)
    }
  }

  const setSelectedProject = (id: string | null) => {
    if (id) router.push(`/finance?projectId=${id}`)
    else router.push('/finance')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setSubmitError(null)
    if (!formData.projectId?.trim()) {
      setSubmitError('Выберите проект')
      return
    }
    if (formData.type === 'EXPENSE' && !formData.category?.trim()) {
      setSubmitError('Укажите категорию')
      return
    }
    const amountNum = parseFloat(String(formData.amount).replace(',', '.'))
    if (isNaN(amountNum) || amountNum < 0) {
      setSubmitError('Введите корректную сумму')
      return
    }
    try {
      const response = await fetch(editingId ? `/api/finance/${editingId}` : '/api/finance', {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          amount: amountNum,
          projectId: formData.projectId.trim(),
          category: formData.category.trim() || (formData.type === 'INCOME' ? 'Оплата по счёту' : ''),
          estimateItemId: formData.estimateItemId || null,
          invoiceNumber: formData.invoiceNumber?.trim() || null,
          dueDate: formData.dueDate?.trim() || null,
          counterparty: formData.counterparty?.trim() || null,
          purchasedBy: formData.purchasedBy?.trim() || null,
          receiptKeys: receiptUploads.map(r => r.key)
        })
      })

      const data = response.ok ? null : await response.json().catch(() => ({}))
      const errorText = (data?.error as string) || (response.ok ? '' : 'Не удалось добавить запись')

      if (response.ok) {
        setShowModal(false)
        setSubmitError(null)
        setFormData({
          type: 'INCOME',
          category: '',
          amount: '',
          date: new Date().toISOString().split('T')[0],
          description: '',
          projectId: '',
          estimateItemId: '',
          invoiceNumber: '',
          dueDate: '',
          counterparty: '',
          purchasedBy: ''
        })
        setReceiptUploads([])
        setEditingId(null)
        fetchRecords()
        if (projectIdFromUrl) fetchInvoicesData(projectIdFromUrl)
        fetchCategoriesData(projectIdFromUrl || undefined)
      } else {
        setSubmitError(errorText)
        setMessage({ type: 'error', text: errorText })
      }
    } catch (err) {
      console.error(err)
      const errMsg = err instanceof Error ? err.message : 'Ошибка при добавлении записи'
      setSubmitError(errMsg)
      setMessage({ type: 'error', text: errMsg })
    }
  }

  const handleDeleteClick = async (id: string) => {
    const ok = await confirm({
      title: 'Удалить запись?',
      description: 'Действие необратимо.',
      confirmText: 'Удалить',
      destructive: true,
    })
    if (!ok) return
    setMessage(null)
    try {
      const response = await fetch(`/api/finance/${id}`, { method: 'DELETE' })
      if (response.ok) {
        // Убираем запись из стейта сразу — строка исчезает без ожидания рефетча
        setRecords(prev => prev.filter(r => r.id !== id))
        fetchRecords()
        setMessage({ type: 'success', text: 'Запись удалена' })
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ type: 'error', text: 'Не удалось удалить запись' })
      }
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: 'Ошибка при удалении' })
    }
  }

  // Action handlers for new components
  const handleExport = async () => {
    try {
      // Фильтруем записи
      const exportRecords = projectIdFromUrl 
        ? records.filter(r => r.project?.id === projectIdFromUrl)
        : records

      // Вызываем API для генерации Excel
      const response = await fetch('/api/finance/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: exportRecords,
          projectName: currentProject?.name || 'Все проекты'
        })
      })

      if (!response.ok) {
        throw new Error('Export failed')
      }

      // Скачиваем файл
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      
      // Получаем имя файла из заголовка
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = 'Финансы.xlsx'
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename\*=UTF-8''(.+)/)
        if (filenameMatch) {
          filename = decodeURIComponent(filenameMatch[1])
        }
      }
      
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export error:', err)
      setMessage({ type: 'error', text: 'Ошибка экспорта' })
    }
  }

  const handleBudgetSettings = () => {
    if (!projectIdFromUrl) {
      setMessage({ type: 'error', text: 'Выберите проект для настройки бюджета' })
      return
    }
    setBudgetFormData(String(currentProject?.budget || 0))
    setShowBudgetModal(true)
  }

  const handleSaveBudget = async () => {
    if (!projectIdFromUrl) return
    
    try {
      const response = await fetch(`/api/projects/${projectIdFromUrl}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget: parseFloat(budgetFormData) || 0 })
      })

      if (response.ok) {
        const updated = await response.json()
        setCurrentProject(updated)
        setShowBudgetModal(false)
        fetchBudgetData()
      } else {
        setMessage({ type: 'error', text: 'Ошибка сохранения бюджета' })
      }
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: 'Ошибка сохранения бюджета' })
    }
  }

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploadingReceipt(true)
    try {
      for (const file of files) {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/finance/receipts', { method: 'POST', body: fd })
        if (res.ok) {
          const data = await res.json()
          setReceiptUploads(prev => [...prev, { key: data.key, url: data.url, name: file.name }])
        } else {
          const d = await res.json().catch(() => ({}))
          toast.error(d.error || 'Не удалось загрузить чек')
        }
      }
    } finally {
      setUploadingReceipt(false)
      e.target.value = ''
    }
  }

  const handleAddOperation = () => {
    setSubmitError(null)
    setReceiptUploads([])
    setEditingId(null)
    setFormData(prev => ({ ...prev, type: 'EXPENSE', purchasedBy: '' }))
    setShowModal(true)
  }

  const handleEditOperation = (id: string) => {
    const r = records.find(x => x.id === id)
    if (!r) return
    setSubmitError(null)
    setEditingId(id)
    setFormData({
      type: r.type,
      category: r.category || '',
      amount: String(r.amount ?? ''),
      date: r.date ? new Date(r.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      description: r.description || '',
      projectId: r.project?.id || projectIdFromUrl || '',
      estimateItemId: r.estimateItemId || '',
      invoiceNumber: r.invoiceNumber || '',
      dueDate: r.dueDate ? new Date(r.dueDate).toISOString().split('T')[0] : '',
      counterparty: r.counterparty || '',
      purchasedBy: r.purchasedBy || '',
    })
    setReceiptUploads((r.receiptKeys || []).map((k, i) => ({ key: k, url: `/api/finance/receipts?key=${encodeURIComponent(k)}`, name: `Чек ${i + 1}` })))
    setShowModal(true)
  }

  const handleUpdateReceipts = async (id: string, keys: string[]) => {
    try {
      const res = await fetch(`/api/finance/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptKeys: keys }),
      })
      if (res.ok) fetchRecords()
      else toast.error('Не удалось обновить чеки')
    } catch {
      toast.error('Ошибка при обновлении чеков')
    }
  }

  const handleCreateInvoice = () => {
    setSubmitError(null)
    setEditingId(null)
    setFormData(prev => ({
      ...prev,
      type: 'INCOME',
      projectId: projectIdFromUrl || prev.projectId,
      amount: '',
      category: '',
      description: '',
      date: new Date().toISOString().split('T')[0]
    }))
    setShowModal(true)
  }

  const handleCreatePayment = () => {
    setSubmitError(null)
    setFormData(prev => ({
      ...prev,
      type: 'EXPENSE',
      projectId: projectIdFromUrl || prev.projectId,
      amount: '',
      category: '',
      description: '',
      date: new Date().toISOString().split('T')[0]
    }))
    setShowModal(true)
  }

  const handleMarkAsPaid = async (financeId: string, isPaid: boolean) => {
    try {
      const response = await fetch('/api/finance/invoices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ financeId, isPaid })
      })

      if (response.ok) {
        // Оптимистично обновляем список счетов
        setInvoicesData(prev => prev.map(item =>
          item.id === financeId
            ? { ...item, isPaid, status: (isPaid ? 'paid' : (item.dueDate && new Date(item.dueDate) < new Date() ? 'overdue' : 'pending')) as 'paid' | 'pending' | 'overdue' }
            : item
        ))
        // Обновляем записи в памяти, чтобы KPI (Получено / долги) пересчитались сразу
        setRecords(prev => prev.map(r => (r.id === financeId ? { ...r, isPaid } : r)))
        // Пересчитываем бюджет/«Получено» с сервера
        fetchBudgetData()
      }
    } catch (err) {
      console.error('Error marking invoice as paid:', err)
    }
  }

  const projectFilteredRecords = projectIdFromUrl 
    ? records.filter(r => r.project?.id === projectIdFromUrl)
    : records

  const operationsByCategory = useMemo(() => {
    const expenses = projectFilteredRecords.filter(r => r.type === 'EXPENSE')
    const map: Record<string, Array<{ id: string; date: string; amount: number; description?: string | null; counterparty?: string | null; invoiceNumber?: string | null }>> = {}
    for (const r of expenses) {
      const cat = r.category || 'Без категории'
      if (!map[cat]) map[cat] = []
      map[cat].push({
        id: r.id,
        date: r.date,
        amount: r.amount,
        description: r.description ?? undefined,
        counterparty: r.counterparty ?? undefined,
        invoiceNumber: r.invoiceNumber ?? undefined
      })
    }
    return map
  }, [projectFilteredRecords])

  const incomeListForBlock = useMemo(() =>
    invoicesData
      .filter((i: { type: string }) => i.type === 'invoice')
      .map((i) => ({
        id: i.id,
        number: i.number,
        amount: Number(i.amount) || 0,
        date: i.date || i.dueDate || '',
        dueDate: i.dueDate,
        isPaid: i.isPaid,
        status: i.status,
        description: i.description,
        counterparty: i.counterparty ?? undefined
      })),
    [invoicesData]
  )

  const expensesForBlock = useMemo(() =>
    projectFilteredRecords
      .filter(r => r.type === 'EXPENSE')
      .map(r => ({
        id: r.id,
        date: r.date,
        amount: Number(r.amount) || 0,
        category: r.category || 'Без категории',
        description: r.description ?? undefined,
        counterparty: r.counterparty ?? undefined,
        isPaid: !!r.isPaid,
        purchasedBy: r.purchasedBy ?? undefined,
        receiptKeys: r.receiptKeys ?? [],
        estimateItemName: r.estimateItem?.name ?? null,
        inEstimate: !!r.estimateItemId,
      })),
    [projectFilteredRecords]
  )

  const knownCategories = useMemo(
    () => Array.from(new Set(records.map(r => r.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ru')),
    [records]
  )
  
  // Долги: не оплачено нам (дебиторка) и к оплате (кредиторка)
  const receivableUnpaid = projectFilteredRecords.filter(r => r.type === 'INCOME' && !r.isPaid).reduce((sum, r) => sum + Number(r.amount), 0)
  const payableUnpaid = projectFilteredRecords.filter(r => r.type === 'EXPENSE' && !r.isPaid).reduce((sum, r) => sum + Number(r.amount), 0)
  // Выставлено всего (все счета-доходы, оплаченные и нет)
  const invoicedTotal = projectFilteredRecords.filter(r => r.type === 'INCOME').reduce((sum, r) => sum + Number(r.amount), 0)
  const overInvoiced = budgetData.budget > 0 && invoicedTotal > budgetData.budget

  // ——— 5a: сводка компании за период ———
  const nowD = new Date()
  // Календарные границы периода (месяц/квартал/год — от начала; неделя — последние 7 дней)
  const startOfPeriod = (base: Date, p: typeof period) => {
    const d = new Date(base)
    if (p === 'week') { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - 6); return x }
    if (p === 'month') return new Date(d.getFullYear(), d.getMonth(), 1)
    if (p === 'quarter') return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1)
    return new Date(d.getFullYear(), 0, 1)
  }
  const periodStart = startOfPeriod(nowD, period)
  const prevBase = (() => {
    const d = new Date(periodStart)
    if (period === 'week') d.setDate(d.getDate() - 1)
    else if (period === 'quarter') d.setMonth(d.getMonth() - 1)
    else d.setDate(0) // последний день предыдущего месяца/года
    return d
  })()
  const prevPeriodStart = startOfPeriod(prevBase, period)
  const sumType = (rs: FinanceRecord[], type: string) =>
    rs.filter((r) => r.type === type).reduce((s, r) => s + Number(r.amount), 0)
  const curRecords = records.filter((r) => new Date(r.date) >= periodStart)
  const prevRecords = records.filter((r) => {
    const t = new Date(r.date)
    return t >= prevPeriodStart && t < periodStart
  })
  const cIncome = sumType(curRecords, 'INCOME')
  const cExpense = sumType(curRecords, 'EXPENSE')
  const cProfit = cIncome - cExpense
  const cMargin = cIncome > 0 ? (cProfit / cIncome) * 100 : 0
  const pIncome = sumType(prevRecords, 'INCOME')
  const pExpense = sumType(prevRecords, 'EXPENSE')
  const deltaPct = (cur: number, prev: number) => (prev > 0 ? Math.round((cur / prev - 1) * 100) : null)
  const incomeDelta = deltaPct(cIncome, pIncome)
  const expenseDelta = deltaPct(cExpense, pExpense)
  const profitDelta = deltaPct(cProfit, pIncome - pExpense)
  const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  const periodLabel =
    period === 'week'
      ? 'последняя неделя'
      : period === 'month'
      ? capFirst(nowD.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }))
      : period === 'quarter'
      ? `${['I', 'II', 'III', 'IV'][Math.floor(nowD.getMonth() / 3)]} квартал ${nowD.getFullYear()}`
      : `${nowD.getFullYear()} год`
  // Денежный поток — последние 4 календарных месяца
  const cashflow = Array.from({ length: 4 }, (_, i) => {
    const m = new Date(nowD.getFullYear(), nowD.getMonth() - (3 - i), 1)
    const from = m.getTime()
    const to = new Date(m.getFullYear(), m.getMonth() + 1, 1).getTime()
    const inR = (r: FinanceRecord) => {
      const t = new Date(r.date).getTime()
      return t >= from && t < to
    }
    return {
      label: m.toLocaleDateString('ru-RU', { month: 'short' }),
      inc: records.filter((r) => r.type === 'INCOME' && inR(r)).reduce((s, r) => s + Number(r.amount), 0),
      exp: records.filter((r) => r.type === 'EXPENSE' && inR(r)).reduce((s, r) => s + Number(r.amount), 0),
      isLast: i === 3,
    }
  })
  const cashflowMax = Math.max(1, ...cashflow.flatMap((x) => [x.inc, x.exp]))
  // Дебиторка / кредиторка (по всей компании, вне зависимости от периода)
  const receivableCount = records.filter((r) => r.type === 'INCOME' && !r.isPaid).length
  const receivableOverdue = records.filter((r) => r.type === 'INCOME' && !r.isPaid && r.dueDate && new Date(r.dueDate) < nowD).length
  const payableCount = records.filter((r) => r.type === 'EXPENSE' && !r.isPaid).length
  const payableUrgent = records.filter(
    (r) => r.type === 'EXPENSE' && !r.isPaid && r.dueDate && new Date(r.dueDate).getTime() < nowD.getTime() + 3 * 86400000,
  ).length
  // Лента последних операций
  const recentOps = [...records]
    .filter((r) => r.type === 'INCOME' || r.type === 'EXPENSE')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6)

  // Сводка по проектам для режима "все проекты"
  const projectsForSummary = projectSearch.trim()
    ? projects.filter(p => p.name?.toLowerCase().includes(projectSearch.toLowerCase()))
    : projects

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <PageHeader title="Финансы" description="Загрузка..." />
          <SkeletonList rows={6} />
        </div>
      </Layout>
    )
  }

  const formatMoney = (n: number) =>
    new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + ' ₽'

  // Доступ к финансам — только у ролей с правом (Владелец/Админ/Руководитель проекта)
  if (!permsLoading && !hasPermission('canViewFinances')) {
    return (
      <Layout>
        <div className="flex h-64 items-center justify-center">
          <p className="text-gray-600">У вас нет доступа к разделу финансов</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <ErrorBanner message={pageError} onDismiss={() => setPageError(null)} />
        {message && (
          <div className={`p-4 rounded-lg border flex items-center justify-between ${message.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="text-sm underline">Скрыть</button>
          </div>
        )}


        {/* Выбор проекта */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Проект:
            </span>
            <select
              value={projectIdFromUrl || ''}
              onChange={(e) => setSelectedProject(e.target.value || null)}
              className="pl-3 pr-8 py-2 rounded-lg text-sm border border-gray-300 bg-white min-w-[200px] focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="">Все проекты — сводка</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {currentProject && (
              <>
                <Link
                  href={`/projects/${currentProject.id}`}
                  className="text-sm text-green-600 hover:text-green-800 flex items-center gap-1"
                >
                  Открыть проект
                  <ChevronRight className="h-4 w-4" />
                </Link>
                <span className="text-xs text-gray-500 px-2 py-1 rounded bg-gray-100">
                  {PROJECT_STATUS_LABELS[currentProject.status] || currentProject.status}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Header */}
        {currentProject && (
          <Link 
            href="/finance"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            onClick={(e) => { e.preventDefault(); setSelectedProject(null) }}
          >
            <ArrowLeft className="h-4 w-4" />
            К сводке по всем проектам
          </Link>
        )}
        
        <PageHeader
          title={currentProject ? `Финансы: ${currentProject.name}` : 'Финансы'}
          description={
            currentProject
              ? `${projectFilteredRecords.length} записей`
              : `Сводка по ${projectsForSummary.length} проектам`
          }
          actions={
            <>
              <Button onClick={handleExport} variant="outline" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Экспорт {currentProject ? 'проекта' : 'всех'}
              </Button>
              {currentProject && (
                <Button onClick={handleBudgetSettings} variant="outline" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Настройки бюджета
                </Button>
              )}
              <Button onClick={() => { setShowModal(true); setSubmitError(null) }} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Добавить запись
              </Button>
            </>
          }
        />

        {/* Режим "все проекты": сводная таблица */}
        {!currentProject && (
          <>
            {/* период */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-neutral-500">
                Все проекты · {periodLabel}
              </div>
              <div className="inline-flex rounded-lg bg-neutral-100 p-0.5">
                {([['week', 'Неделя'], ['month', 'Месяц'], ['quarter', 'Квартал'], ['year', 'Год']] as const).map(([p, l]) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`rounded-md px-3 py-1.5 text-[12.5px] transition-colors ${
                      period === p ? 'bg-white font-semibold text-neutral-900 shadow-sm' : 'font-medium text-neutral-500 hover:text-neutral-700'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* KPI */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-neutral-200 bg-white p-[18px]">
                <div className="text-[12px] font-medium text-neutral-400">Доходы</div>
                <div className="mt-1.5 text-[26px] font-bold tabular-nums text-neutral-900">{formatMoney(cIncome)}</div>
                {incomeDelta != null && (
                  <div className={`mt-1 text-[12px] ${incomeDelta >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {incomeDelta >= 0 ? '▲' : '▼'} {Math.abs(incomeDelta)}% к прошлому периоду
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-neutral-200 bg-white p-[18px]">
                <div className="text-[12px] font-medium text-neutral-400">Расходы</div>
                <div className="mt-1.5 text-[26px] font-bold tabular-nums text-neutral-900">{formatMoney(cExpense)}</div>
                {expenseDelta != null && (
                  <div className={`mt-1 text-[12px] ${expenseDelta > 0 ? 'text-red-600' : 'text-green-700'}`}>
                    {expenseDelta >= 0 ? '▲' : '▼'} {Math.abs(expenseDelta)}% к прошлому периоду
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-green-200 bg-white p-[18px]">
                <div className="text-[12px] font-medium text-green-700">Прибыль</div>
                <div className={`mt-1.5 text-[26px] font-bold tabular-nums ${cProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {cProfit >= 0 ? '+' : '−'}{formatMoney(Math.abs(cProfit))}
                </div>
                {profitDelta != null && (
                  <div className={`mt-1 text-[12px] ${profitDelta >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {profitDelta >= 0 ? '▲' : '▼'} {Math.abs(profitDelta)}% к прошлому периоду
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-green-200 bg-white p-[18px]">
                <div className="text-[12px] font-medium text-green-700">Маржа</div>
                <div className="mt-1.5 text-[26px] font-bold tabular-nums text-green-700">{cMargin.toFixed(1).replace('.', ',')}%</div>
                <div className="mt-1 text-[12px] text-neutral-400">прибыль / доходы</div>
              </div>
            </div>

            {/* денежный поток + дебиторка/кредиторка */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
              <div className="rounded-xl border border-neutral-200 bg-white p-5">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-[13.5px] font-semibold text-neutral-900">Денежный поток по месяцам</span>
                  <div className="flex gap-3.5 text-[11.5px] text-neutral-500">
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-600" />Доход</span>
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-neutral-300" />Расход</span>
                  </div>
                </div>
                <div className="flex h-[150px] items-end gap-4">
                  {cashflow.map((m, i) => {
                    const profit = m.inc - m.exp
                    return (
                    <div key={i} className="group relative flex h-full flex-1 cursor-default flex-col items-center justify-end gap-1.5">
                      {/* тултип при наведении на столбец */}
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-[168px] -translate-x-1/2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-left shadow-lg group-hover:block">
                        <div className="text-[11.5px] font-semibold capitalize text-neutral-900">{m.label}</div>
                        <div className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-neutral-600">
                          <span className="h-2 w-2 rounded-sm bg-blue-600" />Доход
                          <span className="ml-auto font-medium tabular-nums text-neutral-900">{formatMoney(m.inc)}</span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-neutral-600">
                          <span className="h-2 w-2 rounded-sm bg-neutral-300" />Расход
                          <span className="ml-auto font-medium tabular-nums text-neutral-900">{formatMoney(m.exp)}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 border-t border-neutral-100 pt-1 text-[11.5px] text-neutral-600">
                          Прибыль
                          <span className={`ml-auto font-semibold tabular-nums ${profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                            {profit >= 0 ? '+' : '−'}{formatMoney(Math.abs(profit))}
                          </span>
                        </div>
                      </div>
                      <div className="flex h-full w-full items-end justify-center gap-1">
                        <div className="w-2/5 rounded-t bg-blue-600 transition-opacity group-hover:opacity-80" style={{ height: `${Math.max(2, (m.inc / cashflowMax) * 100)}%` }} />
                        <div className="w-2/5 rounded-t bg-neutral-300 transition-opacity group-hover:opacity-80" style={{ height: `${Math.max(2, (m.exp / cashflowMax) * 100)}%` }} />
                      </div>
                      <span className={`text-[11px] ${m.isLast ? 'font-semibold text-neutral-900' : 'text-neutral-400'}`}>{m.label}</span>
                    </div>
                    )
                  })}
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <div className="rounded-xl border border-neutral-200 bg-white p-[18px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] text-neutral-500">Не оплачено нам</span>
                    {receivableOverdue > 0 && (
                      <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">{receivableOverdue} просрочены</span>
                    )}
                  </div>
                  <div className="mt-1.5 text-[23px] font-bold tabular-nums text-green-700">{formatMoney(receivableUnpaid)}</div>
                  <div className="mt-0.5 text-[11.5px] text-neutral-400">по {receivableCount} счетам и актам</div>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white p-[18px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] text-neutral-500">Нам к оплате</span>
                    {payableUrgent > 0 && (
                      <span className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] text-red-600">{payableUrgent} срочно</span>
                    )}
                  </div>
                  <div className="mt-1.5 text-[23px] font-bold tabular-nums text-red-600">{formatMoney(payableUnpaid)}</div>
                  <div className="mt-0.5 text-[11.5px] text-neutral-400">по {payableCount} неоплаченным расходам</div>
                </div>
              </div>
            </div>

            {/* лента операций */}
            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
              <div className="flex items-center justify-between border-b border-neutral-100 px-[18px] py-3.5">
                <span className="text-[13.5px] font-semibold text-neutral-900">Последние операции</span>
              </div>
              {recentOps.length === 0 ? (
                <div className="px-[18px] py-8 text-center text-sm text-neutral-400">Операций пока нет</div>
              ) : (
                recentOps.map((op, i) => {
                  const income = op.type === 'INCOME'
                  const dot = !op.isPaid ? 'bg-amber-500' : income ? 'bg-green-600' : 'bg-red-600'
                  const status = op.isPaid
                    ? `Оплачено · ${new Date(op.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}`
                    : op.dueDate
                    ? `Ожидает · до ${new Date(op.dueDate).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}`
                    : 'Ожидает'
                  return (
                    <div key={op.id} className={`grid grid-cols-[24px_1.8fr_1.3fr_1fr_0.9fr] items-center border-t border-neutral-100 px-4 ${i % 2 ? 'bg-neutral-50/40' : ''}`}>
                      <div className="py-3"><span className={`block h-2.5 w-2.5 rounded-full ${dot}`} /></div>
                      <div className="truncate py-3 pr-2 text-[13px] font-medium text-neutral-900" title={op.description || op.category}>{op.description || op.category}</div>
                      <div className="truncate py-3 pr-2 text-[12.5px] text-neutral-500">{op.project?.name || '—'}</div>
                      <div className={`py-3 pr-2 text-[12px] ${!op.isPaid ? 'text-amber-700' : 'text-neutral-400'}`}>{status}</div>
                      <div className={`py-3 text-right text-[13px] font-semibold tabular-nums ${income ? 'text-green-700' : 'text-neutral-900'}`}>
                        {income ? '+' : '−'}{formatMoney(Number(op.amount))}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Проекты — дровилл в финансы проекта (5b) */}
            <div className="text-[13.5px] font-semibold text-neutral-900">Проекты</div>
            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="p-4 border-b flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  placeholder="Поиск по названию проекта..."
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-64 focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Проект</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Бюджет</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Получено</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Потрачено</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Остаток</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Освоение</th>
                      <th className="px-4 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {projectsForSummary.map((p) => {
                      const budget = Number(p.budget) || 0
                      const received = p.financialSummary?.income ?? 0
                      const spent = p.financialSummary?.expenses ?? 0
                      const remainder = budget - spent
                      const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0
                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => setSelectedProject(p.id)}
                        >
                          <td className="px-4 py-3">
                            <span className="font-medium text-gray-900">{p.name}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 text-xs rounded ${p.status === 'COMPLETED' ? 'bg-gray-100 text-gray-700' : p.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                              {PROJECT_STATUS_LABELS[p.status] || p.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-700">{formatMoney(budget)}</td>
                          <td className="px-4 py-3 text-right text-sm text-green-600">{formatMoney(received)}</td>
                          <td className="px-4 py-3 text-right text-sm text-red-600">{formatMoney(spent)}</td>
                          <td className="px-4 py-3 text-right text-sm font-medium">{remainder >= 0 ? formatMoney(remainder) : `−${formatMoney(-remainder)}`}</td>
                          <td className="px-4 py-3 text-right text-sm text-gray-600">{budget > 0 ? `${pct}%` : '—'}</td>
                          <td className="px-4 py-3">
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Режим "один проект": KPI по проекту */}
        {currentProject && (
          <>
            {overInvoiced && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
                Выставлено счетов ({formatMoney(invoicedTotal)}) больше стоимости договора ({formatMoney(budgetData.budget)}). Проверьте счета.
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <KpiCard title="Договор" value={formatMoney(budgetData.budget)} icon={<DollarSign className="h-5 w-5" />} status="neutral" />
              <KpiCard title="Выставлено" value={formatMoney(invoicedTotal)} icon={<FileText className="h-5 w-5" />} status="neutral" />
              <KpiCard title="Получено" value={formatMoney(budgetData.received)} change={budgetData.budget > 0 ? Number(((budgetData.received / budgetData.budget) * 100).toFixed(1)) : undefined} changeLabel="от договора" icon={<TrendingUp className="h-5 w-5" />} status="positive" />
              <KpiCard title="Не оплачено нам" value={formatMoney(receivableUnpaid)} icon={<Clock className="h-5 w-5" />} status={receivableUnpaid > 0 ? 'negative' : 'neutral'} />
              <KpiCard title="Потрачено" value={formatMoney(budgetData.spent)} icon={<TrendingDown className="h-5 w-5" />} status="neutral" />
              <KpiCard title="К оплате" value={formatMoney(payableUnpaid)} icon={<Clock className="h-5 w-5" />} status={payableUnpaid > 0 ? 'negative' : 'neutral'} />
            </div>
          </>
        )}

        {/* Фильтры, освоение, структура, детализация — только при выбранном проекте */}
        {currentProject && (
          <>
        <BudgetProgressBar
          budget={budgetData.budget}
          estimateTotal={budgetData.estimateTotal}
          spent={budgetData.spent}
          received={budgetData.received}
          projectName={currentProject?.name}
          projectStatus={currentProject?.status}
        />

        <BudgetCategoriesWithOperations
          incomeList={incomeListForBlock}
          expenses={expensesForBlock}
          onAddOperation={handleAddOperation}
          onCreateInvoice={handleCreateInvoice}
          onMarkPaid={handleMarkAsPaid}
          onEdit={handleEditOperation}
          onDelete={handleDeleteClick}
          onUpdateReceipts={handleUpdateReceipts}
        />
          </>
        )}

        {/* Budget Settings Modal */}
        <Dialog open={showBudgetModal} onOpenChange={(o) => !o && setShowBudgetModal(false)}>
          <DialogContent className="max-w-md p-0">
            <DialogHeader className="border-b p-6 pb-4">
              <DialogTitle>Настройки бюджета</DialogTitle>
            </DialogHeader>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Бюджет проекта (₽)
                  </label>
                  <input
                    type="number"
                    value={budgetFormData}
                    onChange={(e) => setBudgetFormData(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Введите сумму бюджета"
                  />
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Информация</h3>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>Сумма сметы: {new Intl.NumberFormat('ru-RU').format(budgetData.estimateTotal)} ₽</p>
                    <p>Потрачено: {new Intl.NumberFormat('ru-RU').format(budgetData.spent)} ₽</p>
                    <p>Получено: {new Intl.NumberFormat('ru-RU').format(budgetData.received)} ₽</p>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleSaveBudget}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                  >
                    Сохранить
                  </button>
                  <button
                    onClick={() => setShowBudgetModal(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                  >
                    Отмена
                  </button>
                </div>
              </div>
          </DialogContent>
        </Dialog>

        {/* Modal */}
        <Dialog open={showModal} onOpenChange={(o) => !o && setShowModal(false)}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-0">
            <DialogHeader className="sticky top-0 z-10 border-b bg-white p-6 pb-4">
              <DialogTitle>{editingId ? 'Изменить запись' : 'Добавить финансовую запись'}</DialogTitle>
            </DialogHeader>

              {submitError && (
                <div className="mx-6 mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
                  {submitError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Тип *</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({...formData, type: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="INCOME">Доход</option>
                      <option value="EXPENSE">Расход</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Категория {formData.type === 'EXPENSE' ? '*' : ''}</label>
                    {formData.type === 'EXPENSE' && formData.projectId && estimateCategories.length > 0 ? (
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({...formData, category: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring/55"
                        required
                      >
                        <option value="">Выберите категорию</option>
                        {estimateCategories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    ) : (
                      <>
                        <input
                          type="text"
                          list="finance-categories"
                          value={formData.category}
                          onChange={(e) => setFormData({...formData, category: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring/55"
                          placeholder={formData.type === 'INCOME' ? 'Напр. Оплата по счёту' : 'Напр. Материалы, Работы'}
                          required={formData.type === 'EXPENSE'}
                        />
                        <datalist id="finance-categories">
                          {knownCategories.map(cat => (
                            <option key={cat} value={cat} />
                          ))}
                        </datalist>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Сумма *</label>
                    <input
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({...formData, amount: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Дата *</label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Проект {formData.type === 'EXPENSE' ? '*' : ''}
                  </label>
                  <select
                    value={formData.projectId}
                    onChange={(e) => setFormData({...formData, projectId: e.target.value, estimateItemId: ''})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    required={formData.type === 'EXPENSE'}
                  >
                    <option value="">{formData.type === 'EXPENSE' ? 'Выберите проект' : 'Без проекта'}</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  {formData.type === 'EXPENSE' && (
                    <p className="text-xs text-gray-500 mt-1">Для расхода проект обязателен</p>
                  )}
                </div>

                {formData.type === 'EXPENSE' && formData.projectId && estimateItems.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Позиция сметы (опционально)</label>
                    <select
                      value={formData.estimateItemId}
                      onChange={(e) => {
                        const itemId = e.target.value
                        const item = estimateItems.find(i => i.id === itemId)
                        setFormData({
                          ...formData,
                          estimateItemId: itemId,
                          category: item ? item.category : formData.category
                        })
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Не привязывать</option>
                      {estimateItems.map(item => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">При выборе позиции категория подставится из сметы</p>
                  </div>
                )}

                {(formData.type === 'INCOME' || formData.type === 'EXPENSE') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <p className="sm:col-span-2 text-xs font-medium text-gray-600 mb-1">Счёт и оплата (опционально)</p>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Номер счёта</label>
                      <input
                        type="text"
                        value={formData.invoiceNumber}
                        onChange={(e) => setFormData({...formData, invoiceNumber: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring/55"
                        placeholder="Напр. 123 от 01.01.2025"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Срок оплаты</label>
                      <input
                        type="date"
                        value={formData.dueDate}
                        onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring/55"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Контрагент</label>
                      <input
                        type="text"
                        value={formData.counterparty}
                        onChange={(e) => setFormData({...formData, counterparty: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring/55"
                        placeholder="ИП Иванов, ООО Поставщик"
                      />
                    </div>
                  </div>
                )}

                {formData.type === 'EXPENSE' && (
                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 space-y-3">
                    <p className="text-xs font-medium text-gray-600">Расход (опционально)</p>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Кто купил</label>
                      <input
                        type="text"
                        value={formData.purchasedBy}
                        onChange={(e) => setFormData({...formData, purchasedBy: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring/55"
                        placeholder="Напр. прораб Сергей"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Чеки (фото)</label>
                      <div className="flex flex-wrap items-center gap-2">
                        {receiptUploads.map((r, i) => (
                          <div key={i} className="relative group">
                            <img src={r.url} alt={r.name} className="h-14 w-14 rounded-md border border-gray-200 object-cover" />
                            <button
                              type="button"
                              onClick={() => setReceiptUploads(prev => prev.filter((_, idx) => idx !== i))}
                              className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-neutral-900 text-white text-xs flex items-center justify-center"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <label className="h-14 w-14 rounded-md border border-dashed border-gray-300 flex items-center justify-center cursor-pointer text-gray-400 hover:bg-gray-100">
                          {uploadingReceipt ? '…' : <Plus className="h-5 w-5" />}
                          <input type="file" accept="image/*" multiple className="hidden" onChange={handleReceiptUpload} disabled={uploadingReceipt} />
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Описание</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring/55"
                    rows={3}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                  >
                    Добавить
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
      </div>
    </Layout>
  )
}

export default function FinancePage() {
  return (
    <PageSuspense>
      <FinancePageContent />
    </PageSuspense>
  )
}
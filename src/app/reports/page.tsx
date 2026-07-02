'use client'


import { toast } from '@/components/ui/use-toast'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  BarChart3, 
  Download, 
  Calendar, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Users,
  FileText,
  Target,
  Filter,
  Loader2
} from 'lucide-react'
import Layout from '@/components/layout'
import PageHeader from '@/components/page-header'
import { SkeletonList } from '@/components/ui/skeleton'
import { PermissionGuard } from '@/components/permission-guard'
import { ErrorBanner } from '@/components/ui/error-banner'

interface ReportStats {
  totalProjects: number
  activeProjects: number
  completedProjects: number
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  totalDocuments: number
  totalUsers: number
  activeUsers: number
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  margin: number
  recentProjects: number
  recentTasks: number
  recentDocuments: number
}

export default function ReportsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('month')
  const [selectedType, setSelectedType] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [stats, setStats] = useState<ReportStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchReportData = async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({
        period: selectedPeriod,
        type: selectedType,
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      })

      const response = await fetch(`/api/reports?${params}`)

      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
      } else {
        const data = await response.json().catch(() => ({}))
        setError(data.error || 'Не удалось загрузить данные отчётов')
      }
    } catch {
      setError('Ошибка при загрузке данных отчётов')
    } finally {
      setLoading(false)
    }
  }

  // Генерация отчета
  const handleGenerateReport = async (reportId: string) => {
    try {
      setGenerating(reportId)
      
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: reportId,
          period: selectedPeriod,
          startDate,
          endDate
        })
      })

      if (response.ok) {
        // Получаем файл как blob
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        
        // Определяем имя файла из заголовка или используем по умолчанию
        const contentDisposition = response.headers.get('content-disposition')
        let fileName = `${reportId}_report_${Date.now()}.xlsx`
        if (contentDisposition) {
          const fileNameMatch = contentDisposition.match(/filename="(.+)"/)
          if (fileNameMatch) {
            fileName = fileNameMatch[1]
          }
        }
        
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        
        toast.success(`Отчет ${reportId} успешно сгенерирован и скачан!`)
      } else {
        toast.error('Ошибка при генерации отчета')
      }
    } catch (error) {
      console.error('Error generating report:', error)
      toast.error('Ошибка при генерации отчета')
    } finally {
      setGenerating(null)
    }
  }

  // Скачивание отчета
  const handleDownloadReport = async (reportId: string) => {
    try {
      setDownloading(reportId)
      const params = new URLSearchParams({
        period: selectedPeriod,
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      })
      
      const response = await fetch(
        `/api/reports/download/${reportId}_${Date.now()}.txt?${params}`
      )

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${reportId}_report.txt`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        toast.error('Ошибка при скачивании отчета')
      }
    } catch (error) {
      console.error('Error downloading report:', error)
      toast.error('Ошибка при скачивании отчета')
    } finally {
      setDownloading(null)
    }
  }

  // Экспорт всех отчетов
  const handleExportAll = async () => {
    try {
      const reportTypes = ['financial', 'projects', 'users', 'documents']
      
      for (const type of reportTypes) {
        const response = await fetch('/api/reports/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reportType: type,
            period: selectedPeriod,
            startDate,
            endDate
          })
        })

        if (response.ok) {
          // Скачиваем каждый файл
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          
          const contentDisposition = response.headers.get('content-disposition')
          let fileName = `${type}_report_${Date.now()}.xlsx`
          if (contentDisposition) {
            const fileNameMatch = contentDisposition.match(/filename="(.+)"/)
            if (fileNameMatch) {
              fileName = fileNameMatch[1]
            }
          }
          
          a.download = fileName
          document.body.appendChild(a)
          a.click()
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)
        }
      }
      
      toast.success('Все отчеты успешно экспортированы в Excel!')
    } catch (error) {
      console.error('Error exporting all reports:', error)
      toast.error('Ошибка при экспорте отчетов')
    }
  }

  // Быстрые действия
  const handleQuickAction = async (action: string) => {
    try {
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportType: action,
          period: selectedPeriod,
          startDate,
          endDate
        })
      })

      if (response.ok) {
        // Скачиваем файл
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        
        const contentDisposition = response.headers.get('content-disposition')
        let fileName = `${action}_report_${Date.now()}.xlsx`
        if (contentDisposition) {
          const fileNameMatch = contentDisposition.match(/filename="(.+)"/)
          if (fileNameMatch) {
            fileName = fileNameMatch[1]
          }
        }
        
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        
        toast.success(`Отчет "${action}" успешно сгенерирован и скачан!`)
      } else {
        toast.error('Ошибка при генерации отчета')
      }
    } catch (error) {
      console.error('Error generating quick report:', error)
      toast.error('Ошибка при генерации отчета')
    }
  }

  // Загрузка данных при изменении фильтров
  useEffect(() => {
    fetchReportData()
  }, [selectedPeriod, selectedType, startDate, endDate])

  const reports = [
    {
      id: 'financial',
      title: 'Финансовый отчет',
      description: 'Анализ доходов и расходов по проектам',
      type: 'financial',
      icon: DollarSign,
      color: 'bg-gray-100 text-gray-700',
      lastGenerated: new Date().toISOString().split('T')[0]
    },
    {
      id: 'projects',
      title: 'Отчет по проектам',
      description: 'Статус и прогресс выполнения проектов',
      type: 'projects',
      icon: Target,
      color: 'bg-gray-100 text-gray-700',
      lastGenerated: new Date().toISOString().split('T')[0]
    },
    {
      id: 'users',
      title: 'Отчет по пользователям',
      description: 'Активность и производительность команды',
      type: 'users',
      icon: Users,
      color: 'bg-gray-100 text-gray-700',
      lastGenerated: new Date().toISOString().split('T')[0]
    },
    {
      id: 'documents',
      title: 'Отчет по документам',
      description: 'Статистика документооборота',
      type: 'documents',
      icon: FileText,
      color: 'bg-gray-100 text-gray-700',
      lastGenerated: new Date().toISOString().split('T')[0]
    }
  ]

  // Динамические статистические данные
  const getStatsData = () => {
    if (!stats) return []
    
    return [
      {
        title: 'Общая прибыль',
        value: `₽${stats.netProfit.toLocaleString()}`,
        change: stats.margin > 0 ? `+${stats.margin.toFixed(1)}%` : `${stats.margin.toFixed(1)}%`,
        trend: stats.netProfit > 0 ? 'up' : 'down',
        icon: stats.netProfit > 0 ? TrendingUp : TrendingDown
      },
      {
        title: 'Активные проекты',
        value: stats.activeProjects.toString(),
        change: `+${stats.recentProjects}`,
        trend: 'up',
        icon: Target
      },
      {
        title: 'Завершенные задачи',
        value: stats.completedTasks.toString(),
        change: `+${stats.recentTasks}`,
        trend: 'up',
        icon: FileText
      },
      {
        title: 'Средняя маржа',
        value: `${stats.margin.toFixed(1)}%`,
        change: stats.margin > 0 ? `+${stats.margin.toFixed(1)}%` : `${stats.margin.toFixed(1)}%`,
        trend: stats.margin > 0 ? 'up' : 'down',
        icon: TrendingDown
      }
    ]
  }

  return (
    <Layout>
      <PermissionGuard
        permission="canViewReports"
        fallback={
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-600">У вас нет доступа к разделу отчётов</p>
          </div>
        }
      >
      <div className="space-y-6">
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
        <PageHeader
          title="Отчёты"
          description="Аналитика и отчётность по проектам"
          actions={
            <div className="flex items-center gap-2">
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="week">За неделю</option>
                <option value="month">За месяц</option>
                <option value="quarter">За квартал</option>
                <option value="year">За год</option>
              </select>
              <button
                onClick={handleExportAll}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Экспорт всех
              </button>
            </div>
          }
        />

        <div>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {loading ? (
              <div className="col-span-4">
                <SkeletonList rows={1} />
              </div>
            ) : (
              getStatsData().map((stat, index) => (
              <Card key={index}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                      <p className="text-2xl font-bold text-gray-900 tabular-nums">{stat.value}</p>
                      <p className={`text-sm flex items-center mt-1 ${
                        stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        <stat.icon className="h-4 w-4 mr-1" />
                        {stat.change}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-gray-50">
                      <stat.icon className="h-6 w-6 text-gray-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              ))
            )}
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-5">
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center space-x-2">
                  <Filter className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Фильтры:</span>
                </div>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="all">Все отчеты</option>
                  <option value="financial">Финансовые</option>
                  <option value="projects">Проекты</option>
                  <option value="users">Пользователи</option>
                  <option value="documents">Документы</option>
                </select>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <input
                    type="date"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <span className="text-gray-500">-</span>
                  <input
                    type="date"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reports Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reports
              .filter(report => selectedType === 'all' || report.type === selectedType)
              .map((report, index) => (
                <Card key={report.id} className="animate-fade-in hover:shadow-lg transition-all duration-200" style={{ animationDelay: `${index * 0.1}s` }}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`p-2 rounded-lg ${report.color} mr-3`}>
                          <report.icon className="h-5 w-5" />
                        </div>
                        <span>{report.title}</span>
                      </div>
                    </CardTitle>
                    <CardDescription>{report.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Последний отчет:</span> {report.lastGenerated}
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        className="flex-1"
                        onClick={() => handleGenerateReport(report.id)}
                        disabled={generating === report.id}
                      >
                        {generating === report.id ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <BarChart3 className="h-4 w-4 mr-2" />
                        )}
                        {generating === report.id ? 'Генерация...' : 'Сгенерировать'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleDownloadReport(report.id)}
                        disabled={downloading === report.id}
                      >
                        {downloading === report.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>

          {/* Quick Actions */}
          <Card className="mt-8 animate-fade-in">
            <CardHeader>
              <CardTitle>Быстрые действия</CardTitle>
              <CardDescription>Часто используемые отчеты и аналитика</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button 
                  variant="outline" 
                  className="h-20 flex-col space-y-2"
                  onClick={() => handleQuickAction('financial')}
                >
                  <DollarSign className="h-6 w-6" />
                  <span>Финансовая сводка</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-20 flex-col space-y-2"
                  onClick={() => handleQuickAction('projects')}
                >
                  <Target className="h-6 w-6" />
                  <span>Прогресс проектов</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-20 flex-col space-y-2"
                  onClick={() => handleQuickAction('users')}
                >
                  <Users className="h-6 w-6" />
                  <span>Активность команды</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </PermissionGuard>
    </Layout>
  )
}
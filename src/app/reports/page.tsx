'use client'

import { toast } from '@/components/ui/use-toast'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Download,
  Calendar,
  DollarSign,
  Users,
  FileText,
  Target,
  Loader2,
} from 'lucide-react'
import Layout from '@/components/layout'
import PageHeader from '@/components/page-header'
import { SkeletonList } from '@/components/ui/skeleton'
import { PermissionGuard } from '@/components/permission-guard'
import { ErrorBanner } from '@/components/ui/error-banner'

interface ReportStats {
  totalInvoiced: number
  totalReceived: number
  totalExpenses: number
  netProfit: number
  margin: number
  activeProjects: number
  completedTasks: number
  periodLabel?: string
}

const REPORTS = [
  {
    id: 'financial',
    title: 'Финансовый отчет',
    description: 'Все доходы и расходы по проектам с отметкой оплаты',
    icon: DollarSign,
  },
  {
    id: 'projects',
    title: 'Отчет по проектам',
    description: 'Статус, бюджеты и прогресс выполнения проектов',
    icon: Target,
  },
  {
    id: 'users',
    title: 'Отчет по пользователям',
    description: 'Активность и производительность команды',
    icon: Users,
  },
  {
    id: 'documents',
    title: 'Отчет по документам',
    description: 'Статистика документооборота',
    icon: FileText,
  },
]

const fmtMoney = (v: number) => `${new Intl.NumberFormat('ru-RU').format(v)} ₽`

export default function ReportsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('month')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [stats, setStats] = useState<ReportStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchReportData = async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({
        period: selectedPeriod,
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

  useEffect(() => {
    fetchReportData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod, startDate, endDate])

  // Генерация и скачивание Excel-отчёта
  const handleGenerateReport = async (reportId: string, reportTitle: string) => {
    try {
      setGenerating(reportId)

      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: reportId,
          period: selectedPeriod,
          startDate,
          endDate,
        }),
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url

        const contentDisposition = response.headers.get('content-disposition')
        let fileName = `${reportId}_report_${Date.now()}.xlsx`
        if (contentDisposition) {
          const fileNameMatch = contentDisposition.match(/filename="(.+)"/)
          if (fileNameMatch) fileName = fileNameMatch[1]
        }

        a.download = fileName
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)

        toast.success(`«${reportTitle}» скачан`)
      } else {
        const data = await response.json().catch(() => ({}))
        toast.error(data.error || 'Ошибка при генерации отчета')
      }
    } catch (error) {
      console.error('Error generating report:', error)
      toast.error('Ошибка при генерации отчета')
    } finally {
      setGenerating(null)
    }
  }

  const kpi = stats
    ? [
        { title: 'Выставлено', value: fmtMoney(stats.totalInvoiced), hint: 'счета за период' },
        { title: 'Получено', value: fmtMoney(stats.totalReceived), hint: 'оплаченные счета' },
        { title: 'Расходы', value: fmtMoney(stats.totalExpenses), hint: 'за период' },
        {
          title: 'Прибыль',
          value: fmtMoney(stats.netProfit),
          hint: `маржа ${stats.margin}%`,
          accent: stats.netProfit > 0 ? 'text-green-700' : stats.netProfit < 0 ? 'text-red-600' : '',
        },
      ]
    : []

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
          description="Финансовая сводка за период и выгрузки в Excel"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-ring focus:border-transparent"
              >
                <option value="week">За неделю</option>
                <option value="month">За месяц</option>
                <option value="quarter">За квартал</option>
                <option value="year">За год</option>
                <option value="all">За всё время</option>
              </select>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-neutral-400" />
                <input
                  type="date"
                  className="px-2.5 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-ring focus:border-transparent"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  aria-label="Начало периода"
                />
                <span className="text-neutral-400">–</span>
                <input
                  type="date"
                  className="px-2.5 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-ring focus:border-transparent"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  aria-label="Конец периода"
                />
              </div>
            </div>
          }
        />

        {/* Финансовая сводка (модель как в Финансах: получено = оплаченные счета) */}
        {loading ? (
          <SkeletonList rows={2} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpi.map((s) => (
              <Card key={s.title}>
                <CardContent className="p-5">
                  <p className="text-sm font-medium text-neutral-500">{s.title}</p>
                  <p className={`mt-1 text-2xl font-bold tabular-nums ${s.accent || 'text-neutral-900'}`}>
                    {s.value}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-400">{s.hint}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Выгрузки */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {REPORTS.map((report) => (
            <Card key={report.id}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3 text-base">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100">
                    <report.icon className="h-[18px] w-[18px] text-neutral-600" />
                  </span>
                  {report.title}
                </CardTitle>
                <CardDescription>{report.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <button
                  onClick={() => handleGenerateReport(report.id, report.title)}
                  disabled={generating === report.id}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {generating === report.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {generating === report.id ? 'Формируется…' : 'Скачать Excel'}
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      </PermissionGuard>
    </Layout>
  )
}

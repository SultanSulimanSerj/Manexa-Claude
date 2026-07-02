'use client'

import { useState, useEffect } from 'react'
import Layout from '@/components/layout'
import PageHeader from '@/components/page-header'
import { SkeletonList } from '@/components/ui/skeleton'
import { PermissionGuard } from '@/components/permission-guard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Activity, AlertTriangle, Database, Server, TrendingUp, Clock } from 'lucide-react'

interface HealthData {
  status: string
  timestamp: string
  uptime: number
  database: {
    status: string
    responseTime: number
    healthy: boolean
  }
  performance: {
    averageResponseTime: number
    errorRate: number
    systemHealth: string
  }
  system: {
    memory: {
      used: number
      total: number
      percentage: number
    }
    cpu: {
      usage: number
    }
  }
  alerts: {
    total: number
    critical: number
    recent: Array<{
      id: string
      type: string
      severity: string
      message: string
      timestamp: string
    }>
  }
  responseTime: number
}

export default function MonitoringPage() {
  const [healthData, setHealthData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchHealthData = async () => {
    try {
      const response = await fetch('/api/health')
      const data = await response.json()
      setHealthData(data)
      setError('')
    } catch (err) {
      setError('Failed to fetch health data')
      console.error('Health check error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHealthData()
    const interval = setInterval(fetchHealthData, 30000) // Обновляем каждые 30 секунд
    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500'
      case 'warning': return 'bg-yellow-500'
      case 'critical': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${days}d ${hours}h ${minutes}m`
  }

  if (loading) {
    return (
      <PermissionGuard permission="canViewSystemSettings" fallback={
        <Layout>
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-600">Недостаточно прав для просмотра мониторинга</p>
          </div>
        </Layout>
      }>
        <Layout>
          <div className="space-y-6">
            <PageHeader title="Мониторинг системы" description="Загрузка..." />
            <SkeletonList rows={5} />
          </div>
        </Layout>
      </PermissionGuard>
    )
  }

  if (error) {
    return (
      <PermissionGuard permission="canViewSystemSettings" fallback={
        <Layout>
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-600">Недостаточно прав для просмотра мониторинга</p>
          </div>
        </Layout>
      }>
        <Layout>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600">{error}</p>
              <Button onClick={fetchHealthData} className="mt-4">
                Попробовать снова
              </Button>
            </div>
          </div>
        </Layout>
      </PermissionGuard>
    )
  }

  return (
    <PermissionGuard permission="canViewSystemSettings" fallback={
      <Layout>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-600">Недостаточно прав для просмотра мониторинга</p>
        </div>
      </Layout>
    }>
    <Layout>
      <div className="space-y-6">
        <PageHeader
          title="Мониторинг системы"
          description={`Последнее обновление: ${new Date(healthData?.timestamp || '').toLocaleString()}`}
          actions={
            <Button onClick={fetchHealthData} variant="outline">
              Обновить
            </Button>
          }
        />

        {/* Общий статус */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Общий статус системы
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className={`w-4 h-4 rounded-full ${getStatusColor(healthData?.status || '')}`}></div>
              <span className="text-lg font-semibold capitalize">
                {healthData?.status || 'Unknown'}
              </span>
              <Badge variant="outline">
                Uptime: {formatUptime(healthData?.uptime || 0)}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Метрики производительности */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Среднее время ответа</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round(healthData?.performance.averageResponseTime || 0)}ms
              </div>
              <p className="text-xs text-gray-500 mt-1">
                <Clock className="inline h-3 w-3 mr-1" />
                Время отклика API
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Процент ошибок</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {healthData?.performance.errorRate.toFixed(2) || 0}%
              </div>
              <p className="text-xs text-gray-500 mt-1">
                <TrendingUp className="inline h-3 w-3 mr-1" />
                За последний период
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Использование памяти</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {healthData?.system.memory.percentage.toFixed(1) || 0}%
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {formatBytes(healthData?.system.memory.used || 0)} / {formatBytes(healthData?.system.memory.total || 0)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* База данных */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              База данных
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${healthData?.database.healthy ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="font-medium">
                  {healthData?.database.status === 'healthy' ? 'Подключена' : 'Ошибка подключения'}
                </span>
              </div>
              <Badge variant="outline">
                {healthData?.database.responseTime || 0}ms
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Алерты */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Алерты и уведомления
            </CardTitle>
            <CardDescription>
              Всего: {healthData?.alerts.total || 0} | Критических: {healthData?.alerts.critical || 0}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {healthData?.alerts.recent.length ? (
              <div className="space-y-2">
                {healthData.alerts.recent.map((alert) => (
                  <div key={alert.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge className={getSeverityColor(alert.severity)}>
                        {alert.severity}
                      </Badge>
                      <span className="text-sm">{alert.message}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(alert.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">Нет активных алертов</p>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
    </PermissionGuard>
  )
}

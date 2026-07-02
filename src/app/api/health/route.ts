import { NextRequest, NextResponse } from 'next/server'
import { getSystemMetrics } from '@/lib/monitoring'
import { performanceMonitor } from '@/lib/monitoring'
import { alertManager } from '@/lib/alerts'
import { prisma } from '@/lib/prisma'
import { authenticateUser } from '@/lib/auth-api'
import { UserRole } from '@/lib/permissions'

async function requireHealthAccess(request: NextRequest) {
  if (process.env.HEALTH_PUBLIC === 'true') return true
  const user = await authenticateUser(request)
  return !!user && (user.role === UserRole.OWNER || user.role === UserRole.ADMIN)
}

export async function GET(request: NextRequest) {
  try {
    if (!(await requireHealthAccess(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const startTime = Date.now()
    
    // Проверяем подключение к базе данных
    let dbStatus = 'healthy'
    let dbResponseTime = 0
    
    try {
      const dbStart = Date.now()
      await prisma.$queryRaw`SELECT 1`
      dbResponseTime = Date.now() - dbStart
    } catch (error) {
      dbStatus = 'unhealthy'
    }

    // Получаем системные метрики
    const systemMetrics = await getSystemMetrics()
    
    // Проверяем производительность
    const systemHealth = performanceMonitor.getSystemHealth()
    const avgResponseTime = performanceMonitor.getAverageResponseTime()
    const errorRate = performanceMonitor.getErrorRate()
    
    // Прогоняем проверки (троттлинг внутри — не чаще раза в минуту)
    await alertManager.runScheduledChecks().catch(() => {})

    // Получаем активные алерты
    const activeAlerts = alertManager.getAlerts(undefined, false)
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical')
    
    const totalTime = Date.now() - startTime

    const healthStatus = {
      status: systemHealth,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV,
      
      database: {
        status: dbStatus,
        responseTime: dbResponseTime,
        healthy: dbStatus === 'healthy'
      },
      
      performance: {
        averageResponseTime: avgResponseTime,
        errorRate: errorRate,
        systemHealth: systemHealth
      },
      
      system: {
        memory: {
          used: systemMetrics.memory.used,
          total: systemMetrics.memory.total,
          percentage: systemMetrics.memory.percentage
        },
        cpu: {
          usage: systemMetrics.cpu.usage
        }
      },
      
      alerts: {
        total: activeAlerts.length,
        critical: criticalAlerts.length,
        recent: activeAlerts.slice(0, 5).map(alert => ({
          id: alert.id,
          type: alert.type,
          severity: alert.severity,
          message: alert.message,
          timestamp: alert.timestamp
        }))
      },
      
      responseTime: totalTime
    }

    // Определяем HTTP статус
    let httpStatus = 200
    if (systemHealth === 'critical' || criticalAlerts.length > 0) {
      httpStatus = 503 // Service Unavailable
    } else if (systemHealth === 'warning') {
      httpStatus = 200 // OK but with warnings
    }

    return NextResponse.json(healthStatus, { status: httpStatus })
    
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 })
  }
}

// Endpoint для получения метрик
export async function POST(request: NextRequest) {
  try {
    if (!(await requireHealthAccess(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { type, timeRange } = await request.json()
    
    let metrics
    
    if (type === 'performance') {
      metrics = performanceMonitor.getMetrics(
        undefined,
        timeRange ? {
          start: new Date(timeRange.start),
          end: new Date(timeRange.end)
        } : undefined
      )
    } else if (type === 'system') {
      metrics = await getSystemMetrics()
    } else if (type === 'alerts') {
      metrics = alertManager.getAlerts()
    } else {
      return NextResponse.json({ error: 'Invalid metrics type' }, { status: 400 })
    }

    return NextResponse.json({ metrics })
    
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 })
  }
}

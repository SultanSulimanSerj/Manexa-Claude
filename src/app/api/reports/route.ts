import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/auth-middleware'
import { getReportDateRange, isDateInRange, periodLabel } from '@/lib/report-utils'

export async function GET(request: NextRequest) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canViewReports')
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!allowed) {
      return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
    }
    if (!user.companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const dateRange = getReportDateRange(period, startDate, endDate)

    const projects = await prisma.project.findMany({
      where: { companyId: user.companyId! },
      include: { _count: { select: { tasks: true, documents: true } } },
    })

    const finances = await prisma.finance.findMany({
      where: { project: { companyId: user.companyId! } },
    })

    const tasks = await prisma.task.findMany({
      where: { project: { companyId: user.companyId! } },
      include: { project: true },
    })

    const users = await prisma.user.findMany({
      where: { companyId: user.companyId! },
      include: { _count: { select: { createdProjects: true, createdTasks: true } } },
    })

    const documents = await prisma.document.findMany({
      where: { project: { companyId: user.companyId! } },
    })

    const filteredFinances = finances.filter((f) => isDateInRange(f.date, dateRange))
    const filteredTasks = tasks.filter((t) => isDateInRange(t.createdAt, dateRange))
    const filteredDocuments = documents.filter((d) => isDateInRange(d.createdAt, dateRange))
    const filteredProjects = projects.filter((p) => isDateInRange(p.createdAt, dateRange))

    const totalProjects = projects.length
    const activeProjects = projects.filter((p) => p.status === 'ACTIVE').length
    const completedProjects = projects.filter((p) => p.status === 'COMPLETED').length

    const totalTasks = tasks.length
    const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length
    const inProgressTasks = tasks.filter((t) => t.status === 'IN_PROGRESS').length

    const totalDocuments = documents.length
    const totalUsers = users.length
    const activeUsers = users.filter((u) => u.isActive).length

    // Финмодель как в /finance и на дашборде:
    // Выставлено = все INCOME; Получено = INCOME с isPaid; Прибыль = получено − расходы.
    const totalInvoiced = filteredFinances
      .filter((f) => f.type === 'INCOME')
      .reduce((sum, f) => sum + (Number(f.amount) || 0), 0)

    const totalReceived = filteredFinances
      .filter((f) => f.type === 'INCOME' && f.isPaid)
      .reduce((sum, f) => sum + (Number(f.amount) || 0), 0)

    const totalExpenses = filteredFinances
      .filter((f) => f.type === 'EXPENSE')
      .reduce((sum, f) => sum + (Number(f.amount) || 0), 0)

    const netProfit = totalReceived - totalExpenses
    const margin = totalReceived > 0 ? (netProfit / totalReceived) * 100 : 0

    const stats = {
      totalProjects,
      activeProjects,
      completedProjects,
      totalTasks,
      completedTasks,
      inProgressTasks,
      totalDocuments,
      totalUsers,
      activeUsers,
      totalInvoiced,
      totalReceived,
      totalExpenses,
      netProfit,
      margin: Math.round(margin * 10) / 10,
      recentProjects: filteredProjects.length,
      recentTasks: filteredTasks.length,
      recentDocuments: filteredDocuments.length,
      periodLabel: periodLabel(period),
    }

    return NextResponse.json({
      success: true,
      stats,
      projects: filteredProjects.slice(0, 10),
      tasks: filteredTasks.slice(0, 10),
      users: users.slice(0, 10),
      documents: filteredDocuments.slice(0, 10),
    })
  } catch (error) {
    console.error('Error fetching reports:', error)
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 })
  }
}

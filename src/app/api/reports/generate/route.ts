import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'
import { enqueueJob } from '@/lib/job-queue'
import { getReportDateRange, periodLabel, prismaDateFilter } from '@/lib/report-utils'
import * as XLSX from 'xlsx'

const MAX_REPORT_ROWS = 5000

export async function POST(request: NextRequest) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canExportReports')
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!allowed) {
      return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
    }
    if (!user.companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { reportType, period, startDate, endDate } = body
    const dateRange = getReportDateRange(period || 'all', startDate, endDate)
    const dateFilter = prismaDateFilter(dateRange)
    const createdAtFilter = dateFilter ? { createdAt: dateFilter } : undefined
    const financeDateFilter = dateFilter ? { date: dateFilter } : undefined

    return await enqueueJob(async () => {
    let reportData: Record<string, string | number>[] = []
    let fileName = ''
    let sheetName = ''

    switch (reportType) {
      case 'financial': {
        const finances = await prisma.finance.findMany({
          where: {
            project: { companyId: user.companyId! },
            ...(financeDateFilter || {}),
          },
          include: { project: { select: { name: true } } },
          orderBy: { date: 'desc' },
          take: MAX_REPORT_ROWS,
        })

        reportData = finances.map((f) => ({
          'Тип операции': f.type === 'INCOME' ? 'Доход' : 'Расход',
          'Категория': f.category,
          'Описание': f.description || 'Без описания',
          'Сумма (₽)': Number(f.amount).toLocaleString('ru-RU'),
          'Оплачен': f.isPaid ? 'Да' : 'Нет',
          'Дата операции': new Date(f.date).toLocaleDateString('ru-RU'),
          'Проект': f.project.name,
          'ID записи': f.id,
        }))
        fileName = `financial_report_${Date.now()}.xlsx`
        sheetName = 'Финансовый отчет'
        break
      }

      case 'projects': {
        const projects = await prisma.project.findMany({
          where: {
            companyId: user.companyId!,
            ...(createdAtFilter || {}),
          },
          include: { _count: { select: { tasks: true, documents: true } } },
          orderBy: { createdAt: 'desc' },
          take: MAX_REPORT_ROWS,
        })

        reportData = projects.map((p) => ({
          'Название проекта': p.name,
          'Описание': p.description || 'Без описания',
          'Статус': p.status,
          'Приоритет': p.priority,
          'Бюджет (₽)': Number(p.budget || 0).toLocaleString('ru-RU'),
          'Фактические затраты (₽)': Number(p.actualCost || 0).toLocaleString('ru-RU'),
          'Остаток бюджета (₽)': (Number(p.budget || 0) - Number(p.actualCost || 0)).toLocaleString('ru-RU'),
          'Количество задач': p._count.tasks,
          'Количество документов': p._count.documents,
          'Дата создания': new Date(p.createdAt).toLocaleDateString('ru-RU'),
          'ID проекта': p.id,
        }))
        fileName = `projects_report_${Date.now()}.xlsx`
        sheetName = 'Отчет по проектам'
        break
      }

      case 'users': {
        const users = await prisma.user.findMany({
          where: {
            companyId: user.companyId,
            ...(createdAtFilter || {}),
          },
          include: { _count: { select: { createdProjects: true, createdTasks: true } } },
          orderBy: { createdAt: 'desc' },
          take: MAX_REPORT_ROWS,
        })

        reportData = users.map((u) => ({
          'ФИО': u.name || 'Не указано',
          'Email': u.email,
          'Роль в системе': u.role,
          'Должность': u.position || 'Не указана',
          'Статус': u.isActive ? 'Активен' : 'Заблокирован',
          'Создано проектов': u._count.createdProjects,
          'Создано задач': u._count.createdTasks,
          'Дата регистрации': new Date(u.createdAt).toLocaleDateString('ru-RU'),
          'ID пользователя': u.id,
        }))
        fileName = `users_report_${Date.now()}.xlsx`
        sheetName = 'Отчет по пользователям'
        break
      }

      case 'documents': {
        const documents = await prisma.document.findMany({
          where: {
            project: { companyId: user.companyId! },
            ...(createdAtFilter || {}),
          },
          include: {
            project: { select: { name: true } },
            creator: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: MAX_REPORT_ROWS,
        })

        reportData = documents.map((d) => ({
          'Название документа': d.title,
          'Описание': d.description || 'Без описания',
          'Имя файла': d.fileName,
          'Размер файла (КБ)': Math.round(d.fileSize / 1024),
          'Тип файла': d.mimeType,
          'Версия документа': d.version,
          'Номер документа': d.documentNumber || 'Не присвоен',
          'Проект': d.project?.name || 'Без проекта',
          'Создатель': d.creator.name || 'Неизвестно',
          'Дата создания': new Date(d.createdAt).toLocaleDateString('ru-RU'),
          'ID документа': d.id,
        }))
        fileName = `documents_report_${Date.now()}.xlsx`
        sheetName = 'Отчет по документам'
        break
      }

      default:
        throw new Error('Invalid report type')
    }

    // Добавляем метаданные в начало отчета
    const metadata = [
      { 'Параметр': 'Тип отчета', 'Значение': sheetName },
      { 'Параметр': 'Дата генерации', 'Значение': new Date().toLocaleString('ru-RU') },
      { 'Параметр': 'Период', 'Значение': periodLabel(period || 'all') },
      { 'Параметр': 'Количество записей', 'Значение': reportData.length },
      { 'Параметр': '', 'Значение': '' }, // Пустая строка
    ]

    // Объединяем метаданные с данными отчета
    const fullReportData = [...metadata, ...reportData]

    // Создаем Excel файл с улучшенным форматированием
    const worksheet = XLSX.utils.json_to_sheet(fullReportData)
    
    // Настраиваем ширину колонок
    const colWidths: number[] = []
    if (fullReportData.length > 0) {
      const headers = Object.keys(fullReportData[0])
      headers.forEach((header, index) => {
        const maxLength = Math.max(
          header.length,
          ...fullReportData.map(row => String((row as any)[header] || '').length)
        )
        colWidths[index] = Math.min(Math.max(maxLength + 2, 10), 50)
      })
    }
    worksheet['!cols'] = colWidths.map(width => ({ wch: width }))

    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
    const dataStartRow = metadata.length

    // Стили для метаданных
    for (let row = 0; row < dataStartRow; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
        if (!worksheet[cellAddress]) continue
        
        worksheet[cellAddress].s = {
          font: { bold: true, size: 12 },
          fill: { fgColor: { rgb: "E8F4FD" } },
          alignment: { horizontal: "left", vertical: "center" },
          border: {
            top: { style: "thin", color: { rgb: "B0B0B0" } },
            bottom: { style: "thin", color: { rgb: "B0B0B0" } },
            left: { style: "thin", color: { rgb: "B0B0B0" } },
            right: { style: "thin", color: { rgb: "B0B0B0" } }
          }
        }
      }
    }

    // Стили для заголовков данных
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: dataStartRow, c: col })
      if (!worksheet[cellAddress]) continue
      
      worksheet[cellAddress].s = {
        font: { bold: true, color: { rgb: "FFFFFF" }, size: 12 },
        fill: { fgColor: { rgb: "366092" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "medium", color: { rgb: "000000" } },
          bottom: { style: "medium", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "FFFFFF" } },
          right: { style: "thin", color: { rgb: "FFFFFF" } }
        }
      }
    }

    // Стили для данных
    for (let row = dataStartRow + 1; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
        if (!worksheet[cellAddress]) continue
        
        worksheet[cellAddress].s = {
          alignment: { horizontal: "left", vertical: "center" },
          border: {
            top: { style: "thin", color: { rgb: "DDDDDD" } },
            bottom: { style: "thin", color: { rgb: "DDDDDD" } },
            left: { style: "thin", color: { rgb: "DDDDDD" } },
            right: { style: "thin", color: { rgb: "DDDDDD" } }
          }
        }
        
        // Чередующиеся цвета строк
        if ((row - dataStartRow) % 2 === 0) {
          worksheet[cellAddress].s.fill = { fgColor: { rgb: "F8F9FA" } }
        }
      }
    }

    // Замораживаем строку с заголовками данных
    worksheet['!freeze'] = { xSplit: 0, ySplit: dataStartRow + 1 }

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

    // Генерируем буфер
    const excelBuffer = XLSX.write(workbook, { 
      type: 'buffer', 
      bookType: 'xlsx',
      cellStyles: true
    })

    // Возвращаем файл
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`
      }
    })
    })

  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid report type') {
      return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
    }
    console.error('Error generating report:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-api'
import { verifyProjectCompanyAccess } from '@/lib/access-control'
import { prisma } from '@/lib/prisma'

// GET /api/projects/[id]/overview — счётчики разделов + единая лента активности проекта
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!(await verifyProjectCompanyAccess(user, params.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const projectId = params.id
    const now = new Date()

    // ——— счётчики ———
    const [tasksOverdue, approvalsPending, materialsMovements] = await Promise.all([
      prisma.task.count({
        where: {
          projectId,
          dueDate: { lt: now },
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
      }),
      prisma.approval.count({ where: { projectId, status: 'PENDING' } }),
      prisma.stockMovement.count({ where: { projectId, type: 'ISSUE' } }),
    ])

    // ——— события для ленты (берём немного из каждого источника, потом мержим) ———
    const [docs, approvals, finances, movements] = await Promise.all([
      prisma.document.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { id: true, title: true, createdAt: true, creator: { select: { name: true } } },
      }),
      prisma.approval.findMany({
        where: { projectId },
        orderBy: { updatedAt: 'desc' },
        take: 6,
        select: { id: true, title: true, status: true, updatedAt: true, creator: { select: { name: true } } },
      }),
      prisma.finance.findMany({
        where: { projectId },
        orderBy: { date: 'desc' },
        take: 6,
        select: { id: true, type: true, amount: true, date: true, description: true, isPaid: true },
      }),
      prisma.stockMovement.findMany({
        where: { projectId, type: 'ISSUE' },
        orderBy: { date: 'desc' },
        take: 6,
        select: { id: true, quantity: true, date: true, material: { select: { name: true, unit: true } } },
      }),
    ])

    type Item = {
      id: string
      kind: 'document' | 'approval' | 'finance' | 'material'
      date: string
      text: string
      actor: string | null
      amount: number | null
      positive: boolean
    }

    const items: Item[] = []

    for (const d of docs) {
      items.push({
        id: `doc_${d.id}`,
        kind: 'document',
        date: d.createdAt.toISOString(),
        text: `загрузил документ «${d.title}»`,
        actor: d.creator?.name || null,
        amount: null,
        positive: false,
      })
    }
    for (const a of approvals) {
      const t =
        a.status === 'APPROVED'
          ? `согласование «${a.title}» утверждено`
          : a.status === 'REJECTED'
            ? `согласование «${a.title}» отклонено`
            : `создал согласование «${a.title}»`
      items.push({
        id: `apr_${a.id}`,
        kind: 'approval',
        date: a.updatedAt.toISOString(),
        text: t,
        actor: a.creator?.name || null,
        amount: null,
        positive: a.status === 'APPROVED',
      })
    }
    for (const f of finances) {
      const income = f.type === 'INCOME'
      const label = income ? (f.isPaid ? 'Поступил платёж' : 'Начислен доход') : 'Расход'
      const desc = f.description
      items.push({
        id: `fin_${f.id}`,
        kind: 'finance',
        date: (f.date || now).toISOString(),
        text: desc ? `${label}: ${desc}` : label,
        actor: null,
        amount: Number(f.amount),
        positive: income,
      })
    }
    for (const m of movements) {
      items.push({
        id: `mov_${m.id}`,
        kind: 'material',
        date: m.date.toISOString(),
        text: `списано ${Number(m.quantity)} ${m.material?.unit || ''} ${m.material?.name || ''}`.trim(),
        actor: null,
        amount: null,
        positive: false,
      })
    }

    const activity = items
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8)

    return NextResponse.json({
      counts: { tasksOverdue, approvalsPending, materialsMovements },
      activity,
    })
  } catch (error) {
    console.error('Error fetching project overview:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

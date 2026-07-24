import { prisma } from './prisma'
import { hasPermission, UserRole } from './permissions'

export interface CompanyAccessUser {
  companyId: string | null
}

/**
 * Может ли пользователь править задачу (и её подзадачи/содержимое):
 * - полные редакторы (canAssignTasks: Владелец/Админ/Руководитель проекта) — любые задачи;
 * - Сотрудник/Подрядчик — только свои (создатель или исполнитель);
 * - Заказчик (нет доступа к задачам) — нет.
 */
export async function userCanEditTask(
  user: { id: string; role: string },
  taskId: string
): Promise<boolean> {
  if (hasPermission(user.role as UserRole, 'canAssignTasks')) return true
  if (!hasPermission(user.role as UserRole, 'canViewAllTasks')) return false
  const own = await prisma.task.findFirst({
    where: {
      id: taskId,
      OR: [{ creatorId: user.id }, { assignments: { some: { userId: user.id } } }],
    },
    select: { id: true },
  })
  return !!own
}

export async function verifyTaskCompanyAccess(
  user: CompanyAccessUser,
  taskId: string
): Promise<boolean> {
  if (!user.companyId) return false
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      OR: [
        { companyId: user.companyId },
        { project: { companyId: user.companyId } },
      ],
    },
    select: { id: true },
  })
  return !!task
}

export async function verifyFinanceCompanyAccess(
  user: CompanyAccessUser,
  financeId: string
): Promise<boolean> {
  if (!user.companyId) return false
  const record = await prisma.finance.findFirst({
    where: {
      id: financeId,
      OR: [
        { companyId: user.companyId },
        { project: { companyId: user.companyId } },
      ],
    },
    select: { id: true },
  })
  return !!record
}

export async function verifyUserCompanyAccess(
  user: CompanyAccessUser,
  targetUserId: string
): Promise<boolean> {
  if (!user.companyId) return false
  const target = await prisma.user.findFirst({
    where: { id: targetUserId, companyId: user.companyId },
    select: { id: true },
  })
  return !!target
}

export async function verifyProjectCompanyAccess(
  user: CompanyAccessUser,
  projectId: string
): Promise<boolean> {
  if (!user.companyId) return false
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: user.companyId },
    select: { id: true },
  })
  return !!project
}

export async function verifyApprovalCompanyAccess(
  user: CompanyAccessUser,
  approvalId: string
): Promise<boolean> {
  if (!user.companyId) return false
  const approval = await prisma.approval.findFirst({
    where: { id: approvalId, companyId: user.companyId },
    select: { id: true },
  })
  return !!approval
}

export async function verifyEstimateAccess(
  user: CompanyAccessUser,
  projectId: string,
  estimateId: string
): Promise<boolean> {
  if (!user.companyId) return false
  const estimate = await prisma.estimate.findFirst({
    where: {
      id: estimateId,
      projectId,
      project: { companyId: user.companyId },
    },
    select: { id: true },
  })
  return !!estimate
}

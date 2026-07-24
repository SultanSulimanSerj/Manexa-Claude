// Человекочитаемые названия ролей компании (единый источник для UI).
// Значения enum в БД не меняем — MANAGER/USER остаются, меняются только подписи.

export const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Владелец',
  ADMIN: 'Администратор',
  MANAGER: 'Руководитель проекта',
  USER: 'Сотрудник',
  CONTRACTOR: 'Подрядчик',
  CLIENT: 'Заказчик',
}

export const ROLE_DESCRIPTIONS: Record<string, string> = {
  OWNER: 'Полный доступ, включая биллинг, компанию и пользователей',
  ADMIN: 'Всё, кроме удаления пользователей и смены владельца',
  MANAGER: 'Полный доступ по проектам, кроме пользователей и настроек компании',
  USER: 'Работа по назначенным проектам (без финансов)',
  CONTRACTOR: 'Внешний: задачи, документы, согласования, чат. Без финансов',
  CLIENT: 'Внешний: график, документы, согласования, чат своего проекта',
}

export const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-800',
  ADMIN: 'bg-red-100 text-red-800',
  MANAGER: 'bg-blue-100 text-blue-800',
  USER: 'bg-gray-100 text-gray-800',
  CONTRACTOR: 'bg-amber-100 text-amber-800',
  CLIENT: 'bg-teal-100 text-teal-800',
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] || role
}

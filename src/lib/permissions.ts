// Система ролевого доступа (RBAC)
export enum UserRole {
  PLATFORM_ADMIN = 'PLATFORM_ADMIN',
  PLATFORM_MANAGER = 'PLATFORM_MANAGER',
  OWNER = 'OWNER',
  ADMIN = 'ADMIN', 
  MANAGER = 'MANAGER',
  USER = 'USER'
}

// Платформенные роли: администрирование платформы, не принадлежат компаниям
export const PLATFORM_ROLES: UserRole[] = [UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_MANAGER]

export function isPlatformRole(role: UserRole | string): boolean {
  return role === UserRole.PLATFORM_ADMIN || role === UserRole.PLATFORM_MANAGER
}

export enum ProjectRole {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER', 
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER'
}

// Права доступа
export interface Permissions {
  // Управление пользователями
  canManageUsers: boolean
  canCreateUsers: boolean
  canEditUsers: boolean
  canDeleteUsers: boolean
  canChangeUserRoles: boolean
  
  // Управление компанией
  canManageCompany: boolean
  canViewCompanySettings: boolean
  canEditCompanySettings: boolean
  
  // Проекты
  canCreateProjects: boolean
  canEditProjects: boolean
  canDeleteProjects: boolean
  canViewAllProjects: boolean
  canManageProjectMembers: boolean
  canViewProjects: boolean
  canEditProjectClientRequisites: boolean
  
  // Задачи
  canCreateTasks: boolean
  canEditTasks: boolean
  canDeleteTasks: boolean
  canAssignTasks: boolean
  canViewAllTasks: boolean
  
  // Документы
  canCreateDocuments: boolean
  canEditDocuments: boolean
  canDeleteDocuments: boolean
  canViewAllDocuments: boolean
  canApproveDocuments: boolean
  
  // Финансы
  canViewFinances: boolean
  canCreateFinances: boolean
  canEditFinances: boolean
  canDeleteFinances: boolean
  canViewFinancialReports: boolean
  
  // Сметы
  canViewEstimates: boolean
  canCreateEstimates: boolean
  canEditEstimates: boolean
  canDeleteEstimates: boolean
  
  // Согласования
  canCreateApprovals: boolean
  canEditApprovals: boolean
  canDeleteApprovals: boolean
  canRespondToApprovals: boolean
  canViewAllApprovals: boolean
  
  // Отчеты
  canViewReports: boolean
  canExportReports: boolean
  
  // Системные настройки
  canViewSystemSettings: boolean
  canEditSystemSettings: boolean

  // Платформа (администрирование Manexa)
  canManagePlatform: boolean
  canManagePlatformManagers: boolean
  canImpersonate: boolean
}

// Базовый набор: всё запрещено (используется для платформенных ролей)
const NO_PERMISSIONS: Permissions = {
  canManageUsers: false,
  canCreateUsers: false,
  canEditUsers: false,
  canDeleteUsers: false,
  canChangeUserRoles: false,
  canManageCompany: false,
  canViewCompanySettings: false,
  canEditCompanySettings: false,
  canCreateProjects: false,
  canEditProjects: false,
  canDeleteProjects: false,
  canViewAllProjects: false,
  canManageProjectMembers: false,
  canViewProjects: false,
  canEditProjectClientRequisites: false,
  canCreateTasks: false,
  canEditTasks: false,
  canDeleteTasks: false,
  canAssignTasks: false,
  canViewAllTasks: false,
  canCreateDocuments: false,
  canEditDocuments: false,
  canDeleteDocuments: false,
  canViewAllDocuments: false,
  canApproveDocuments: false,
  canViewFinances: false,
  canCreateFinances: false,
  canEditFinances: false,
  canDeleteFinances: false,
  canViewFinancialReports: false,
  canViewEstimates: false,
  canCreateEstimates: false,
  canEditEstimates: false,
  canDeleteEstimates: false,
  canCreateApprovals: false,
  canEditApprovals: false,
  canDeleteApprovals: false,
  canRespondToApprovals: false,
  canViewAllApprovals: false,
  canViewReports: false,
  canExportReports: false,
  canViewSystemSettings: false,
  canEditSystemSettings: false,
  canManagePlatform: false,
  canManagePlatformManagers: false,
  canImpersonate: false,
}

// Определение прав для каждой роли
export const ROLE_PERMISSIONS: Record<UserRole, Permissions> = {
  // Платформенные роли: доступ только к /platform, права компаний — все false
  [UserRole.PLATFORM_ADMIN]: {
    ...NO_PERMISSIONS,
    canManagePlatform: true,
    canManagePlatformManagers: true,
    canImpersonate: true,
  },

  [UserRole.PLATFORM_MANAGER]: {
    ...NO_PERMISSIONS,
    canManagePlatform: true,
    canManagePlatformManagers: false,
    canImpersonate: false, // только PLATFORM_ADMIN
  },

  [UserRole.OWNER]: {
    // Полные права
    canManageUsers: true,
    canCreateUsers: true,
    canEditUsers: true,
    canDeleteUsers: true,
    canChangeUserRoles: true,
    
    canManageCompany: true,
    canViewCompanySettings: true,
    canEditCompanySettings: true,
    
    canCreateProjects: true,
    canEditProjects: true,
    canDeleteProjects: true,
    canViewAllProjects: true,
    canManageProjectMembers: true,
    canViewProjects: true,
    canEditProjectClientRequisites: true,
    
    canCreateTasks: true,
    canEditTasks: true,
    canDeleteTasks: true,
    canAssignTasks: true,
    canViewAllTasks: true,
    
    canCreateDocuments: true,
    canEditDocuments: true,
    canDeleteDocuments: true,
    canViewAllDocuments: true,
    canApproveDocuments: true,
    
    canViewFinances: true,
    canCreateFinances: true,
    canEditFinances: true,
    canDeleteFinances: true,
    canViewFinancialReports: true,
    
    canViewEstimates: true,
    canCreateEstimates: true,
    canEditEstimates: true,
    canDeleteEstimates: true,
    
    canCreateApprovals: true,
    canEditApprovals: true,
    canDeleteApprovals: true,
    canRespondToApprovals: true,
    canViewAllApprovals: true,
    
    canViewReports: true,
    canExportReports: true,
    
    canViewSystemSettings: true,
    canEditSystemSettings: true,

    canManagePlatform: false,
    canManagePlatformManagers: false,
    canImpersonate: false
  },
  
  [UserRole.ADMIN]: {
    // Почти полные права, кроме удаления пользователей и изменения роли OWNER
    canManageUsers: true,
    canCreateUsers: true,
    canEditUsers: true,
    canDeleteUsers: false, // Не может удалять пользователей
    canChangeUserRoles: false, // Не может изменять роль OWNER
    
    canManageCompany: true,
    canViewCompanySettings: true,
    canEditCompanySettings: true,
    
    canCreateProjects: true,
    canEditProjects: true,
    canDeleteProjects: true,
    canViewAllProjects: true,
    canManageProjectMembers: true,
    canViewProjects: true,
    canEditProjectClientRequisites: true,
    
    canCreateTasks: true,
    canEditTasks: true,
    canDeleteTasks: true,
    canAssignTasks: true,
    canViewAllTasks: true,
    
    canCreateDocuments: true,
    canEditDocuments: true,
    canDeleteDocuments: true,
    canViewAllDocuments: true,
    canApproveDocuments: true,
    
    canViewFinances: true,
    canCreateFinances: true,
    canEditFinances: true,
    canDeleteFinances: true,
    canViewFinancialReports: true,
    
    canViewEstimates: true,
    canCreateEstimates: true,
    canEditEstimates: true,
    canDeleteEstimates: true,
    
    canCreateApprovals: true,
    canEditApprovals: true,
    canDeleteApprovals: true,
    canRespondToApprovals: true,
    canViewAllApprovals: true,
    
    canViewReports: true,
    canExportReports: true,
    
    canViewSystemSettings: true,
    canEditSystemSettings: false, // Не может изменять системные настройки

    canManagePlatform: false,
    canManagePlatformManagers: false,
    canImpersonate: false
  },
  
  [UserRole.MANAGER]: {
    // Управление проектами, но не пользователями системы
    canManageUsers: false,
    canCreateUsers: false,
    canEditUsers: false,
    canDeleteUsers: false,
    canChangeUserRoles: false,
    
    canManageCompany: false,
    canViewCompanySettings: false,
    canEditCompanySettings: false,
    
    canCreateProjects: true,
    canEditProjects: true,
    canDeleteProjects: false, // Только архивирование
    canViewAllProjects: true,
    canManageProjectMembers: true,
    canViewProjects: true,
    canEditProjectClientRequisites: true,
    
    canCreateTasks: true,
    canEditTasks: true,
    canDeleteTasks: true,
    canAssignTasks: true,
    canViewAllTasks: true,
    
    canCreateDocuments: true,
    canEditDocuments: true,
    canDeleteDocuments: true,
    canViewAllDocuments: true,
    canApproveDocuments: true,
    
    canViewFinances: true,
    canCreateFinances: true, // Может создавать расходы
    canEditFinances: true,
    canDeleteFinances: false,
    canViewFinancialReports: true,
    
    canViewEstimates: true,
    canCreateEstimates: true,
    canEditEstimates: true,
    canDeleteEstimates: false,
    
    canCreateApprovals: true,
    canEditApprovals: true,
    canDeleteApprovals: false,
    canRespondToApprovals: true,
    canViewAllApprovals: true,
    
    canViewReports: true,
    canExportReports: true,
    
    canViewSystemSettings: false,
    canEditSystemSettings: false,

    canManagePlatform: false,
    canManagePlatformManagers: false,
    canImpersonate: false
  },
  
  [UserRole.USER]: {
    // Ограниченные права
    canManageUsers: false,
    canCreateUsers: false,
    canEditUsers: false,
    canDeleteUsers: false,
    canChangeUserRoles: false,
    
    canManageCompany: false,
    canViewCompanySettings: false,
    canEditCompanySettings: false,
    
    canCreateProjects: false,
    canEditProjects: false,
    canDeleteProjects: false,
    canViewAllProjects: true, // Может видеть проекты, где является участником
    canManageProjectMembers: false,
    canViewProjects: true,
    canEditProjectClientRequisites: true, // Может редактировать реквизиты клиента!
    
    canCreateTasks: false,
    canEditTasks: false, // Только свои задачи
    canDeleteTasks: false,
    canAssignTasks: false,
    canViewAllTasks: true, // Может видеть задачи в доступных проектах
    
    canCreateDocuments: true,
    canEditDocuments: false, // Только свои документы
    canDeleteDocuments: false,
    canViewAllDocuments: true, // Может видеть документы в доступных проектах
    canApproveDocuments: false,
    
    canViewFinances: true, // Может видеть финансы в доступных проектах
    canCreateFinances: false,
    canEditFinances: false,
    canDeleteFinances: false,
    canViewFinancialReports: false,
    
    canViewEstimates: true, // Только просмотр
    canCreateEstimates: false,
    canEditEstimates: false,
    canDeleteEstimates: false,
    
    canCreateApprovals: true,
    canEditApprovals: false, // Только свои согласования
    canDeleteApprovals: false,
    canRespondToApprovals: true,
    canViewAllApprovals: true, // Может видеть согласования в доступных проектах
    
    canViewReports: false,
    canExportReports: false,
    
    canViewSystemSettings: false,
    canEditSystemSettings: false,

    canManagePlatform: false,
    canManagePlatformManagers: false,
    canImpersonate: false
  }
}

// Права на уровне проекта
export const PROJECT_ROLE_PERMISSIONS: Record<ProjectRole, Partial<Permissions>> = {
  [ProjectRole.OWNER]: {
    canManageProjectMembers: true,
    canEditProjects: true,
    canDeleteProjects: true,
    canCreateTasks: true,
    canEditTasks: true,
    canDeleteTasks: true,
    canAssignTasks: true,
    canCreateDocuments: true,
    canEditDocuments: true,
    canDeleteDocuments: true,
    canViewFinances: true,
    canCreateFinances: true,
    canEditFinances: true,
    canDeleteFinances: true,
    canCreateApprovals: true,
    canEditApprovals: true,
    canDeleteApprovals: true
  },
  
  [ProjectRole.MANAGER]: {
    canManageProjectMembers: true,
    canEditProjects: true,
    canDeleteProjects: false,
    canCreateTasks: true,
    canEditTasks: true,
    canDeleteTasks: true,
    canAssignTasks: true,
    canCreateDocuments: true,
    canEditDocuments: true,
    canDeleteDocuments: true,
    canViewFinances: true,
    canCreateFinances: true,
    canEditFinances: true,
    canDeleteFinances: false,
    canCreateApprovals: true,
    canEditApprovals: true,
    canDeleteApprovals: false
  },
  
  [ProjectRole.MEMBER]: {
    canManageProjectMembers: false,
    canEditProjects: false,
    canDeleteProjects: false,
    canCreateTasks: false,
    canEditTasks: false,
    canDeleteTasks: false,
    canAssignTasks: false,
    canCreateDocuments: true,
    canEditDocuments: false,
    canDeleteDocuments: false,
    canViewFinances: false,
    canCreateFinances: false,
    canEditFinances: false,
    canDeleteFinances: false,
    canCreateApprovals: true,
    canEditApprovals: false,
    canDeleteApprovals: false
  },
  
  [ProjectRole.VIEWER]: {
    canManageProjectMembers: false,
    canEditProjects: false,
    canDeleteProjects: false,
    canCreateTasks: false,
    canEditTasks: false,
    canDeleteTasks: false,
    canAssignTasks: false,
    canCreateDocuments: false,
    canEditDocuments: false,
    canDeleteDocuments: false,
    canViewFinances: false,
    canCreateFinances: false,
    canEditFinances: false,
    canDeleteFinances: false,
    canCreateApprovals: false,
    canEditApprovals: false,
    canDeleteApprovals: false
  }
}

// Функция для получения прав пользователя
export function getUserPermissions(userRole: UserRole, projectRole?: ProjectRole): Permissions {
  const basePermissions = ROLE_PERMISSIONS[userRole]
  
  // Если есть роль в проекте, объединяем права
  if (projectRole) {
    const projectPermissions = PROJECT_ROLE_PERMISSIONS[projectRole]
    return {
      ...basePermissions,
      ...projectPermissions
    } as Permissions
  }
  
  return basePermissions
}

// Функция для проверки конкретного права
export function hasPermission(
  userRole: UserRole, 
  permission: keyof Permissions, 
  projectRole?: ProjectRole
): boolean {
  const permissions = getUserPermissions(userRole, projectRole)
  return permissions[permission] || false
}

// Функция для проверки множественных прав (все должны быть true)
export function hasAllPermissions(
  userRole: UserRole,
  permissions: (keyof Permissions)[],
  projectRole?: ProjectRole
): boolean {
  return permissions.every(permission => hasPermission(userRole, permission, projectRole))
}

// Функция для проверки множественных прав (хотя бы одно должно быть true)
export function hasAnyPermission(
  userRole: UserRole,
  permissions: (keyof Permissions)[],
  projectRole?: ProjectRole
): boolean {
  return permissions.some(permission => hasPermission(userRole, permission, projectRole))
}

// Функция для получения доступных разделов навигации
export function getAvailableNavigationSections(userRole: UserRole): string[] {
  const permissions = ROLE_PERMISSIONS[userRole]
  const sections: string[] = ['dashboard', 'projects', 'tasks', 'documents', 'approvals']
  
  if (permissions.canManageUsers) {
    sections.push('users')
  }
  
  if (permissions.canViewReports) {
    sections.push('reports')
  }
  
  if (permissions.canViewSystemSettings) {
    sections.push('settings')
  }
  
  return sections
}

// Функция для проверки доступа к проекту
export function canAccessProject(
  userRole: UserRole,
  projectRole?: ProjectRole,
  isProjectOwner?: boolean
): boolean {
  // OWNER и ADMIN могут видеть все проекты
  if (userRole === UserRole.OWNER || userRole === UserRole.ADMIN) {
    return true
  }
  
  // MANAGER может видеть проекты, где является участником
  if (userRole === UserRole.MANAGER) {
    return projectRole !== undefined || isProjectOwner || false
  }
  
  // USER может видеть только проекты, где является участником
  if (userRole === UserRole.USER) {
    return projectRole !== undefined || isProjectOwner || false
  }
  
  return false
}

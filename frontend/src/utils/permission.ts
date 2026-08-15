import { getCurrentUser } from '../api/session'

/** Permission code -> label mapping (resource:action format) */
export const PERMISSION_LABELS: Record<string, string> = {
  'kb:manage': 'Knowledge Base - Manage',
  'kb:read': 'Knowledge Base - View',
  'document:upload': 'Document - Upload',
  'document:read': 'Document - View',
  'document:manage': 'Document - Manage',
  'qa:ask': 'Q&A - Ask',
  'eval:run': 'Evaluation - Run',
  'eval:read': 'Evaluation - View',
  admin: 'System Administrator',
}

/** All configurable permissions (grouped by resource, for selection when editing roles) */
export const PERMISSION_GROUPS: { group: string; items: string[] }[] = [
  { group: 'Knowledge Base', items: ['kb:manage', 'kb:read'] },
  { group: 'Document', items: ['document:upload', 'document:read', 'document:manage'] },
  { group: 'Q&A', items: ['qa:ask'] },
  { group: 'Evaluation', items: ['eval:run', 'eval:read'] },
  { group: 'System', items: ['admin'] },
]

/** Get the label for a permission code; unknown codes are returned as-is */
export function getPermissionLabel(code: string): string {
  return PERMISSION_LABELS[code] ?? code
}

/** Get all permissions of the currently logged-in user (backend /me already merges permissions from all roles) */
export function getUserPermissions(): string[] {
  const user = getCurrentUser()
  if (!user) return []
  return user.permissions ?? []
}

/** Check whether the current user has the specified permission */
export function hasPermission(permission: string): boolean {
  return getUserPermissions().includes(permission)
}

/** Check whether the current user has any of the specified permissions */
export function hasAnyPermission(permissions: string[]): boolean {
  const userPerms = getUserPermissions()
  return permissions.some((p) => userPerms.includes(p))
}

/** Check whether the current user has all of the specified permissions */
export function hasAllPermissions(permissions: string[]): boolean {
  const userPerms = getUserPermissions()
  return permissions.every((p) => userPerms.includes(p))
}

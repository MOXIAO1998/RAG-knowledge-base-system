import type { User, Role } from '../types'

export const roles: Role[] = [
  {
    id: 1,
    name: 'System Administrator',
    description: 'Full system permissions; can manage all knowledge bases, users, and system configuration',
    permissions: [
      'kb:manage',
      'kb:read',
      'document:upload',
      'document:read',
      'document:manage',
      'qa:ask',
      'eval:run',
      'eval:read',
      'admin',
    ],
  },
  {
    id: 2,
    name: 'Knowledge Base Administrator',
    description: 'Manages assigned knowledge bases and their documents, with read and write permissions',
    permissions: [
      'kb:manage',
      'kb:read',
      'document:upload',
      'document:read',
      'document:manage',
      'qa:ask',
    ],
  },
  {
    id: 3,
    name: 'Regular User',
    description: 'Q&A and read-only permissions',
    permissions: ['kb:read', 'document:read', 'qa:ask'],
  },
]

export const users: User[] = [
  { id: 1, username: 'admin', email: 'admin@company.com', status: 'active', roles: ['System Administrator'], lastLogin: '2026-07-24 09:15:00' },
  { id: 2, username: 'zhangsan', email: 'zhangsan@company.com', status: 'active', roles: ['Knowledge Base Administrator'], lastLogin: '2026-07-24 08:42:00' },
  { id: 3, username: 'lisi', email: 'lisi@company.com', status: 'active', roles: ['Regular User'], lastLogin: '2026-07-23 17:30:00' },
  { id: 4, username: 'wangwu', email: 'wangwu@company.com', status: 'active', roles: ['Knowledge Base Administrator'], lastLogin: '2026-07-23 16:10:00' },
  { id: 5, username: 'zhaoliu', email: 'zhaoliu@company.com', status: 'disabled', roles: ['Regular User'], lastLogin: '2026-06-15 11:00:00' },
  { id: 6, username: 'sunqi', email: 'sunqi@company.com', status: 'active', roles: ['Regular User'], lastLogin: '2026-07-24 07:55:00' },
  { id: 7, username: 'zhouba', email: 'zhouba@company.com', status: 'active', roles: ['Knowledge Base Administrator', 'Regular User'], lastLogin: '2026-07-24 10:01:00' },
]

// Dynamic current user (can be switched after login)
// Restored from localStorage to avoid losing the login state on refresh, which would cause the guard to wrongly redirect to the login page
const STORAGE_KEY = 'rag_current_user'

function restoreUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

let _currentUser: User | null = restoreUser()

export function getCurrentUser(): User | null {
  return _currentUser
}

export function setCurrentUser(user: User | null): void {
  _currentUser = user
  // In the mock phase we persist the entire user object; when connecting to the backend, only the token should be stored
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // Ignore storage exceptions (e.g. private browsing mode)
  }
}

// Login result: distinguishes "invalid credentials" from "account disabled"
export type AuthResult =
  | { ok: true; user: User }
  | { ok: false; reason: 'invalid' | 'disabled' }

export function authUser(username: string, password: string): AuthResult {
  // Simulated login; any non-empty password passes
  if (password.length === 0) return { ok: false, reason: 'invalid' }
  const u = users.find((usr) => usr.username === username)
  if (!u) return { ok: false, reason: 'invalid' }
  // Disabled accounts are not allowed to log in
  if (u.status !== 'active') return { ok: false, reason: 'disabled' }
  return { ok: true, user: u }
}

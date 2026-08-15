// Login session management: persists the token and current user (localStorage).
// Replaces the getCurrentUser/setCurrentUser semantics originally in mock/users.
import type { User } from '../types'

/** The user returned by the backend /auth/me additionally carries the merged list of permission codes */
export interface SessionUser extends User {
  permissions: string[]
}

const TOKEN_KEY = 'rag_token'
const REFRESH_KEY = 'rag_refresh_token'
const USER_KEY = 'rag_current_user'

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY)
  } catch {
    return null
  }
}

export function getCurrentUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as SessionUser) : null
  } catch {
    return null
  }
}

/** Save the login state: token + refreshToken + user object */
export function setSession(token: string, refreshToken: string, user: SessionUser): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(REFRESH_KEY, refreshToken)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {
    // Ignore storage exceptions (e.g. private browsing mode)
  }
}

/** Update only the current user object (e.g. after refreshing /me) */
export function setCurrentUser(user: SessionUser | null): void {
  try {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(USER_KEY)
    }
  } catch {
    // Ignore
  }
}

/** Clear the login state (called on logout or when the token becomes invalid) */
export function clearSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(USER_KEY)
  } catch {
    // Ignore
  }
}

export function isLoggedIn(): boolean {
  return !!getToken() && !!getCurrentUser()
}

// Business API: maps one-to-one to the backend FastAPI routes. Responses are already unwrapped to data by the http layer.
import { http } from './http'
import { setSession, setCurrentUser, clearSession, getToken } from './session'
import type { SessionUser } from './session'
import type {
  KnowledgeBase,
  KbMember,
  DocumentItem,
  Chunk,
  Conversation,
  TaskItem,
  EvalRun,
  AuditLog,
  Role,
  User,
  Citation,
} from '../types'

// ==================== Authentication ====================
interface LoginResult {
  token: string
  refreshToken: string
  user: SessionUser
}

export const authApi = {
  async login(username: string, password: string): Promise<SessionUser> {
    const data = await http.post<LoginResult>('/auth/login', { username, password })
    setSession(data.token, data.refreshToken, data.user)
    return data.user
  },
  async register(username: string, email: string, password: string): Promise<SessionUser> {
    const data = await http.post<LoginResult>('/auth/register', { username, email, password })
    setSession(data.token, data.refreshToken, data.user)
    return data.user
  },
  async me(): Promise<SessionUser> {
    const user = await http.get<SessionUser>('/auth/me')
    setCurrentUser(user)
    return user
  },
  logout(): void {
    clearSession()
  },
}

// ==================== Knowledge Base ====================
export const kbApi = {
  list: () => http.get<KnowledgeBase[]>('/kb'),
  create: (body: { name: string; description?: string; visibility?: string }) =>
    http.post<KnowledgeBase>('/kb', body),
  update: (id: number, body: Partial<{ name: string; description: string; visibility: string }>) =>
    http.put<KnowledgeBase>(`/kb/${id}`, body),
  remove: (id: number) => http.del<null>(`/kb/${id}`),
  listMembers: (id: number) => http.get<KbMember[]>(`/kb/${id}/members`),
  addMember: (id: number, userId: number, accessLevel: string) =>
    http.post<KbMember>(`/kb/${id}/members`, { userId, accessLevel }),
  removeMember: (id: number, userId: number) => http.del<null>(`/kb/${id}/members/${userId}`),
}

// ==================== Documents ====================
export const docApi = {
  list: (kbId?: number) => http.get<DocumentItem[]>(kbId ? `/documents?kbId=${kbId}` : '/documents'),
  get: (id: number) => http.get<DocumentItem>(`/documents/${id}`),
  chunks: (id: number) => http.get<Chunk[]>(`/documents/${id}/chunks`),
  upload: (kbId: number, file: File, permissionTags = '') => {
    const form = new FormData()
    form.append('file', file)
    form.append('permissionTags', permissionTags)
    return http.postForm<{ document: DocumentItem; taskId: string }>(`/kb/${kbId}/documents`, form)
  },
  reindex: (id: number) => http.post<{ taskId: string }>(`/documents/${id}/reindex`),
  remove: (id: number) => http.del<null>(`/documents/${id}`),
}

// ==================== Conversation History ====================
export const conversationApi = {
  list: () => http.get<Conversation[]>('/conversations'),
  get: (id: number) => http.get<Conversation>(`/conversations/${id}`),
  remove: (id: number) => http.del<null>(`/conversations/${id}`),
}

// ==================== Task Center ====================
export const taskApi = {
  list: () => http.get<TaskItem[]>('/tasks'),
  get: (taskId: string) => http.get<TaskItem>(`/tasks/${taskId}`),
  retry: (taskId: string) => http.post<{ taskId: string }>(`/tasks/${taskId}/retry`),
}

// ==================== Administration (Users / Roles / Audit / Config) ====================
export interface SystemConfigData {
  cache: { ttlSeconds: number; similarityThreshold: number; maxCacheSize: number }
  rateLimit: { userPerMinute: number; qaPerMinute: number; uploadPerMinute: number; llmConcurrency: number }
}

export const adminApi = {
  listUsers: () => http.get<User[]>('/admin/users'),
  createUser: (body: { username: string; email?: string; password: string; roles?: string[] }) =>
    http.post<User>('/admin/users', body),
  updateUser: (id: number, body: { status?: string; roles?: string[] }) =>
    http.put<User>(`/admin/users/${id}`, body),
  listRoles: () => http.get<Role[]>('/admin/roles'),
  createRole: (body: { name: string; description?: string; permissions?: string[] }) =>
    http.post<Role>('/admin/roles', body),
  updateRole: (id: number, body: { description?: string; permissions?: string[] }) =>
    http.put<Role>(`/admin/roles/${id}`, body),
  auditLogs: (keyword?: string) =>
    http.get<AuditLog[]>(keyword ? `/admin/audit-logs?keyword=${encodeURIComponent(keyword)}` : '/admin/audit-logs'),
  getConfig: () => http.get<SystemConfigData>('/admin/config'),
  updateConfig: (body: Partial<SystemConfigData>) => http.put<SystemConfigData>('/admin/config', body),
}

// ==================== Dashboard ====================
export interface DashboardStats {
  totalKbs: number
  totalDocs: number
  readyDocs: number
  failedDocs: number
  todayQAs: number
  cacheHitRate: number
  recentConversations: Conversation[]
  runningTasks: TaskItem[]
  latestEval: EvalRun | null
}

export const dashboardApi = {
  stats: () => http.get<DashboardStats>('/dashboard/stats'),
}

// ==================== Q&A (SSE streaming) ====================
export interface QaStreamEvent {
  type: 'routing' | 'retrieving' | 'stage' | 'generating' | 'token' | 'restart' | 'citations' | 'done' | 'error'
  kbs?: { id: number; name: string }[]
  stage?: string
  delta?: string
  citations?: Citation[]
  conversationId?: number
  messageId?: number
  message?: string
}

export interface QaStreamHandlers {
  onEvent: (e: QaStreamEvent) => void
  onError?: (err: Error) => void
  onClose?: () => void
}

/**
 * Initiate an SSE streaming Q&A. Uses fetch + ReadableStream to parse text/event-stream,
 * so that the Authorization header can be included (EventSource cannot set custom headers).
 * Returns an abort function used to interrupt the stream.
 */
export function qaStream(
  body: { query: string; conversationId?: number | null; kbId?: number | null },
  handlers: QaStreamHandlers,
): () => void {
  const controller = new AbortController()
  const token = getToken()

  ;(async () => {
    try {
      const resp = await fetch('/api/qa/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!resp.ok || !resp.body) {
        // Error responses are usually JSON {code,message}
        let msg = `Q&A request failed (HTTP ${resp.status})`
        try {
          const j = await resp.json()
          msg = j.message || msg
        } catch {
          /* ignore */
        }
        handlers.onError?.(new Error(msg))
        return
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // Split by SSE event separator (blank line)
        let idx: number
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const raw = buffer.slice(0, idx)
          buffer = buffer.slice(idx + 2)
          const line = raw.split('\n').find((l) => l.startsWith('data:'))
          if (!line) continue
          const payload = line.slice(5).trim()
          if (!payload) continue
          try {
            handlers.onEvent(JSON.parse(payload) as QaStreamEvent)
          } catch {
            /* Ignore chunks that fail to parse */
          }
        }
      }
      handlers.onClose?.()
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      handlers.onError?.(err as Error)
    }
  })()

  return () => controller.abort()
}

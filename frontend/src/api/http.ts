// HTTP client: uniformly wraps fetch, automatically attaches the token, unwraps {code,message,data}, and handles 401.
import { getToken, clearSession } from './session'

const BASE = '/api'

export interface ApiErrorShape {
  code: number
  message: string
  status: number
}

/** Business error: thrown on a non-zero code or an HTTP error */
export class ApiError extends Error {
  code: number
  status: number
  constructor(message: string, code: number, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** On 401, clear the login state and redirect to the login page */
function handleUnauthorized() {
  clearSession()
  if (!location.pathname.startsWith('/login')) {
    location.href = '/login'
  }
}

interface RequestOptions {
  method?: string
  body?: unknown
  /** Do not set the JSON header when passing FormData */
  isForm?: boolean
  signal?: AbortSignal
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, isForm = false, signal } = opts
  const headers: Record<string, string> = { ...authHeaders() }
  let payload: BodyInit | undefined

  if (body !== undefined) {
    if (isForm) {
      payload = body as FormData
    } else {
      headers['Content-Type'] = 'application/json'
      payload = JSON.stringify(body)
    }
  }

  let resp: Response
  try {
    resp = await fetch(BASE + path, { method, headers, body: payload, signal })
  } catch (e) {
    throw new ApiError('Network request failed. Please check whether the backend service is running.', -1, 0)
  }

  if (resp.status === 401) {
    handleUnauthorized()
    throw new ApiError('Your session has expired. Please log in again.', 1, 401)
  }

  let json: { code: number; message: string; data: T } | null = null
  try {
    json = await resp.json()
  } catch {
    throw new ApiError(`The server returned an unexpected response (HTTP ${resp.status})`, 1, resp.status)
  }

  if (!json) {
    throw new ApiError(`The server returned no response body (HTTP ${resp.status})`, 1, resp.status)
  }

  if (json.code !== 0) {
    throw new ApiError(json.message || 'Request failed', json.code, resp.status)
  }

  return json.data
}

export const http = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { method: 'GET', signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  del: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body }),
  postForm: <T>(path: string, form: FormData) =>
    request<T>(path, { method: 'POST', body: form, isForm: true }),
}

export { BASE as API_BASE, authHeaders }

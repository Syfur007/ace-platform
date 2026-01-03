import { getApiBaseUrl } from '@/api/config'
import { getPortalFromPathname } from '@/auth/token'

function getCookieValue(name: string): string | null {
  try {
    const parts = document.cookie.split(';')
    for (const part of parts) {
      const [k, ...rest] = part.trim().split('=')
      if (k === name) return decodeURIComponent(rest.join('='))
    }
    return null
  } catch {
    return null
  }
}

function getCsrfToken(): string | null {
  return getCookieValue('ace_csrf')
}

export type ApiError = {
  status: number
  message: string
  details?: unknown
}

async function readJsonSafe(res: Response): Promise<unknown | undefined> {
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) return undefined
  try {
    return await res.json()
  } catch {
    return undefined
  }
}

export async function apiFetchJson<TResponse>(
  path: string,
  init: Omit<RequestInit, 'body'> & { body?: unknown } = {},
): Promise<TResponse> {
  const url = `${getApiBaseUrl()}${path}`

  const headers = new Headers(init.headers)
  headers.set('accept', 'application/json')

  const method = (init.method ?? 'GET').toUpperCase()
  const isUnsafe = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS'
  if (isUnsafe) {
    const csrf = getCsrfToken()
    if (csrf) headers.set('x-csrf-token', csrf)
  }

  const hasBody = init.body !== undefined
  if (hasBody) headers.set('content-type', 'application/json')

  async function doFetch(): Promise<Response> {
    return fetch(url, {
    ...init,
    headers,
    body: hasBody ? JSON.stringify(init.body) : undefined,
      credentials: 'include',
    })
  }

  let res = await doFetch()

  // One-shot refresh-on-401.
  if (res.status === 401) {
    const portal = getPortalFromPathname(window.location.pathname)
    if (portal) {
      const refreshUrl = `${getApiBaseUrl()}/${portal}/auth/refresh`
      const refreshHeaders = new Headers()
      refreshHeaders.set('accept', 'application/json')
      const csrf = getCsrfToken()
      if (csrf) refreshHeaders.set('x-csrf-token', csrf)

      const refreshRes = await fetch(refreshUrl, {
        method: 'POST',
        headers: refreshHeaders,
        credentials: 'include',
      })

      if (refreshRes.ok) {
        res = await doFetch()
      }
    }
  }

  if (!res.ok) {
    const details = await readJsonSafe(res)
    const message = (typeof details === 'object' && details && 'message' in details)
      ? String((details as any).message)
      : `Request failed: ${res.status}`

    const err: ApiError = {
      status: res.status,
      message,
      details,
    }

    throw err
  }

  const data = await readJsonSafe(res)
  return data as TResponse
}

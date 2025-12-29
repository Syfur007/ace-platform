import { getApiBaseUrl } from '@/api/config'
import { getActiveAccessToken } from '@/auth/token'

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

  const token = getActiveAccessToken()
  if (token) headers.set('authorization', `Bearer ${token}`)

  const hasBody = init.body !== undefined
  if (hasBody) headers.set('content-type', 'application/json')

  const res = await fetch(url, {
    ...init,
    headers,
    body: hasBody ? JSON.stringify(init.body) : undefined,
  })

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

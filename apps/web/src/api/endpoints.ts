import type { paths } from '@/api/__generated__/schema'

import { apiFetchJson } from '@/api/http'

export type HealthzResponse =
  paths['/healthz']['get']['responses'][200]['content']['application/json']

export async function getHealthz(): Promise<HealthzResponse> {
  return apiFetchJson<HealthzResponse>('/healthz', { method: 'GET' })
}

export type HeartbeatRequest =
  paths['/exam-sessions/{sessionId}/heartbeat']['post']['requestBody']['content']['application/json']

export type HeartbeatResponse =
  paths['/exam-sessions/{sessionId}/heartbeat']['post']['responses'][200]['content']['application/json']

export async function postHeartbeat(sessionId: string, body: HeartbeatRequest): Promise<HeartbeatResponse> {
  return apiFetchJson<HeartbeatResponse>(`/exam-sessions/${encodeURIComponent(sessionId)}/heartbeat`, {
    method: 'POST',
    body,
  })
}

import type { paths } from '@/api/__generated__/schema'

import { apiFetchJson } from '@/api/http'

export type RegisterRequest =
  paths['/auth/register']['post']['requestBody']['content']['application/json']

export type LoginRequest =
  paths['/auth/login']['post']['requestBody']['content']['application/json']

export type AuthResponse =
  paths['/auth/login']['post']['responses'][200]['content']['application/json']

export type MeResponse =
  paths['/auth/me']['get']['responses'][200]['content']['application/json']

export async function register(body: RegisterRequest): Promise<AuthResponse> {
  return apiFetchJson<AuthResponse>('/auth/register', { method: 'POST', body })
}

export async function login(body: LoginRequest): Promise<AuthResponse> {
  return apiFetchJson<AuthResponse>('/auth/login', { method: 'POST', body })
}

export async function getMe(): Promise<MeResponse> {
  return apiFetchJson<MeResponse>('/auth/me', { method: 'GET' })
}

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

export type CreatePracticeSessionRequest =
  paths['/practice-sessions']['post']['requestBody']['content']['application/json']

export type PracticeSessionResponse =
  paths['/practice-sessions']['post']['responses'][200]['content']['application/json']

export async function createPracticeSession(body: CreatePracticeSessionRequest): Promise<PracticeSessionResponse> {
  return apiFetchJson<PracticeSessionResponse>('/practice-sessions', { method: 'POST', body })
}

export type GetPracticeSessionResponse =
  paths['/practice-sessions/{sessionId}']['get']['responses'][200]['content']['application/json']

export async function getPracticeSession(sessionId: string): Promise<GetPracticeSessionResponse> {
  return apiFetchJson<GetPracticeSessionResponse>(`/practice-sessions/${encodeURIComponent(sessionId)}`, { method: 'GET' })
}

export type SubmitPracticeAnswerRequest =
  paths['/practice-sessions/{sessionId}/answers']['post']['requestBody']['content']['application/json']

export type SubmitPracticeAnswerResponse =
  paths['/practice-sessions/{sessionId}/answers']['post']['responses'][200]['content']['application/json']

export async function submitPracticeAnswer(
  sessionId: string,
  body: SubmitPracticeAnswerRequest,
): Promise<SubmitPracticeAnswerResponse> {
  return apiFetchJson<SubmitPracticeAnswerResponse>(`/practice-sessions/${encodeURIComponent(sessionId)}/answers`, {
    method: 'POST',
    body,
  })
}

export type PracticeSessionSummaryResponse =
  paths['/practice-sessions/{sessionId}/summary']['get']['responses'][200]['content']['application/json']

export async function getPracticeSessionSummary(sessionId: string): Promise<PracticeSessionSummaryResponse> {
  return apiFetchJson<PracticeSessionSummaryResponse>(`/practice-sessions/${encodeURIComponent(sessionId)}/summary`, {
    method: 'GET',
  })
}

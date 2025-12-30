import type { paths } from '@/api/__generated__/schema'

import { apiFetchJson } from '@/api/http'

export type RegisterRequest =
  paths['/student/auth/register']['post']['requestBody']['content']['application/json']

export type LoginRequest =
  paths['/student/auth/login']['post']['requestBody']['content']['application/json']

export type AuthResponse =
  paths['/student/auth/login']['post']['responses'][200]['content']['application/json']

export type MeResponse =
  paths['/student/auth/me']['get']['responses'][200]['content']['application/json']

export async function studentRegister(body: RegisterRequest): Promise<AuthResponse> {
  return apiFetchJson<AuthResponse>('/student/auth/register', { method: 'POST', body })
}

export async function studentLogin(body: LoginRequest): Promise<AuthResponse> {
  return apiFetchJson<AuthResponse>('/student/auth/login', { method: 'POST', body })
}

export async function studentGetMe(): Promise<MeResponse> {
  return apiFetchJson<MeResponse>('/student/auth/me', { method: 'GET' })
}

export async function instructorLogin(body: LoginRequest): Promise<AuthResponse> {
  return apiFetchJson<AuthResponse>('/instructor/auth/login', { method: 'POST', body })
}

export async function instructorGetMe(): Promise<MeResponse> {
  return apiFetchJson<MeResponse>('/instructor/auth/me', { method: 'GET' })
}

export async function adminLogin(body: LoginRequest): Promise<AuthResponse> {
  return apiFetchJson<AuthResponse>('/admin/auth/login', { method: 'POST', body })
}

export async function adminGetMe(): Promise<MeResponse> {
  return apiFetchJson<MeResponse>('/admin/auth/me', { method: 'GET' })
}

export type HealthzResponse =
  paths['/healthz']['get']['responses'][200]['content']['application/json']

export async function getHealthz(): Promise<HealthzResponse> {
  return apiFetchJson<HealthzResponse>('/healthz', { method: 'GET' })
}

export type ListPracticeSessionsResponse =
  paths['/practice-sessions']['get']['responses'][200]['content']['application/json']

export async function listPracticeSessions(params?: {
  limit?: number
  offset?: number
  status?: 'active' | 'paused' | 'finished'
}): Promise<ListPracticeSessionsResponse> {
  const search = new URLSearchParams()
  if (params?.limit != null) search.set('limit', String(params.limit))
  if (params?.offset != null) search.set('offset', String(params.offset))
  if (params?.status) search.set('status', params.status)
  const qs = search.toString()
  return apiFetchJson<ListPracticeSessionsResponse>(`/practice-sessions${qs ? `?${qs}` : ''}`, { method: 'GET' })
}

export type PausePracticeSessionResponse =
  paths['/practice-sessions/{sessionId}/pause']['post']['responses'][200]['content']['application/json']

export async function pausePracticeSession(sessionId: string): Promise<PausePracticeSessionResponse> {
  return apiFetchJson<PausePracticeSessionResponse>(`/practice-sessions/${encodeURIComponent(sessionId)}/pause`, {
    method: 'POST',
  })
}

export type ResumePracticeSessionResponse =
  paths['/practice-sessions/{sessionId}/resume']['post']['responses'][200]['content']['application/json']

export async function resumePracticeSession(sessionId: string): Promise<ResumePracticeSessionResponse> {
  return apiFetchJson<ResumePracticeSessionResponse>(`/practice-sessions/${encodeURIComponent(sessionId)}/resume`, {
    method: 'POST',
  })
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

export type GetExamSessionResponse =
  paths['/exam-sessions/{sessionId}']['get']['responses'][200]['content']['application/json']

export async function getExamSession(sessionId: string): Promise<GetExamSessionResponse> {
  return apiFetchJson<GetExamSessionResponse>(`/exam-sessions/${encodeURIComponent(sessionId)}`, { method: 'GET' })
}

export type ListExamSessionsResponse =
  paths['/exam-sessions']['get']['responses'][200]['content']['application/json']

export async function listExamSessions(params?: {
  limit?: number
  offset?: number
  status?: 'active' | 'finished'
}): Promise<ListExamSessionsResponse> {
  const search = new URLSearchParams()
  if (params?.limit != null) search.set('limit', String(params.limit))
  if (params?.offset != null) search.set('offset', String(params.offset))
  if (params?.status) search.set('status', params.status)
  const qs = search.toString()
  return apiFetchJson<ListExamSessionsResponse>(`/exam-sessions${qs ? `?${qs}` : ''}`, { method: 'GET' })
}

export type SubmitExamSessionResponse =
  paths['/exam-sessions/{sessionId}/submit']['post']['responses'][200]['content']['application/json']

export async function submitExamSession(sessionId: string): Promise<SubmitExamSessionResponse> {
  return apiFetchJson<SubmitExamSessionResponse>(`/exam-sessions/${encodeURIComponent(sessionId)}/submit`, {
    method: 'POST',
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

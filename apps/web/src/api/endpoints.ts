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

export type PracticeSessionReviewResponse =
  paths['/practice-sessions/{sessionId}/review']['get']['responses'][200]['content']['application/json']

export async function getPracticeSessionReview(sessionId: string): Promise<PracticeSessionReviewResponse> {
  return apiFetchJson<PracticeSessionReviewResponse>(`/practice-sessions/${encodeURIComponent(sessionId)}/review`, {
    method: 'GET',
  })
}

export type ListQuestionPackagesResponse =
  paths['/question-packages']['get']['responses'][200]['content']['application/json']

export async function listQuestionPackages(): Promise<ListQuestionPackagesResponse> {
  return apiFetchJson<ListQuestionPackagesResponse>('/question-packages', { method: 'GET' })
}

export type ListQuestionTopicsResponse =
  paths['/question-topics']['get']['responses'][200]['content']['application/json']

export async function listQuestionTopics(params?: { packageId?: string }): Promise<ListQuestionTopicsResponse> {
  const search = new URLSearchParams()
  if (params?.packageId) search.set('packageId', params.packageId)
  const qs = search.toString()
  return apiFetchJson<ListQuestionTopicsResponse>(`/question-topics${qs ? `?${qs}` : ''}`, { method: 'GET' })
}

export type ListQuestionDifficultiesResponse =
  paths['/question-difficulties']['get']['responses'][200]['content']['application/json']

export async function listQuestionDifficulties(): Promise<ListQuestionDifficultiesResponse> {
  return apiFetchJson<ListQuestionDifficultiesResponse>('/question-difficulties', { method: 'GET' })
}

export type InstructorCreateQuestionPackageRequest =
  paths['/instructor/question-packages']['post']['requestBody']['content']['application/json']
export type InstructorCreateQuestionPackageResponse =
  paths['/instructor/question-packages']['post']['responses'][200]['content']['application/json']

export async function instructorCreateQuestionPackage(
  body: InstructorCreateQuestionPackageRequest,
): Promise<InstructorCreateQuestionPackageResponse> {
  return apiFetchJson<InstructorCreateQuestionPackageResponse>('/instructor/question-packages', { method: 'POST', body })
}

export type InstructorListQuestionPackagesResponse =
  paths['/instructor/question-packages']['get']['responses'][200]['content']['application/json']

export async function instructorListQuestionPackages(): Promise<InstructorListQuestionPackagesResponse> {
  return apiFetchJson<InstructorListQuestionPackagesResponse>('/instructor/question-packages', { method: 'GET' })
}

export type InstructorCreateQuestionTopicRequest =
  paths['/instructor/question-topics']['post']['requestBody']['content']['application/json']
export type InstructorCreateQuestionTopicResponse =
  paths['/instructor/question-topics']['post']['responses'][200]['content']['application/json']

export async function instructorCreateQuestionTopic(
  body: InstructorCreateQuestionTopicRequest,
): Promise<InstructorCreateQuestionTopicResponse> {
  return apiFetchJson<InstructorCreateQuestionTopicResponse>('/instructor/question-topics', { method: 'POST', body })
}

export type InstructorListQuestionTopicsResponse =
  paths['/instructor/question-topics']['get']['responses'][200]['content']['application/json']

export async function instructorListQuestionTopics(params?: { packageId?: string }): Promise<InstructorListQuestionTopicsResponse> {
  const search = new URLSearchParams()
  if (params?.packageId) search.set('packageId', params.packageId)
  const qs = search.toString()
  return apiFetchJson<InstructorListQuestionTopicsResponse>(`/instructor/question-topics${qs ? `?${qs}` : ''}`, {
    method: 'GET',
  })
}

export type InstructorCreateQuestionRequest =
  paths['/instructor/questions']['post']['requestBody']['content']['application/json']
export type InstructorCreateQuestionResponse =
  paths['/instructor/questions']['post']['responses'][200]['content']['application/json']

export async function instructorCreateQuestion(body: InstructorCreateQuestionRequest): Promise<InstructorCreateQuestionResponse> {
  return apiFetchJson<InstructorCreateQuestionResponse>('/instructor/questions', { method: 'POST', body })
}

export type InstructorListQuestionsResponse =
  paths['/instructor/questions']['get']['responses'][200]['content']['application/json']

export async function instructorListQuestions(params?: {
  limit?: number
  offset?: number
  status?: 'draft' | 'published' | 'archived'
  packageId?: string
  topicId?: string
  difficultyId?: string
}): Promise<InstructorListQuestionsResponse> {
  const search = new URLSearchParams()
  if (params?.limit != null) search.set('limit', String(params.limit))
  if (params?.offset != null) search.set('offset', String(params.offset))
  if (params?.status) search.set('status', params.status)
  if (params?.packageId) search.set('packageId', params.packageId)
  if (params?.topicId) search.set('topicId', params.topicId)
  if (params?.difficultyId) search.set('difficultyId', params.difficultyId)
  const qs = search.toString()
  return apiFetchJson<InstructorListQuestionsResponse>(`/instructor/questions${qs ? `?${qs}` : ''}`, { method: 'GET' })
}

export type InstructorGetQuestionResponse =
  paths['/instructor/questions/{questionId}']['get']['responses'][200]['content']['application/json']

export async function instructorGetQuestion(questionId: string): Promise<InstructorGetQuestionResponse> {
  return apiFetchJson<InstructorGetQuestionResponse>(`/instructor/questions/${encodeURIComponent(questionId)}`, { method: 'GET' })
}

export type InstructorUpdateQuestionRequest =
  paths['/instructor/questions/{questionId}']['put']['requestBody']['content']['application/json']
export type OkResponse = paths['/instructor/questions/{questionId}']['put']['responses'][200]['content']['application/json']

export async function instructorUpdateQuestion(questionId: string, body: InstructorUpdateQuestionRequest): Promise<OkResponse> {
  return apiFetchJson<OkResponse>(`/instructor/questions/${encodeURIComponent(questionId)}`, { method: 'PUT', body })
}

export type InstructorReplaceChoicesRequest =
  paths['/instructor/questions/{questionId}/choices']['put']['requestBody']['content']['application/json']

export async function instructorReplaceChoices(questionId: string, body: InstructorReplaceChoicesRequest): Promise<OkResponse> {
  return apiFetchJson<OkResponse>(`/instructor/questions/${encodeURIComponent(questionId)}/choices`, { method: 'PUT', body })
}

export async function instructorPublishQuestion(questionId: string): Promise<OkResponse> {
  return apiFetchJson<OkResponse>(`/instructor/questions/${encodeURIComponent(questionId)}/publish`, { method: 'POST' })
}

export async function instructorArchiveQuestion(questionId: string): Promise<OkResponse> {
  return apiFetchJson<OkResponse>(`/instructor/questions/${encodeURIComponent(questionId)}/archive`, { method: 'POST' })
}

export async function instructorDraftQuestion(questionId: string): Promise<OkResponse> {
  return apiFetchJson<OkResponse>(`/instructor/questions/${encodeURIComponent(questionId)}/draft`, { method: 'POST' })
}

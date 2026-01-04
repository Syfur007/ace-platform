import type { components, paths } from '@/api/__generated__/schema'

import { apiFetchJson } from '@/api/http'

export type ExamSessionStatus = 'active' | 'finished' | 'terminated' | 'invalid'
export type UserRole = 'student' | 'instructor' | 'admin'
export type InstructorQuestionStatus = 'draft' | 'in_review' | 'needs_changes' | 'published' | 'archived'

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

export type ListExamPackagesResponse =
  paths['/exam-packages']['get']['responses'][200]['content']['application/json']

export async function listExamPackages(): Promise<ListExamPackagesResponse> {
  return apiFetchJson<ListExamPackagesResponse>('/exam-packages', { method: 'GET' })
}

export type StudentListEnrollmentsResponse =
  paths['/student/enrollments']['get']['responses'][200]['content']['application/json']

export async function studentListEnrollments(): Promise<StudentListEnrollmentsResponse> {
  return apiFetchJson<StudentListEnrollmentsResponse>('/student/enrollments', { method: 'GET' })
}

export type StudentEnrollRequest =
  paths['/student/enrollments']['post']['requestBody']['content']['application/json']

export type StudentEnrollResponse =
  paths['/student/enrollments']['post']['responses'][200]['content']['application/json']

export async function studentEnroll(body: StudentEnrollRequest): Promise<StudentEnrollResponse> {
  return apiFetchJson<StudentEnrollResponse>('/student/enrollments', { method: 'POST', body })
}

export type AdminListExamPackagesResponse =
  paths['/admin/exam-packages']['get']['responses'][200]['content']['application/json']

export async function adminListExamPackages(): Promise<AdminListExamPackagesResponse> {
  return apiFetchJson<AdminListExamPackagesResponse>('/admin/exam-packages', { method: 'GET' })
}

export type AdminCreateExamPackageRequest =
  paths['/admin/exam-packages']['post']['requestBody']['content']['application/json']
export type AdminCreateExamPackageResponse =
  paths['/admin/exam-packages']['post']['responses'][200]['content']['application/json']

export async function adminCreateExamPackage(body: AdminCreateExamPackageRequest): Promise<AdminCreateExamPackageResponse> {
  return apiFetchJson<AdminCreateExamPackageResponse>('/admin/exam-packages', { method: 'POST', body })
}

export type AdminUpdateExamPackageRequest =
  paths['/admin/exam-packages/{examPackageId}']['patch']['requestBody']['content']['application/json']

export async function adminUpdateExamPackage(
  examPackageId: string,
  body: AdminUpdateExamPackageRequest,
): Promise<{ success: true }> {
  return apiFetchJson<{ success: true }>(`/admin/exam-packages/${encodeURIComponent(examPackageId)}`, {
    method: 'PATCH',
    body,
  })
}

export async function adminDeleteExamPackage(examPackageId: string): Promise<{ success: true }> {
  return apiFetchJson<{ success: true }>(`/admin/exam-packages/${encodeURIComponent(examPackageId)}`, {
    method: 'DELETE',
  })
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
  status?: ExamSessionStatus
}): Promise<ListExamSessionsResponse> {
  const search = new URLSearchParams()
  if (params?.limit != null) search.set('limit', String(params.limit))
  if (params?.offset != null) search.set('offset', String(params.offset))
  if (params?.status) search.set('status', params.status)
  const qs = search.toString()
  return apiFetchJson<ListExamSessionsResponse>(`/exam-sessions${qs ? `?${qs}` : ''}`, { method: 'GET' })
}

export type RecordExamEventRequest = {
  eventType: string
  ts?: string | null
  payload?: Record<string, unknown> | null
}

export async function recordExamEvent(sessionId: string, body: RecordExamEventRequest): Promise<OkResponse> {
  return apiFetchJson<OkResponse>(`/exam-sessions/${encodeURIComponent(sessionId)}/events`, {
    method: 'POST',
    body,
  })
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

export type PracticeTemplate =
  components['schemas']['PracticeTemplate']

export type ListPracticeTemplatesResponse =
  paths['/practice-templates']['get']['responses'][200]['content']['application/json']

export async function listPracticeTemplates(params?: { examPackageId?: string }): Promise<ListPracticeTemplatesResponse> {
  const search = new URLSearchParams()
  if (params?.examPackageId) search.set('examPackageId', params.examPackageId)
  const qs = search.toString()
  return apiFetchJson<ListPracticeTemplatesResponse>(`/practice-templates${qs ? `?${qs}` : ''}`, { method: 'GET' })
}

export type InstructorCreatePracticeTemplateRequest =
  paths['/instructor/practice-templates']['post']['requestBody']['content']['application/json']

export type InstructorCreatePracticeTemplateResponse =
  paths['/instructor/practice-templates']['post']['responses'][200]['content']['application/json']

export async function instructorCreatePracticeTemplate(
  body: InstructorCreatePracticeTemplateRequest,
): Promise<InstructorCreatePracticeTemplateResponse> {
  return apiFetchJson<InstructorCreatePracticeTemplateResponse>('/instructor/practice-templates', { method: 'POST', body })
}

export type InstructorListPracticeTemplatesResponse =
  paths['/instructor/practice-templates']['get']['responses'][200]['content']['application/json']

export async function instructorListPracticeTemplates(params?: {
  examPackageId?: string
  includeUnpublished?: boolean
}): Promise<InstructorListPracticeTemplatesResponse> {
  const search = new URLSearchParams()
  if (params?.examPackageId) search.set('examPackageId', params.examPackageId)
  if (params?.includeUnpublished != null) search.set('includeUnpublished', String(params.includeUnpublished))
  const qs = search.toString()
  return apiFetchJson<InstructorListPracticeTemplatesResponse>(`/instructor/practice-templates${qs ? `?${qs}` : ''}`, {
    method: 'GET',
  })
}

export type InstructorUpdatePracticeTemplateRequest =
  paths['/instructor/practice-templates/{templateId}']['patch']['requestBody']['content']['application/json']

export type InstructorUpdatePracticeTemplateResponse =
  paths['/instructor/practice-templates/{templateId}']['patch']['responses'][200]['content']['application/json']

export async function instructorUpdatePracticeTemplate(
  templateId: string,
  body: InstructorUpdatePracticeTemplateRequest,
): Promise<InstructorUpdatePracticeTemplateResponse> {
  return apiFetchJson<InstructorUpdatePracticeTemplateResponse>(
    `/instructor/practice-templates/${encodeURIComponent(templateId)}`,
    { method: 'PATCH', body },
  )
}

export async function instructorDeletePracticeTemplate(templateId: string): Promise<{ success: true }> {
  return apiFetchJson<{ success: true }>(`/instructor/practice-templates/${encodeURIComponent(templateId)}`, {
    method: 'DELETE',
  })
}

export async function instructorPublishPracticeTemplate(templateId: string): Promise<PracticeTemplate> {
  return apiFetchJson<PracticeTemplate>(`/instructor/practice-templates/${encodeURIComponent(templateId)}/publish`, {
    method: 'POST',
  })
}

export async function instructorUnpublishPracticeTemplate(templateId: string): Promise<PracticeTemplate> {
  return apiFetchJson<PracticeTemplate>(`/instructor/practice-templates/${encodeURIComponent(templateId)}/unpublish`, {
    method: 'POST',
  })
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

export type ListQuestionBanksResponse =
  paths['/question-banks']['get']['responses'][200]['content']['application/json']

export async function listQuestionBanks(): Promise<ListQuestionBanksResponse> {
  return apiFetchJson<ListQuestionBanksResponse>('/question-banks', { method: 'GET' })
}

export type ListQuestionTopicsResponse =
  paths['/question-topics']['get']['responses'][200]['content']['application/json']

export async function listQuestionTopics(params?: { questionBankId?: string }): Promise<ListQuestionTopicsResponse> {
  const search = new URLSearchParams()
  if (params?.questionBankId) search.set('questionBankId', params.questionBankId)
  const qs = search.toString()
  return apiFetchJson<ListQuestionTopicsResponse>(`/question-topics${qs ? `?${qs}` : ''}`, { method: 'GET' })
}

export type ListQuestionDifficultiesResponse =
  paths['/question-difficulties']['get']['responses'][200]['content']['application/json']

export async function listQuestionDifficulties(): Promise<ListQuestionDifficultiesResponse> {
  return apiFetchJson<ListQuestionDifficultiesResponse>('/question-difficulties', { method: 'GET' })
}

export type InstructorCreateQuestionBankRequest =
  paths['/instructor/question-banks']['post']['requestBody']['content']['application/json']
export type InstructorCreateQuestionBankResponse =
  paths['/instructor/question-banks']['post']['responses'][200]['content']['application/json']

export async function instructorCreateQuestionBank(
  body: InstructorCreateQuestionBankRequest,
): Promise<InstructorCreateQuestionBankResponse> {
  return apiFetchJson<InstructorCreateQuestionBankResponse>('/instructor/question-banks', { method: 'POST', body })
}

export type InstructorListQuestionBanksResponse =
  paths['/instructor/question-banks']['get']['responses'][200]['content']['application/json']

export async function instructorListQuestionBanks(): Promise<InstructorListQuestionBanksResponse> {
  return apiFetchJson<InstructorListQuestionBanksResponse>('/instructor/question-banks', { method: 'GET' })
}

export type InstructorUpdateQuestionBankRequest =
  paths['/instructor/question-banks/{questionBankId}']['patch']['requestBody']['content']['application/json']

export async function instructorUpdateQuestionBank(
  questionBankId: string,
  body: InstructorUpdateQuestionBankRequest,
): Promise<{ success: true }> {
  return apiFetchJson<{ success: true }>(`/instructor/question-banks/${encodeURIComponent(questionBankId)}`, {
    method: 'PATCH',
    body,
  })
}

export async function instructorDeleteQuestionBank(questionBankId: string): Promise<{ success: true }> {
  return apiFetchJson<{ success: true }>(`/instructor/question-banks/${encodeURIComponent(questionBankId)}`, {
    method: 'DELETE',
  })
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

export async function instructorListQuestionTopics(
  params?: { questionBankId?: string },
): Promise<InstructorListQuestionTopicsResponse> {
  const search = new URLSearchParams()
  if (params?.questionBankId) search.set('questionBankId', params.questionBankId)
  const qs = search.toString()
  return apiFetchJson<InstructorListQuestionTopicsResponse>(`/instructor/question-topics${qs ? `?${qs}` : ''}`, {
    method: 'GET',
  })
}

export type InstructorUpdateQuestionTopicRequest = {
  name?: string
  isHidden?: boolean
}

export async function instructorUpdateQuestionTopic(
  topicId: string,
  body: InstructorUpdateQuestionTopicRequest,
): Promise<{ success: true }> {
  return apiFetchJson<{ success: true }>(`/instructor/question-topics/${encodeURIComponent(topicId)}`, {
    method: 'PATCH',
    body,
  })
}

export async function instructorDeleteQuestionTopic(topicId: string): Promise<{ success: true }> {
  return apiFetchJson<{ success: true }>(`/instructor/question-topics/${encodeURIComponent(topicId)}`, {
    method: 'DELETE',
  })
}

export type InstructorListQuestionDifficultiesResponse = {
  items: Array<{ id: string; displayName: string }>
}

export async function instructorListQuestionDifficulties(): Promise<InstructorListQuestionDifficultiesResponse> {
  return apiFetchJson<InstructorListQuestionDifficultiesResponse>('/instructor/question-difficulties', { method: 'GET' })
}

export type InstructorUpdateQuestionDifficultyRequest = {
  displayName: string
}

export async function instructorUpdateQuestionDifficulty(
  difficultyId: string,
  body: InstructorUpdateQuestionDifficultyRequest,
): Promise<{ success: true }> {
  return apiFetchJson<{ success: true }>(`/instructor/question-difficulties/${encodeURIComponent(difficultyId)}`, {
    method: 'PATCH',
    body,
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
  status?: InstructorQuestionStatus
  questionBankId?: string
  topicId?: string
  difficultyId?: string
}): Promise<InstructorListQuestionsResponse> {
  const search = new URLSearchParams()
  if (params?.limit != null) search.set('limit', String(params.limit))
  if (params?.offset != null) search.set('offset', String(params.offset))
  if (params?.status) search.set('status', params.status)
  if (params?.questionBankId) search.set('questionBankId', params.questionBankId)
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

export async function instructorSubmitQuestionForReview(questionId: string): Promise<OkResponse> {
  return apiFetchJson<OkResponse>(`/instructor/questions/${encodeURIComponent(questionId)}/submit-for-review`, { method: 'POST' })
}

export async function adminApproveQuestion(questionId: string): Promise<OkResponse> {
  return apiFetchJson<OkResponse>(`/admin/questions/${encodeURIComponent(questionId)}/approve`, { method: 'POST' })
}

export type AdminRequestQuestionChangesRequest = { note?: string }

export async function adminRequestQuestionChanges(
  questionId: string,
  body?: AdminRequestQuestionChangesRequest,
): Promise<OkResponse> {
  return apiFetchJson<OkResponse>(`/admin/questions/${encodeURIComponent(questionId)}/request-changes`, {
    method: 'POST',
    body: body ?? {},
  })
}

export async function adminDeleteQuestion(questionId: string): Promise<OkResponse> {
  return apiFetchJson<OkResponse>(`/admin/questions/${encodeURIComponent(questionId)}`, { method: 'DELETE' })
}

export async function instructorDeleteQuestion(questionId: string): Promise<OkResponse> {
  return apiFetchJson<OkResponse>(`/instructor/questions/${encodeURIComponent(questionId)}`, { method: 'DELETE' })
}

// Admin IAM

export type AdminUserListItem = {
  id: string
  email: string
  role: UserRole
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export type ListAdminUsersResponse = {
  items: AdminUserListItem[]
  limit: number
  offset: number
  hasMore: boolean
}

export type CreateAdminUserRequest = {
  email: string
  password: string
  role: UserRole
}

export type UpdateAdminUserRequest = {
  email?: string | null
  password?: string | null
  role?: UserRole | null
}

export async function adminListUsers(params?: {
  limit?: number
  offset?: number
  role?: UserRole
  includeDeleted?: boolean
}): Promise<ListAdminUsersResponse> {
  const search = new URLSearchParams()
  if (params?.limit != null) search.set('limit', String(params.limit))
  if (params?.offset != null) search.set('offset', String(params.offset))
  if (params?.role) search.set('role', params.role)
  if (params?.includeDeleted != null) search.set('includeDeleted', params.includeDeleted ? 'true' : 'false')
  const qs = search.toString()
  return apiFetchJson<ListAdminUsersResponse>(`/admin/users${qs ? `?${qs}` : ''}`, { method: 'GET' })
}

export async function adminGetUser(userId: string): Promise<AdminUserListItem> {
  return apiFetchJson<AdminUserListItem>(`/admin/users/${encodeURIComponent(userId)}`, { method: 'GET' })
}

export async function adminCreateUser(body: CreateAdminUserRequest): Promise<{ id: string }> {
  return apiFetchJson<{ id: string }>(`/admin/users`, { method: 'POST', body })
}

export async function adminUpdateUser(userId: string, body: UpdateAdminUserRequest): Promise<OkResponse> {
  return apiFetchJson<OkResponse>(`/admin/users/${encodeURIComponent(userId)}`, { method: 'PATCH', body })
}

export async function adminDeleteUser(userId: string): Promise<OkResponse> {
  return apiFetchJson<OkResponse>(`/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE' })
}

export async function adminRestoreUser(userId: string): Promise<OkResponse> {
  return apiFetchJson<OkResponse>(`/admin/users/${encodeURIComponent(userId)}/restore`, { method: 'POST' })
}

// Admin auth sessions + limits

export type AdminAuthSessionListItem = {
  id: string
  role: UserRole
  audience: string
  ip: string
  userAgent: string
  createdAt: string
  lastSeenAt: string
  expiresAt: string
  revokedAt?: string | null
  revokedReason: string
}

export type ListAdminAuthSessionsResponse = {
  items: AdminAuthSessionListItem[]
  limit: number
  offset: number
  hasMore: boolean
}

export async function adminListUserAuthSessions(userId: string, params?: {
  limit?: number
  offset?: number
  includeRevoked?: boolean
}): Promise<ListAdminAuthSessionsResponse> {
  const search = new URLSearchParams()
  if (params?.limit != null) search.set('limit', String(params.limit))
  if (params?.offset != null) search.set('offset', String(params.offset))
  if (params?.includeRevoked != null) search.set('includeRevoked', params.includeRevoked ? 'true' : 'false')
  const qs = search.toString()
  return apiFetchJson<ListAdminAuthSessionsResponse>(
    `/admin/users/${encodeURIComponent(userId)}/auth-sessions${qs ? `?${qs}` : ''}`,
    { method: 'GET' },
  )
}

export async function adminRevokeUserAuthSession(userId: string, sessionId: string): Promise<OkResponse> {
  return apiFetchJson<OkResponse>(
    `/admin/users/${encodeURIComponent(userId)}/auth-sessions/${encodeURIComponent(sessionId)}/revoke`,
    { method: 'POST' },
  )
}

export async function adminRevokeAllUserAuthSessions(userId: string): Promise<OkResponse> {
  return apiFetchJson<OkResponse>(`/admin/users/${encodeURIComponent(userId)}/auth-sessions/revoke-all`, { method: 'POST' })
}

export type AdminUserSessionLimitResponse = {
  effectiveMaxActiveSessions: number
  userMaxActiveSessions?: number | null
  groupMaxActiveSessions?: number | null
  roleMaxActiveSessions?: number | null
}

export async function adminGetUserSessionLimit(userId: string): Promise<AdminUserSessionLimitResponse> {
  return apiFetchJson<AdminUserSessionLimitResponse>(`/admin/users/${encodeURIComponent(userId)}/session-limit`, { method: 'GET' })
}

export async function adminSetUserSessionLimit(userId: string, maxActiveSessions: number | null): Promise<OkResponse> {
  return apiFetchJson<OkResponse>(`/admin/users/${encodeURIComponent(userId)}/session-limit`, {
    method: 'PUT',
    body: { maxActiveSessions },
  })
}

export type AdminSessionGroupListItem = {
  id: string
  name: string
  maxActiveSessions?: number | null
}

export type ListAdminSessionGroupsResponse = { items: AdminSessionGroupListItem[] }

export async function adminListSessionGroups(): Promise<ListAdminSessionGroupsResponse> {
  return apiFetchJson<ListAdminSessionGroupsResponse>(`/admin/session-groups`, { method: 'GET' })
}

export async function adminCreateSessionGroup(body: { name: string; maxActiveSessions: number | null }): Promise<{ id: string }> {
  return apiFetchJson<{ id: string }>(`/admin/session-groups`, { method: 'POST', body })
}

export async function adminUpdateSessionGroup(groupId: string, body: { name?: string | null; maxActiveSessions: number }): Promise<OkResponse> {
  return apiFetchJson<OkResponse>(`/admin/session-groups/${encodeURIComponent(groupId)}`, { method: 'PATCH', body })
}

export async function adminAddSessionGroupMember(groupId: string, userId: string): Promise<OkResponse> {
  return apiFetchJson<OkResponse>(`/admin/session-groups/${encodeURIComponent(groupId)}/members`, {
    method: 'POST',
    body: { userId },
  })
}

export async function adminRemoveSessionGroupMember(groupId: string, userId: string): Promise<OkResponse> {
  return apiFetchJson<OkResponse>(
    `/admin/session-groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
  )
}

export async function adminListUserSessionGroups(userId: string): Promise<ListAdminSessionGroupsResponse> {
  return apiFetchJson<ListAdminSessionGroupsResponse>(`/admin/users/${encodeURIComponent(userId)}/session-groups`, { method: 'GET' })
}

// Admin exam integrity

export type AdminExamSessionListItem = {
  userId: string
  userEmail: string
  sessionId: string
  status: ExamSessionStatus
  createdAt: string
  updatedAt: string
  lastHeartbeatAt: string
  submittedAt?: string | null
  terminatedAt?: string | null
  invalidatedAt?: string | null
}

export type ListAdminExamSessionsResponse = {
  items: AdminExamSessionListItem[]
  limit: number
  offset: number
  hasMore: boolean
}

export type AdminExamSessionResponse = {
  userId: string
  userEmail: string
  sessionId: string
  status: ExamSessionStatus
  createdAt: string
  updatedAt: string
  lastHeartbeatAt: string
  submittedAt?: string | null
  terminatedAt?: string | null
  terminatedByUserId?: string | null
  terminationReason: string
  invalidatedAt?: string | null
  invalidatedByUserId?: string | null
  invalidationReason: string
  snapshot: unknown
}

export type AdminExamActionRequest = { reason?: string }
export type AdminFlagRequest = { flagType: string; note?: string }

export type AdminExamEventListItem = {
  id: number
  eventType: string
  payload: unknown
  createdAt: string
}

export type ListAdminExamEventsResponse = {
  items: AdminExamEventListItem[]
  limit: number
  offset: number
  hasMore: boolean
}

export async function adminListExamSessions(params?: {
  limit?: number
  offset?: number
  status?: ExamSessionStatus
}): Promise<ListAdminExamSessionsResponse> {
  const search = new URLSearchParams()
  if (params?.limit != null) search.set('limit', String(params.limit))
  if (params?.offset != null) search.set('offset', String(params.offset))
  if (params?.status) search.set('status', params.status)
  const qs = search.toString()
  return apiFetchJson<ListAdminExamSessionsResponse>(`/admin/exam-sessions${qs ? `?${qs}` : ''}`, { method: 'GET' })
}

export async function adminGetExamSession(userId: string, sessionId: string): Promise<AdminExamSessionResponse> {
  return apiFetchJson<AdminExamSessionResponse>(
    `/admin/exam-sessions/${encodeURIComponent(userId)}/${encodeURIComponent(sessionId)}`,
    { method: 'GET' },
  )
}

export async function adminForceSubmitExamSession(userId: string, sessionId: string): Promise<OkResponse> {
  return apiFetchJson<OkResponse>(
    `/admin/exam-sessions/${encodeURIComponent(userId)}/${encodeURIComponent(sessionId)}/force-submit`,
    { method: 'POST' },
  )
}

export async function adminTerminateExamSession(
  userId: string,
  sessionId: string,
  body?: AdminExamActionRequest,
): Promise<OkResponse> {
  return apiFetchJson<OkResponse>(
    `/admin/exam-sessions/${encodeURIComponent(userId)}/${encodeURIComponent(sessionId)}/terminate`,
    { method: 'POST', body: body ?? {} },
  )
}

export async function adminInvalidateExamSession(
  userId: string,
  sessionId: string,
  body?: AdminExamActionRequest,
): Promise<OkResponse> {
  return apiFetchJson<OkResponse>(
    `/admin/exam-sessions/${encodeURIComponent(userId)}/${encodeURIComponent(sessionId)}/invalidate`,
    { method: 'POST', body: body ?? {} },
  )
}

export async function adminCreateExamFlag(userId: string, sessionId: string, body: AdminFlagRequest): Promise<OkResponse> {
  return apiFetchJson<OkResponse>(
    `/admin/exam-sessions/${encodeURIComponent(userId)}/${encodeURIComponent(sessionId)}/flags`,
    { method: 'POST', body },
  )
}

export async function adminListExamEvents(
  userId: string,
  sessionId: string,
  params?: { limit?: number; offset?: number },
): Promise<ListAdminExamEventsResponse> {
  const search = new URLSearchParams()
  if (params?.limit != null) search.set('limit', String(params.limit))
  if (params?.offset != null) search.set('offset', String(params.offset))
  const qs = search.toString()
  return apiFetchJson<ListAdminExamEventsResponse>(
    `/admin/exam-sessions/${encodeURIComponent(userId)}/${encodeURIComponent(sessionId)}/events${qs ? `?${qs}` : ''}`,
    { method: 'GET' },
  )
}

// Admin dashboard

export type AdminDashboardStatsResponse = {
  ts: string
  users: {
    total: number
    active: number
    deleted: number
    byRole: Record<string, number>
  }
  questionBank: {
    packages: number
    topics: number
    questions: number
    byStatus: Record<string, number>
  }
  exams: {
    sessions: number
    submitted: number
    byStatus: Record<string, number>
    events: number
    flags: number
  }
}

export async function adminGetDashboardStats(): Promise<AdminDashboardStatsResponse> {
  return apiFetchJson<AdminDashboardStatsResponse>('/admin/dashboard', { method: 'GET' })
}

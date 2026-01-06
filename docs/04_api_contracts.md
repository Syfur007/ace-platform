
API Contracts (implemented endpoints)

**Canonical spec:** The authoritative OpenAPI specification lives at `packages/api-specs/openapi.yaml` and CI generates SDKs into `packages/sdks` (TypeScript and Go). Frontend clients should prefer generated clients or a typed API layer under `apps/web/src/services` rather than importing backend internals.

Notes: for each endpoint I list route + method, purpose, auth requirement, handler file, and DB tables read/written by that handler for that endpoint.

Auth (handlers/auth.go)
- POST `/student/auth/register` — register new student. Public. Handler: `handlers/auth.go` (`handleRegister`). Writes: `users`, `auth_sessions`, `auth_refresh_tokens`, may insert into `user_exam_package_enrollments` (best-effort auto-enroll). Returns access token and user.
- POST `/student/auth/login` — login student. Public. Handler: `handlers/auth.go` (`handleLogin`). Reads: `users`. Writes: `auth_sessions`, `auth_refresh_tokens`. Sets cookies `ace_access`, `ace_refresh`, `ace_csrf`.
- GET `/student/auth/me` — get current user. Requires portal auth (student). Handler: `handlers/auth.go` (`handleMe`). Reads: `users`.
- POST `/student/auth/refresh` — rotate refresh token, issue new access token. Requires refresh cookie. Handler: `handlers/auth.go` (`handleRefresh`). Reads/Writes: `auth_refresh_tokens`, reads/updates `auth_sessions`.
- POST `/student/auth/logout` — logout (revoke session + clear cookies). Public with cookie fallback; handler revokes `auth_sessions`/`auth_refresh_tokens` where possible. Handler: `handlers/auth.go` (`handleLogout`). Writes: `auth_sessions` (revoked), `auth_refresh_tokens` (revoked).
- POST `/student/auth/logout-all` — revoke all sessions for current user. Requires portal auth (student). Handler: `handlers/auth.go` (`handleLogoutAll`). Writes: `auth_sessions`, `auth_refresh_tokens`.

Same set for instructor and admin portals (`/instructor/auth/*`, `/admin/auth/*`) and legacy aliases under `/auth/*` (treated as student portal). Auth requirements mirror the student endpoints (login/register public, me/refresh/logout-all require portal auth as appropriate).

Health
- GET `/healthz` — health check. Public. Handler: inline in `main.go`. No DB access.

Exam sessions (handlers/exam.go)
- GET `/exam-sessions` — list user's exam sessions. Requires student auth. Reads: `exam_sessions`.
- POST `/exam-sessions/:sessionId/heartbeat` — persist heartbeat/snapshot and upsert session (mark active). Requires student auth. Writes/Reads: `exam_sessions`, reads `user_exam_package_enrollments` to resolve package.
- GET `/exam-sessions/:sessionId` — get session details. Requires student auth. Reads: `exam_sessions`.
- POST `/exam-sessions/:sessionId/submit` — mark session submitted/finished. Requires student auth. Updates: `exam_sessions` (status, submitted_at).
- POST `/exam-sessions/:sessionId/events` — record an event for a session. Requires student auth. Writes: `exam_session_events`.

Practice sessions & templates (handlers/practice.go, practice_templates.go)
- GET `/practice-templates` — list published templates (student). Requires student auth. Reads: `practice_templates`.
- GET `/instructor/practice-templates` — instructor list (can include unpublished). Requires instructor/admin auth. Reads: `practice_templates`.
- POST `/instructor/practice-templates` — create template. Requires instructor/admin auth. Writes: `practice_templates`.
- PATCH `/instructor/practice-templates/:templateId` — update template. Requires instructor/admin auth. Writes: `practice_templates`.
- DELETE `/instructor/practice-templates/:templateId` — delete template. Requires instructor/admin auth. Writes: `practice_templates`.
- POST `/instructor/practice-templates/:templateId/publish` — publish template. Requires instructor/admin auth. Writes: `practice_templates`.
- POST `/instructor/practice-templates/:templateId/unpublish` — unpublish template. Requires instructor/admin auth. Writes: `practice_templates`.

- GET `/practice-sessions` — list practice sessions for user. Requires student auth. Reads: `practice_sessions`.
- POST `/practice-sessions` — create practice session (template-driven or package-driven). Requires student auth. Reads: `practice_templates`, `user_exam_package_enrollments`, `exam_packages`. Writes: `practice_sessions`.
- GET `/practice-sessions/:sessionId` — get practice session. Requires student auth. Reads: `practice_sessions`.
- POST `/practice-sessions/:sessionId/pause` — pause session. Requires student auth. Updates: `practice_sessions`.
- POST `/practice-sessions/:sessionId/resume` — resume session. Requires student auth. Updates: `practice_sessions`.
- POST `/practice-sessions/:sessionId/answers` — submit answer. Requires student auth. Writes: `practice_answers`, updates `practice_sessions` counters.
- GET `/practice-sessions/:sessionId/review` — review session answers. Requires student auth. Reads: `practice_answers`, `practice_sessions`.
- GET `/practice-sessions/:sessionId/summary` — session summary. Requires student auth. Reads: `practice_sessions`, `practice_answers`.

Question bank (handlers/questions.go)
- GET `/questions` — list published questions (student). Requires student auth. Reads: `question_bank_questions` filtered status='published'.
- GET `/questions/:questionId` — get published question with choices. Requires student auth. Reads: `question_bank_questions`, `question_bank_choices`, (`question_bank_correct_choice` not exposed).
- GET `/question-banks` — list visible question banks. Requires student auth. Reads: `question_banks`, `exam_package_question_bank_packages` for mapping.
- GET `/question-topics` — list topics. Requires student auth. Reads: `question_bank_topics`.
- GET `/question-difficulties` — list difficulties. Requires student auth. Reads: `question_bank_difficulties`.

Instructor/admin question flows (handlers/questions.go)
- POST `/instructor/question-banks` — create question bank package. Requires instructor/admin auth. Writes: `question_banks`, `exam_package_question_bank_packages`.
- GET `/instructor/question-banks` — list all question bank packages. Requires instructor/admin auth. Reads: `question_banks`, `exam_package_question_bank_packages`.
- PATCH `/instructor/question-banks/:questionBankId` — update package. Requires instructor/admin auth. Writes: `question_banks`, `exam_package_question_bank_packages` if examPackageId updated.
- DELETE `/instructor/question-banks/:questionBankId` — delete package. Requires instructor/admin auth. Deletes from `question_banks` (cascade to related rows per schema).
- POST `/instructor/question-topics` — create topic. Requires instructor/admin auth. Writes: `question_bank_topics`.
- GET `/instructor/question-topics` — list topics. Requires instructor/admin auth. Reads: `question_bank_topics`.
- PATCH `/instructor/question-topics/:topicId` — update topic. Requires instructor/admin auth. Writes: `question_bank_topics`.
- DELETE `/instructor/question-topics/:topicId` — delete topic. Requires instructor/admin auth. Deletes from `question_bank_topics`.
- GET `/instructor/question-difficulties` — list difficulties. Reads: `question_bank_difficulties`.
- PATCH `/instructor/question-difficulties/:difficultyId` — update difficulty display name. Requires instructor/admin auth. Writes: `question_bank_difficulties`.
- POST `/instructor/questions` — create question (draft). Requires instructor/admin auth. Writes: `question_bank_questions`, `question_bank_choices`, `question_bank_correct_choice`.
- GET `/instructor/questions` — list instructor-visible questions. Requires instructor/admin auth. Reads: `question_bank_questions`.
- GET `/instructor/questions/:questionId` — get question with choices and metadata. Requires instructor/admin auth. Reads: `question_bank_questions`, `question_bank_choices`, `question_bank_correct_choice`.
- PUT `/instructor/questions/:questionId` — update question fields. Requires instructor/admin auth. Writes: `question_bank_questions`.
- PUT `/instructor/questions/:questionId/choices` — replace choices for a question. Requires instructor/admin auth. Writes: `question_bank_choices`, `question_bank_correct_choice`, updates `question_bank_questions.updated_at`.
- DELETE `/instructor/questions/:questionId` — delete question (instructor-scoped). Requires instructor/admin auth. Deletes: `question_bank_questions`, dependent `question_bank_choices`, `question_bank_correct_choice`.
- DELETE `/admin/questions/:questionId` — delete question (admin). Requires admin auth. Similar deletions.
- POST `/instructor/questions/:questionId/publish` — set status published (instructor/admin; publish restricted for non-admins guarded in code). Writes: `question_bank_questions` status.
- POST `/instructor/questions/:questionId/archive` — archive. Writes: `question_bank_questions`.
- POST `/instructor/questions/:questionId/draft` — set draft. Writes: `question_bank_questions`.
- POST `/instructor/questions/:questionId/submit-for-review` — submit for review. Writes: `question_bank_questions`.
- POST `/admin/questions/:questionId/approve` — admin approves and publishes question. Writes: `question_bank_questions`.
- POST `/admin/questions/:questionId/request-changes` — admin requests changes with note. Writes: `question_bank_questions` (review_note and status).

Enrollments & Exam packages (handlers/enrollments.go)
- GET `/exam-packages` — public list of visible packages. Public. Reads: `exam_packages`.
- PATCH `/instructor/exam-packages/:examPackageId` — instructor updates package metadata. Requires instructor/admin auth. Writes: `exam_packages`, also writes `audit_log`.
- GET `/student/enrollments` — list user's enrollments. Requires student auth. Reads: `user_exam_package_enrollments`.
- POST `/student/enrollments` — enroll user in package. Requires student auth. Writes: `user_exam_package_enrollments` (insert).
- DELETE `/student/enrollments/:examPackageId` — cancel enrollment. Requires student auth. Writes: `user_exam_package_enrollments` (delete).

Admin routes (handlers/admin_routes.go)
- GET `/admin/dashboard` — aggregate stats. Requires admin auth. Reads: `users`, `question_banks`, `question_bank_topics`, `question_bank_questions`, `exam_sessions`, `exam_session_events`, `exam_session_flags`.
- Admin exam package CRUD:
	- GET `/admin/exam-packages` — list packages. Reads: `exam_packages`.
	- POST `/admin/exam-packages` — create package. Writes: `exam_packages`.
	- PATCH `/admin/exam-packages/:examPackageId` — update. Writes: `exam_packages`.
	- DELETE `/admin/exam-packages/:examPackageId` — delete. Deletes `exam_packages` (cascade may affect related rows).
- Admin user management:
	- GET `/admin/users` — list users. Reads: `users`.
	- GET `/admin/users/:userId` — get user. Reads: `users`.
	- POST `/admin/users` — create user. Writes: `users`.
	- PATCH `/admin/users/:userId` — update user. Writes: `users`.
	- DELETE `/admin/users/:userId` — soft-delete user (sets `deleted_at`). Writes: `users`.
	- POST `/admin/users/:userId/restore` — restore user (clears `deleted_at`). Writes: `users`.
- Admin user sessions & limits:
	- GET `/admin/users/:userId/auth-sessions` — list sessions for user. Reads: `auth_sessions`.
	- POST `/admin/users/:userId/auth-sessions/revoke-all` — revoke all sessions for user. Writes: `auth_sessions`, `auth_refresh_tokens`.
	- POST `/admin/users/:userId/auth-sessions/:sessionId/revoke` — revoke a session. Writes: `auth_sessions`, `auth_refresh_tokens`.
	- GET `/admin/users/:userId/session-limit` — inspect effective session limit. Reads: `auth_session_limits_user`, `auth_session_group_memberships`, `auth_session_limits_group`, `auth_session_limits_role`, `users`.
	- PUT `/admin/users/:userId/session-limit` — set per-user session limit. Writes: `auth_session_limits_user`.
- Admin session groups and memberships:
	- GET `/admin/session-groups` — list groups. Reads: `auth_session_groups`, `auth_session_limits_group`.
	- POST `/admin/session-groups` — create group. Writes: `auth_session_groups`, `auth_session_limits_group` (optional).
	- PATCH `/admin/session-groups/:groupId` — update group and limits. Writes: `auth_session_groups`, `auth_session_limits_group`.
	- POST `/admin/session-groups/:groupId/members` — add member. Writes: `auth_session_group_memberships`.
	- DELETE `/admin/session-groups/:groupId/members/:userId` — remove member. Writes: `auth_session_group_memberships`.
	- GET `/admin/users/:userId/session-groups` — list groups for a user. Reads: `auth_session_group_memberships`, `auth_session_groups`, `auth_session_limits_group`.
- Admin exam sessions and actions:
	- GET `/admin/exam-sessions` — list exam sessions. Reads: `exam_sessions`, joined to `users`.
	- GET `/admin/exam-sessions/:userId/:sessionId` — get specific exam session details. Reads: `exam_sessions`, `exam_session_events`.
	- POST `/admin/exam-sessions/:userId/:sessionId/force-submit` — force-submit session. Writes: `exam_sessions` (status/submit fields).
	- POST `/admin/exam-sessions/:userId/:sessionId/terminate` — terminate session. Writes: `exam_sessions` (terminated_at, terminated_by_user_id, termination_reason).
	- POST `/admin/exam-sessions/:userId/:sessionId/invalidate` — invalidate session. Writes: `exam_sessions` (invalidated_at, invalidated_by_user_id, invalidation_reason).
	- POST `/admin/exam-sessions/:userId/:sessionId/flags` — add flag to session. Writes: `exam_session_flags`.
	- GET `/admin/exam-sessions/:userId/:sessionId/events` — list events for session. Reads: `exam_session_events`.

Notes / caveats
- Many endpoints use the same handler file but different route prefixes (student/instructor/admin) and share code paths (auth middlewares differ by expected role/audience).
- Cookie-based auth means many endpoints rely on `ace_access` and `ace_refresh` cookies plus `ace_csrf` header for unsafe methods; the client-side `apiFetchJson` expects `credentials: 'include'`.
- This list excludes internal helper functions and any commented or unused routes.


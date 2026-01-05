
This document describes three implemented end-to-end workflows observed in the codebase. Each flow lists the user action, the frontend components involved, the API calls made (exact endpoints), backend handlers/services invoked, DB mutations, and the final state/result.

1) Student registers into system

- User action in UI
	- Student fills email/password on the Student sign-in page and clicks **Register**.

- Frontend components involved
	- `apps/web/src/pages/student/StudentAuthPage.tsx` handles the form and submission UI.
	- `apps/web/src/auth/token.ts` helpers are used to normalize/record an access hint and call `setAccessToken`.

- API calls made
	- `studentRegister(body)` → POST `/student/auth/register` (via `apps/web/src/api/endpoints.ts` → `apiFetchJson`).

- Backend services invoked
	- Request handled by the auth handlers in `services/api-gateway/internal/handlers/auth.go` (register path).
	- Auth helpers: password hashing (bcrypt) and JWT creation (`internal/auth/password.go`, `internal/auth/jwt.go`).

- Database mutations
	- `INSERT` into `users` (creates a new user row).
	- `INSERT` into `auth_sessions` (create a session row for the user).
	- `INSERT` into `auth_refresh_tokens` (store rotated/initial refresh token hash).

- Final state/result
	- A new user exists in the `users` table; an active `auth_sessions` row and refresh token are created.
	- Server sets authentication cookies (`ace_access`, `ace_refresh`, and `ace_csrf`) in the browser response.
	- Frontend receives `AuthResponse` (including an `accessToken`), calls `setAccessToken('student', accessToken)`, and navigates to `/student/dashboard`.

2) Student starts a practice session

- User action in UI
	- From the Practice page the student picks a practice template (or demo) and clicks **Start**.

- Frontend components involved
	- `apps/web/src/pages/student/StudentPracticePage.tsx` (Start action, calls create function and navigates to the session URL).
	- After navigation: `apps/web/src/pages/student/StudentPracticeSessionPage.tsx` loads and renders the session UI.
	- React Query (configured in `apps/web/src/app/providers.tsx`) manages the network calls and caching for the session queries/mutations.

- API calls made
	- `createPracticeSession(body)` → POST `/practice-sessions` (body includes `templateId`, `examPackageId`, `timed`, `count`), returns a `sessionId`.
	- Immediately after navigation, `getPracticeSession(sessionId)` → GET `/practice-sessions/{sessionId}` to load session state.

- Backend services invoked
	- `services/api-gateway/internal/handlers/practice.go` handles the POST `/practice-sessions` request and the subsequent GET for session state.
	- The handler composes the session snapshot (question order / question snapshots) and persists it.

- Database mutations
	- `INSERT` into `practice_sessions` (creates a session row with `id`, `user_id`, `package_id`, `template_id`, `is_timed`, `target_count`, `current_index`, `correct_count`, `status`, `question_order`, `questions_snapshot`, etc.).
	- (During session start the code may update `started_at`, `time_limit_seconds`, and `current_question_started_at` via `UPDATE` statements.)

- Final state/result
	- A `practice_sessions` row exists in the DB representing the active session; the frontend navigates to `/student/practice/session/{sessionId}` and renders the first question.
	- React Query keeps the session data cached; the student can interact and submit answers (see flow 3 below).

3) Student reviews results

- User action in UI
	- After a session is finished the student clicks **Review** (or visits the session URL where the session `status` is `finished`).

- Frontend components involved
	- `apps/web/src/pages/student/StudentPracticeSessionPage.tsx` — this component conditionally fetches summary and review data when the session `status === 'finished'`.
	- React Query manages `getPracticeSessionSummary` and `getPracticeSessionReview` queries.

- API calls made
	- `getPracticeSessionSummary(sessionId)` → GET `/practice-sessions/{sessionId}/summary`
	- `getPracticeSessionReview(sessionId)` → GET `/practice-sessions/{sessionId}/review`
	- (If the student submitted answers, earlier calls included `submitPracticeAnswer(sessionId, body)` → POST `/practice-sessions/{sessionId}/answers`.)

- Backend services invoked
	- `services/api-gateway/internal/handlers/practice.go` serves the summary and review endpoints by aggregating the `practice_sessions` row and the `practice_answers` rows for the session.

- Database mutations
	- The review/summary endpoints are read-only and do not mutate state.
	- (Prior to review, each answer submission created rows in `practice_answers` and updated `practice_sessions` — see the submit path below.)

- Final state/result
	- The UI displays the session summary (total questions, correct count, accuracy) and a per-question review that includes the prompt, selected choice, correct choice, time taken, and explanation where available.
	- All review data is derived from `practice_sessions` and `practice_answers` rows.

Implementation notes (quick trace tips)

- Tracing UI → endpoint: search the page file (for example `apps/web/src/pages/student/StudentPracticeSessionPage.tsx`) for imports from `@/api/endpoints` to find exactly which functions are used.
- Network behavior: all requests go through `apiFetchJson` (`apps/web/src/api/http.ts`) which uses `credentials: 'include'`, adds the `X-CSRF-Token` header for unsafe methods, and performs a one-shot refresh on 401 responses.
- DB table names to inspect for these flows: `users`, `auth_sessions`, `auth_refresh_tokens`, `practice_sessions`, `practice_answers` (see `services/api-gateway/internal/db/db.go` and `services/api-gateway/internal/handlers/practice.go`).

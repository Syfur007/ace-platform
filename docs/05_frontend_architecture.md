
**Application Entry Point**

- **File:** apps/web/src/main.tsx
- The app is mounted in `main.tsx`. It wraps the router with `AppProviders` which provides application-wide context like the React Query client.
- **Providers:** apps/web/src/app/providers.tsx configures a `QueryClient` with `retry=1`, `refetchOnWindowFocus=false`, and `staleTime=10_000` and exposes `QueryClientProvider` for all pages.

**Routing Structure**

- **File:** apps/web/src/app/router.tsx
- Uses React Router `createBrowserRouter` with a single app shell (`AppShell`) that contains the header/footer and an `<Outlet/>` for children.
- Top-level routes:
	- `/` → Home landing (decides which portal to continue to)
	- `/student/*`, `/instructor/*`, `/admin/*` → portal-specific route groups.
	- `/:portal/auth` pages (e.g. `/student/auth`, `/instructor/auth`, `/admin/auth`) for sign-in flows.
- Portal routes are wrapped by `RequirePortalAuth` for authenticated areas. Student routes mount `StudentLayout` and include pages like dashboard, courses, practice, tests and individual practice/test session routes (e.g. `practice/session/:sessionId`, `test/:testId`).

**State Management Approach**

- Primary choice: React Query (`@tanstack/react-query`) for server state — data fetching, caching, background refetches, and mutation helpers.
- Local UI state is handled by component state or context where appropriate (no global Redux-like store observed).
- Authentication/portal hint: `apps/web/src/auth/token.ts` stores a small portal hint in `localStorage` (which portal is active) and keeps access tokens normalized in memory; `normalizeAccessTokens` runs on route change.

**How API Calls Are Organized**

- Low-level wrapper: `apps/web/src/api/http.ts` exports `apiFetchJson` which:
	- Always uses `fetch` with `credentials: 'include'` (cookie-based auth).
	- Adds the `X-CSRF-Token` header for unsafe methods, reading the `ace_csrf` cookie value.
	- Performs a one-shot refresh flow on 401 responses (calls the backend refresh endpoint and retries once).
- Higher-level typed helpers: `apps/web/src/api/endpoints.ts` provides typed functions that call `apiFetchJson` for specific backend endpoints used across pages.
- Pages and hooks import the typed endpoint functions (or call `apiFetchJson` directly) to perform network operations.

**Authentication & CSRF Notes**

- The frontend relies on server-set cookies for auth: access + refresh cookies plus an `ace_csrf` cookie for the double-submit pattern.
- Logout in the header issues `apiFetchJson(`/${portal}/auth/logout`, { method: 'POST' })` then calls `clearAllAccessTokens()` and redirects to the portal auth page.

**Major Feature Modules & Purpose**

- `pages/*` — top-level entry for user-facing screens:
	- `student/*` — dashboard, courses, practice session pages, exam/test simulator components.
	- `instructor/*` — instructor dashboard and practice template management.
	- `admin/*` — admin dashboard, question bank, practice templates, user management, exam integrity views.
- `auth/*` — `RequirePortalAuth` and token helpers for portal detection, normalization, and light client-side helpers.
- `api/*` — `http.ts` (fetch wrapper) and `endpoints.ts` (typed endpoint functions).
- `exam/*` — exam engine helpers and hooks (`useExamEngine`, `useHeartbeatSync`) that implement the real-time exam simulation logic.

**How User Actions Translate Into API Calls (Patterns & Examples)**

- Navigation / UI triggers:
	- Clicking Sign In on `/student/auth` → page collects credentials and calls the portal auth endpoint via `apiFetchJson` (through `endpoints.ts`). Successful auth relies on cookies set by the server; client then calls `normalizeAccessTokens`/portal helpers to reflect authentication state.
	- Header Log out → `apiFetchJson('/{portal}/auth/logout', { method: 'POST' })`, then `clearAllAccessTokens()` and client-side navigation to `/{portal}/auth`.
- Practice & session lifecycle:
	- Starting a practice session triggers a POST to a practice-session endpoint (via `endpoints.ts`). The returned session id is used to navigate to `practice/session/:sessionId`.
	- Practice session UI (question navigator, answer submission) issues mutation calls — typically `POST` or `PATCH` to session or response endpoints using `apiFetchJson` (ensures CSRF header and cookies are sent).
- Exam simulation (real-time heartbeat + question fetch):
	- `useExamEngine` and `useHeartbeatSync` hook into timers or user events and call periodic heartbeats or progress updates to exam endpoints (e.g., heartbeat/poll endpoints). These hooks use `apiFetchJson` and rely on the one-shot refresh-on-401 behavior.
- Admin/instructor workflows:
	- CRUD actions (create/update/delete practice templates, questions, users) call the corresponding `endpoints.ts` functions which POST/PUT/DELETE to admin routes; these calls are authenticated and include CSRF tokens for mutation requests.

**Developer notes & troubleshooting pointers**

- To trace any UI → API mapping, open the page component under `apps/web/src/pages/*` and search for imports from `@/api/endpoints` or direct uses of `apiFetchJson`.
- Auth flow can be debugged by watching cookie changes in the browser devtools and the `X-CSRF-Token` header added by the client for unsafe methods.
- React Query caches and retries can be tuned in `apps/web/src/app/providers.tsx` (the QueryClient defaults are set there).

**Next steps (optional improvements)**

- Expand the mapping per-page: list the exact endpoint functions used by each page component (can be generated by scanning `pages/` for `@/api` imports). This doc focuses on the architecture and patterns rather than exhaustively listing every call.

--
Generated from implemented code: `apps/web/src/main.tsx`, `apps/web/src/app/providers.tsx`, `apps/web/src/app/router.tsx`, `apps/web/src/api/http.ts`, `apps/web/src/api/endpoints.ts`, `apps/web/src/auth/token.ts`, and `apps/web/src/pages/*`.

**Per-page endpoint mapping**

Below is a per-page list of the exact functions imported from `@/api/endpoints` (or direct `apiFetchJson` usage) so you can quickly find which backend endpoints each page calls.

- `apps/web/src/pages/AdminPanelPage.tsx`:
	- adminCreateExamFlag, adminCreateUser, adminDeleteUser, adminForceSubmitExamSession, adminGetExamSession, adminGetUser, adminInvalidateExamSession, adminListExamEvents, adminListExamSessions, adminListUsers, adminRestoreUser, adminTerminateExamSession, adminUpdateUser, adminGetUserSessionLimit, adminListSessionGroups, adminListUserAuthSessions, adminListUserSessionGroups, adminRevokeAllUserAuthSessions, adminRevokeUserAuthSession, adminSetUserSessionLimit, adminAddSessionGroupMember, adminRemoveSessionGroupMember, adminCreateSessionGroup, adminUpdateSessionGroup

- `apps/web/src/pages/admin/QuestionBankTab.tsx`:
	- adminApproveQuestion, adminCreateExamPackage, adminDeleteExamPackage, adminDeleteQuestion, adminListExamPackages, adminRequestQuestionChanges, adminUpdateExamPackage, instructorArchiveQuestion, instructorCreateQuestion, instructorCreateQuestionBank, instructorCreateQuestionTopic, instructorDeleteQuestionBank, instructorDeleteQuestionTopic, instructorDraftQuestion, instructorGetQuestion, instructorListQuestionDifficulties, instructorListQuestionBanks, instructorListQuestionTopics, instructorListQuestions, instructorPublishQuestion, instructorReplaceChoices, instructorSubmitQuestionForReview, instructorUpdateQuestion, instructorUpdateQuestionBank, instructorUpdateQuestionDifficulty, instructorUpdateQuestionTopic

- `apps/web/src/pages/StudentTestsPage.tsx`:
	- listExamPackages, listExamSessions, studentListEnrollments

- `apps/web/src/pages/student/StudentProfilePage.tsx`:
	- listExamPackages, listExamSessions, listPracticeSessions, studentGetMe, studentListEnrollments

- `apps/web/src/pages/student/StudentPracticeSessionPage.tsx`:
	- getPracticeSession, getPracticeSessionReview, getPracticeSessionSummary, pausePracticeSession, resumePracticeSession, submitPracticeAnswer

- `apps/web/src/pages/student/StudentPracticePage.tsx`:
	- createPracticeSession, listExamPackages, listPracticeSessions, listPracticeTemplates, studentListEnrollments

- `apps/web/src/pages/student/StudentCoursesPage.tsx`:
	- listExamPackages, studentCancelEnrollment, studentEnroll, studentListEnrollments

- `apps/web/src/pages/student/StudentAuthPage.tsx`:
	- studentLogin, studentRegister
	- direct `apiFetchJson('/student/auth/logout', { method: 'POST' })` used for sign-out

- `apps/web/src/pages/PackageDetailsPage.tsx`:
	- listExamPackages, studentCancelEnrollment, studentEnroll, studentListEnrollments

- `apps/web/src/pages/admin/AdminDashboardPage.tsx`:
	- adminGetDashboardStats, getHealthz

- `apps/web/src/pages/admin/AdminAuthPage.tsx`:
	- adminLogin
	- direct `apiFetchJson('/admin/auth/logout', { method: 'POST' })` used for sign-out

- `apps/web/src/pages/shared/PracticeTemplatesManager.tsx`:
	- instructorCreatePracticeTemplate, instructorDeletePracticeTemplate, instructorListPracticeTemplates, instructorPublishPracticeTemplate, instructorUnpublishPracticeTemplate, instructorUpdateExamPackage, instructorUpdatePracticeTemplate, listExamPackages, listQuestionBanks, listQuestionDifficulties, listQuestionTopics

- `apps/web/src/pages/instructor/InstructorAuthPage.tsx`:
	- instructorLogin
	- direct `apiFetchJson('/instructor/auth/logout', { method: 'POST' })` used for sign-out

- `apps/web/src/pages/ExamSimulationPage.tsx`:
	- getExamSession, recordExamEvent, submitExamSession

Notes:
- Some pages import many admin/instructor helpers; the actual network calls originate from the functions listed above, which in turn call `apiFetchJson` under the hood.
- To generate an exhaustive matrix including where in each file the call occurs, I can scan for usages of the imported symbols and produce a CSV or table mapping file → (line numbers, function usage). Tell me if you'd like that.

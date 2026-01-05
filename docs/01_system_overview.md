**System Overview**

This document describes how the system actually works based on the implemented code in this repository. It focuses on runtime components, request flows, and concrete behaviors observed in the code. It does not speculate about unimplemented features.

**Backend Entry Points**
- **Main server:** `services/api-gateway/cmd/api-gateway/main.go` — starts a Gin HTTP server, connects to the database, runs the idempotent migration, sets CORS and CSRF middleware, and registers route groups via the handlers package.
- **Route registration:** Route handlers are registered by functions in `services/api-gateway/internal/handlers` (e.g. `RegisterAuthRoutes`, `RegisterExamRoutes`, `RegisterQuestionRoutes`). These functions attach the implemented HTTP endpoints to the Gin engine.

**Core Backend Modules / Services (implemented)**
- **HTTP framework:** Gin (router/HTTP server) is the API gateway surface.
- **Database & migrations:** `services/api-gateway/internal/db/db.go` — creates a `pgx` connection pool to PostgreSQL using `DATABASE_URL` (with a dev default), performs schema creation/backfill, seeds data (difficulties, some exam packages), and bootstraps admin/instructor users from env variables when present.
- **Authentication:** `services/api-gateway/internal/auth` implements:
	- JWT access tokens (HS256) with subject/audience/role/session claims.
	- Opaque refresh tokens (random bytes, stored hashed in DB).
	- Password hashing with bcrypt.
	- Middleware (`RequirePortalAuth` / `RequireAuth`) that validates tokens and enforces DB session revocation/expiry.
- **Handlers / API logic:** `services/api-gateway/internal/handlers` provides concrete endpoints for:
	- Auth: register, login, refresh, logout, logout-all, me (cookie-based auth + CSRF flow).
	- Exam sessions: heartbeat, list, get, submit, events with server-backed session state persisted to `exam_sessions` and `exam_session_events`.
	- Question bank: public read endpoints and instructor/admin CRUD and review/publish flows.
	- Additional registered modules: enrollments, practice, admin routes (implemented in their handler files and registered in main.go).
- **Utilities:** `internal/util` for ID generation and small helpers used across services.

**Auth & Session Model (concrete behavior)**
- Authentication is cookie-based. The backend sets three cookies on successful login/refresh:
	- `ace_access` — JWT access token (httpOnly)
	- `ace_refresh` — opaque refresh token (httpOnly)
	- `ace_csrf` — CSRF token (readable by JS) used for double-submit CSRF protection
- CSRF: main.go enforces double-submit CSRF for unsafe methods (POST/PUT/PATCH/DELETE) by comparing `X-CSRF-Token` header to `ace_csrf` cookie. Login/register endpoints are exempted so they can mint the cookie.
- Sessions are persisted in DB tables.
	- `auth_sessions` stores per-session records (id, user_id, role, audience, expires_at, revoked_at). The server checks these on access token validation when a session id is present.
	- `auth_refresh_tokens` stores hashed refresh tokens linked to sessions. Refresh rotates refresh tokens (new token inserted; previous token revoked and linked via replaced_by_token_id).
- Session limits: handlers consult `auth_session_limits_user`, `auth_session_limits_group`, and `auth_session_limits_role` to enforce a cap on active sessions when creating a new session.

**Frontend ↔ Backend Communication (what is implemented)**
- Frontend API client: `apps/web/src/api/http.ts` implements `apiFetchJson`:
	- Uses `getApiBaseUrl()` from `apps/web/src/api/config.ts` (env `VITE_API_BASE_URL`, default `http://localhost:8080`).
	- Sends `credentials: 'include'` so the browser sends/receives cookies set by the gateway.
	- For unsafe methods, reads the `ace_csrf` cookie and sets `X-CSRF-Token` header.
	- On a 401 response, does a one-shot refresh by calling `{base}/{portal}/auth/refresh` and retrying the original request if refresh succeeds. Portal is determined by pathname via `apps/web/src/auth/token.ts`.
- Portal concept:
	- Frontend recognizes three portals by pathname: `student`, `instructor`, `admin` (via `getPortalFromPathname`).
	- Frontend uses portal-specific auth endpoints (`/student/auth/*`, `/instructor/auth/*`, `/admin/auth/*`).
	- The app no longer persists access tokens to localStorage for normal requests; cookies are the primary auth mechanism. LocalStorage is used only as a portal hint (`ACTIVE_PORTAL_KEY`).
- API surface used by frontend: `apps/web/src/api/endpoints.ts` lists and calls implemented endpoints (auth, exam-sessions, practice-sessions, practice-templates, questions, exam-packages, enrollments, admin/instructor paths).

**Notable runtime behaviors (explicit in code)**
- CORS: main.go provides minimal CORS allowing origins from `CORS_ORIGINS` env or `http://localhost:5173` (dev-friendly). Credentials/Cookies supported.
- DB migrations: `db.Migrate` is idempotent and contains safety/backfill scripts for legacy data (exam package id normalization, mapping legacy question-bank package relationships).
- Error reporting: handlers typically return `{ "message": "..." }` for client-visible errors; frontend surfaces these messages in `ApiError`.

**Limitations / Unclear from code**
- Background workers or async processors for scoring, analytics, or long-running tasks: unclear from code (no worker processes found in this repo).
- Any services outside the API gateway (e.g., dedicated microservices) are not present in this tree — unclear from code.

**Key files referenced**
- `services/api-gateway/cmd/api-gateway/main.go` — server entrypoint and middleware setup
- `services/api-gateway/internal/db/db.go` — DB connection, migration, seeding
- `services/api-gateway/internal/auth` — JWT, opaque tokens, password hashing, middleware
- `services/api-gateway/internal/handlers/auth.go` — implemented auth endpoints
- `services/api-gateway/internal/handlers/exam.go` — exam session APIs
- `services/api-gateway/internal/handlers/questions.go` — question bank APIs
- `apps/web/src/api/http.ts` and `apps/web/src/api/endpoints.ts` — frontend API client and endpoint wrappers
- `apps/web/src/auth/token.ts` — portal helpers and localStorage handling

**Next steps / suggestions (explicit, optional)**
- If you want, I can: add sequence diagrams of auth flows, expand per-endpoint contracts, or link OpenAPI schema (if present) into this document. Otherwise this is a concise, code-backed system overview.



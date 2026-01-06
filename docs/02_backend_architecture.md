**Backend Architecture (implemented behavior)**

This document maps the implemented backend code in this repository: entry points, routing, major packages, their dependencies, and what data each module owns or mutates. It describes only what the code actually implements.

**Application entry point(s)**
- `apps/backend/cmd/api/main.go` — single binary entrypoint. Responsibilities:
	- Connect to PostgreSQL via `internal/db.Connect` and run `db.Migrate`.
	- Create a Gin router, install CORS and double-submit CSRF middleware, register handlers, and run the HTTP server.

There are no other running services implemented in this repo — the API gateway is the main backend service.

**Routing structure (high-level)**
- Routes are registered by the `handlers` package via functions called from `main.go`:
	- `handlers.RegisterAuthRoutes` → auth endpoints under `/student/auth`, `/instructor/auth`, `/admin/auth` (and legacy `/auth/*`).
	- `handlers.RegisterEnrollmentRoutes` → public `/exam-packages` and student enrollment endpoints under `/student/enrollments` and instructor package updates under `/instructor/exam-packages`.
	- `handlers.RegisterPracticeRoutes` → `/practice-sessions`, `/practice-templates`, instructor endpoints under `/instructor/*` and related session endpoints.
	- `handlers.RegisterExamRoutes` → `/exam-sessions/*` (heartbeat, events, submit, list, get).
	- `handlers.RegisterQuestionRoutes` → `/questions`, `/question-banks`, `/question-topics`, and instructor/admin paths for managing questions under `/instructor/*` and `/admin/*`.
	- `handlers.RegisterAdminRoutes` → admin dashboard and admin CRUD under `/admin/*`.

Routes are grouped by portal (student/instructor/admin) and protected with `auth.RequirePortalAuth` or custom role checks where required.

**Major internal packages / modules**
- `services/api-gateway/cmd/api-gateway` (main): server startup, middleware, route registration.
- `apps/backend/internal/db`: DB connection, idempotent migration and seed/backfill logic.
- `services/api-gateway/internal/auth`: authentication primitives and middleware.
- `services/api-gateway/internal/handlers`: HTTP handlers (multiple files) implementing domain APIs.
- `services/api-gateway/internal/util`: small utilities (ID generation).

**Dependency summary (who depends on what)**
- `main` -> `db`, `handlers`.
- `handlers/*` -> `auth`, `db` (via the pooled `pgx` passed in main), `util` (ID generation), third-party packages (`gin`, `pgx`), and internal helpers like `list_params.go`.
- `db` -> `auth` (uses `auth.HashPassword` when bootstrapping users) and `util`.
- `auth` -> standard libs and third-party crypto/jwt packages (`github.com/golang-jwt/jwt/v5`, `crypto`, `bcrypt`).
- `util` -> no internal deps.

Graphically: main → db
								 main → handlers → auth
																→ util
																→ db (via pool)

**Shared utilities vs domain logic**
- Shared utilities:
	- `internal/util` — `NewID` used across handlers and db bootstrapping.
	- `handlers/list_params.go` — common query param parsing used by multiple handler files.
	- `internal/auth/middleware.go` — cross-cutting auth middleware used by many routes.
- Domain logic:
	- `handlers/*` files contain domain-specific request handling and DB mutations (auth flows, exam sessions, practice sessions, questions, admin operations, enrollments).
	- `internal/db` contains schema and migration/backfill logic (domain-model schema definitions live here).

**Per-module breakdown**

1) `services/api-gateway/cmd/api-gateway/main.go`
- Purpose: process bootstrap, connect to DB, install CORS & CSRF middleware, register handlers, run HTTP server.
- Called by: executed as the binary entrypoint.
- Data owned/mutated: none directly; it wires components that mutate DB and cookies via handlers.

2) `services/api-gateway/internal/db` (`db.go`)
- Purpose: establish `pgx` pool, run schema creation/migrations, seed and backfill legacy data, and bootstrap admin/instructor users from environment.
- Who calls it: `main.go` at startup.
- Data owned/mutated: creates and mutates database schema and seed rows across many tables (users, exam_packages, question bank tables, auth_sessions, auth_refresh_tokens, practice_sessions, exam_sessions, etc.). The migration code contains SQL that creates tables and executes idempotent backfills.

3) `services/api-gateway/internal/auth` (package: `jwt.go`, `opaque_tokens.go`, `password.go`, `middleware.go`)
- Purpose:
	- `jwt.go`: issue and parse JWT access tokens containing subject, role, audience, session id.
	- `opaque_tokens.go`: generate random opaque tokens and compute SHA-256 hashes for storage.
	- `password.go`: bcrypt password hash and verify.
	- `middleware.go`: `RequirePortalAuth` and `RequireAuth` middleware that validate tokens, verify session revocation/expiry against DB, and set request context user/role/session.
- Who calls it: handlers use `auth` to create/verify tokens and to protect routes; `db.Migrate` calls `auth.HashPassword` during bootstrap.
- Data owned/mutated: does not own persistent data directly but reads environment (`JWT_SECRET`) and uses cryptographic primitives; tokens and token hashes are created here and persisted by handlers into DB tables (`auth_refresh_tokens`, `auth_sessions`). Middleware reads DB session rows to enforce revocation/expiry.

4) `services/api-gateway/internal/handlers` (multiple files)
- Purpose: implement HTTP endpoints and domain logic. Files include:
	- `auth.go` — register/login/refresh/logout/me and cookie handling (sets `ace_access`, `ace_refresh`, `ace_csrf` cookies). Manages `auth_sessions` and `auth_refresh_tokens` rows in DB.
	- `exam.go` — exam session lifecycle (heartbeat, submit, events) persisted to `exam_sessions`, `exam_session_events`, and related tables.
	- `questions.go` — question bank CRUD, choices, publish/approval workflows; mutates question bank tables and related choice/metadata tables.
	- `enrollments.go` — exam package listing, student enroll/unenroll, instructor updates to packages; mutates `user_exam_package_enrollments` and `exam_packages`.
	- `practice.go` — practice session lifecycle, session creation, answers, timing, summary, and review; mutates `practice_sessions`, `practice_answers` and reads `practice_templates`.
	- `practice_templates.go` — instructor CRUD for practice templates (not detailed above but present in repository).
	- `admin_routes.go` — admin dashboard, admin CRUD for users, sessions, groups, exam packages, and admin exam session actions; mutates users, auth_sessions, auth_refresh_tokens, exam session flags, audit_log, and exam_packages.
	- `list_params.go` — shared small helper for list pagination.
- Who calls it: HTTP requests routed by Gin (registered from `main.go`). Internal helper functions (e.g., `authRequireRolesAndAudiences`) are used across handler files.
- Data owned/mutated: these handlers are the codepaths that mutate application data in the DB: user rows, sessions, refresh tokens, exam and practice session tables, question bank tables, audit log, enrollments, templates, etc.

5) `services/api-gateway/internal/util` (`ids.go`)
- Purpose: generate random IDs with optional prefix (`NewID`).
- Who calls it: used across handlers and `db` for generating primary keys for new DB rows (e.g., `util.NewID("usr")`).
- Data owned/mutated: none; produces identifiers used by other modules.

**Database tables and which modules touch them (representative, not exhaustive)**
- `users` — created/queried by `db` bootstrap and `handlers/auth.go` (register/login), admin user management in `admin_routes.go`.
- `auth_sessions` — written/updated by `handlers/auth.go` (create session on login/register, update last_seen), read by `internal/auth` middleware for token validation, revoked by logout endpoints and admin actions.
- `auth_refresh_tokens` — written by `handlers/auth.go` (store hashed refresh tokens), read in refresh flow, rotated on refresh.
- `exam_sessions`, `exam_session_events`, `exam_session_flags` — written/read by `handlers/exam.go` and visible via admin routes.
- `practice_sessions`, `practice_answers`, `practice_templates` — handled by `handlers/practice.go` and `handlers/practice_templates.go`.
- `question_bank_*` tables — created/read/updated by `handlers/questions.go` and admin routes.
- `exam_packages`, `user_exam_package_enrollments` — used by `handlers/enrollments.go` and package-related admin/instructor endpoints.
- `audit_log` — written by `admin_routes.go` and some handlers for auditing changes.

**Runtime cross-cutting concerns**
- CSRF: enforced in `main.go` middleware by comparing `X-CSRF-Token` header to `ace_csrf` cookie on unsafe methods.
- CORS: minimal dev-friendly CORS in `main.go`, configurable via `CORS_ORIGINS`.
- Session limits: business logic in `handlers/auth.go` consults `auth_session_limits_*` tables to cap active sessions per user/group/role.
- DB migrations/backfill: `db.Migrate` contains a significant amount of schema setup and idempotent backfill logic for legacy package IDs.

**Things that are not present / ignored**
- No background worker or separate microservice code is present in this repository — all implemented behavior lives in the API gateway binary.
- No external queues or schedulers are implemented here; any mention of other services is not implemented in this codebase and thus ignored.
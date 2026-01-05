**Database Model (implemented schema and data flows)**

This document summarizes the PostgreSQL schema created by `services/api-gateway/internal/db/db.go`, the relationships between tables, which backend modules read and write each table, and how data flows through the system at runtime. Only tables and flows that are actually referenced in the code are described.

Core tables and purpose
- `users` — primary user records (id, email, password_hash, role, created_at, updated_at, deleted_at).
	- Used by: `handlers/auth.go` (register/login/me), `handlers/admin_routes.go` (admin user CRUD, stats), `db.Migrate` (bootstrap), many handlers for foreign-key constraints.

- `auth_sessions` — server-side session records (id, user_id, role, audience, ip, user_agent, created_at, last_seen_at, expires_at, revoked_at, revoked_reason).
	- Used by: `handlers/auth.go` (create session on login/register, revoke on logout/logout-all, enforce session limits), `internal/auth` middleware (validate access token by checking session revocation/expiry), `handlers/admin_routes.go` (list/revoke sessions).

- `auth_refresh_tokens` — hashed opaque refresh tokens linked to sessions (id, session_id, token_hash, created_at, expires_at, revoked_at, replaced_by_token_id).
	- Used by: `handlers/auth.go` (store refresh tokens at login/register, rotate on refresh, lookup on logout fallback), `handlers/admin_routes.go` (revoke tokens for user sessions).

- `auth_session_groups`, `auth_session_group_memberships`, `auth_session_limits_group`, `auth_session_limits_user`, `auth_session_limits_role` — session limit/group tables.
	- Purpose: allow admin to set active-session limits per user/group/role; groups map users to a named group with an optional cap.
	- Used by: `handlers/auth.go` (getSessionLimit/enforceSessionLimit), `handlers/admin_routes.go` (admin CRUD for groups and limits).

- `exam_packages` — canonical exam package metadata (id uuid, code, name, subtitle, overview, modules, highlights, module_sections, is_hidden, created_at, updated_at).
	- Used by: `handlers/enrollments.go` (list public packages), `handlers/practice.go` (resolve enrollment), `handlers/questions.go` (associate question banks to packages), `handlers/admin_routes.go` (admin CRUD), `db.Migrate` (seed samples/backfill legacy IDs).

- `user_exam_package_enrollments` — many-to-many enrollments (user_id, exam_package_id, created_at).
	- Used by: `handlers/enrollments.go` (list, enroll, cancel), `handlers/auth.go` (auto-enroll new students into visible packages), `handlers/practice.go`, `handlers/exam.go`, `handlers/practice_templates.go` (checks for enrollment when starting sessions or using templates).

- `practice_test_templates` — instructor-created templates describing practice session selection (id, exam_package_id, name, section, topic_id, difficulty_id, is_timed, target_count, etc.).
	- Used by: `handlers/practice_templates.go` and `handlers/practice.go` (template-driven practice session creation).

- `practice_sessions` — active and historic practice sessions (id, user_id, package_id, template_id, is_timed, started_at, time_limit_seconds, target_count, current_index, question_timings, questions_snapshot, correct_count, status, etc.).
	- Used by: `handlers/practice.go` (create sessions, pause/resume, submit answers, list sessions, summaries) and by `db.Migrate` for schema management.

- `practice_answers` — recorded answers for practice sessions (id, session_id, user_id, question_id, choice_id, correct, explanation, ts).
	- Used by: `handlers/practice.go` (recording and reviewing answers).

- `exam_sessions` — server-backed exam sessions (user_id, id, status, exam_package_id, snapshot jsonb, created_at, updated_at, last_heartbeat_at, submitted_at, terminated_at, terminated_by_user_id, termination_reason, invalidated_at, invalidated_by_user_id, invalidation_reason).
	- Used by: `handlers/exam.go` (heartbeat upserts, submit, events), `handlers/admin_routes.go` (admin listing and actions), `handlers/auth.go` (resolve enrollments when registering students into packages).

- `exam_session_events` — event log for exam sessions (id, user_id, session_id, event_type, payload, created_at).
	- Used by: `handlers/exam.go` (record events) and `handlers/admin_routes.go` (admin listing of events).

- `exam_session_flags` — admin flags for sessions (id, user_id, session_id, flag_type, note, created_by_user_id, created_at).
	- Used by: `handlers/admin_routes.go` (flagging sessions); `handlers/exam.go` may not write flags directly.

- `audit_log` — audit trail for admin/instructor actions (id, actor_user_id, actor_role, action, target_type, target_id, metadata, created_at).
	- Used by: `handlers/admin_routes.go` and some handlers (e.g., enrollment updates) to record actions.

- Question bank tables (normalized model):
	- `question_bank_packages` — question bank packages (id text primary key, name, exam_package_id legacy field, created_by_user_id, is_hidden, created_at).
	- `exam_package_question_bank_packages` — mapping table (exam_package_id uuid, question_bank_package_id text).
	- `question_bank_topics` — topics per package (id, package_id, name, created_by_user_id, is_hidden, created_at).
	- `question_bank_difficulties` — difficulty reference rows (id, display_name, sort_order). Seeded with `easy`, `medium`, `hard`.
	- `question_bank_questions` — question rows (id, package_id, topic_id, difficulty_id, prompt, explanation_text, review_note, status, created_by_user_id, updated_by_user_id, created_at, updated_at).
	- `question_bank_choices` — choices for questions (id, question_id, order_index, text).
	- `question_bank_correct_choice` — maps question_id -> correct choice_id.
	- Used by: `handlers/questions.go` (full CRUD for public/instructor/admin flows), `handlers/admin_routes.go` (stats), and some template selection code.

Relationships (key foreign keys and common joins)
- `auth_sessions.user_id` → `users.id` (session ownership).
- `auth_refresh_tokens.session_id` → `auth_sessions.id` (refresh token → session).
- `user_exam_package_enrollments.exam_package_id` → `exam_packages.id`.
- `practice_sessions.package_id` → `exam_packages.id` (nullable) and `practice_sessions.template_id` → `practice_test_templates.id`.
- `practice_answers.session_id` → `practice_sessions.id`.
- `exam_sessions` primary key is composite `(user_id, id)` with `exam_sessions.user_id` → `users.id` and `exam_sessions.exam_package_id` → `exam_packages.id`.
- `exam_session_events.user_id, session_id` → `exam_sessions(user_id, id)` (foreign key enforced in migration).
- `question_bank_packages.created_by_user_id` and `question_bank_topics.created_by_user_id` → `users.id`.
- `question_bank_questions.package_id` → `question_bank_packages.id`; `topic_id` → `question_bank_topics.id`; `difficulty_id` → `question_bank_difficulties.id`.
- `question_bank_choices.question_id` → `question_bank_questions.id`; `question_bank_correct_choice.question_id` → `question_bank_questions.id` and choice_id → `question_bank_choices.id`.
- `exam_package_question_bank_packages` maps `exam_packages.id` ↔ `question_bank_packages.id` enabling package → question bank lookups.

Which backend modules interact with which tables (summary)
- `handlers/auth.go`:
	- Write: `users` (insert on register), `auth_sessions` (insert new session), `auth_refresh_tokens` (insert hashed token), `user_exam_package_enrollments` (best-effort enroll on register for students).
	- Read: `users` (lookup on login/me), `auth_refresh_tokens` (lookup on refresh), `auth_sessions` (revoke/lookup for logout and enforcement).

- `internal/auth` (middleware functions):
	- Read: `auth_sessions` (validate session not revoked and not expired), update last_seen_at.

- `handlers/exam.go`:
	- Read/Write: `exam_sessions` (insert/upsert on heartbeat, update on submit), `exam_session_events` (insert events), `exam_session_flags` (admin flags via admin routes), `user_exam_package_enrollments` (resolve enrollments when package not provided).

- `handlers/practice.go` and `handlers/practice_templates.go`:
	- Read/Write: `practice_sessions` (create/update/finish), `practice_answers` (insert answers), `practice_test_templates` (read templates, instructor CRUD elsewhere), and `user_exam_package_enrollments` for enrollment checks.

- `handlers/questions.go`:
	- Read/Write: `question_bank_packages`, `question_bank_topics`, `question_bank_difficulties` (read), `question_bank_questions`, `question_bank_choices`, `question_bank_correct_choice`, and mapping table `exam_package_question_bank_packages` for package associations.

- `handlers/enrollments.go`:
	- Read/Write: `exam_packages` (list), `user_exam_package_enrollments` (list, insert, delete), and instructor patch updates `exam_packages` fields.

- `handlers/admin_routes.go`:
	- Wide coverage: reads/writes `users`, `auth_sessions`, `auth_refresh_tokens`, session limits/tables, `exam_packages`, `exam_sessions`, `exam_session_events`, `exam_session_flags`, question bank tables, and writes to `audit_log` for admin actions.

- `db.Migrate` (`internal/db/db.go`):
	- Creates all tables, indexes, seeding of `question_bank_difficulties` and some `exam_packages`, backfills legacy IDs and normalizes types (text -> uuid conversions for `exam_packages.id` and dependent columns), and bootstraps admin/instructor users by writing into `users`.

Tables that appear unused or minimally referenced
- Most tables created in `db.Migrate` are explicitly used by handlers. A few notes about relative usage intensity:
	- `auth_session_groups`, `auth_session_group_memberships`, and `auth_session_limits_group` are used only by admin routes and the session-limit lookup logic; they are more admin/ops-focused and less commonly hit during normal user flows.
	- Migration-only columns/legacy fields: `question_bank_packages.exam_package_id` (legacy) is backfilled into `exam_package_question_bank_packages` and primarily retained for migration safety; application logic prefers the mapping table. The legacy field exists mainly for backfill safety rather than active use.
	- `audit_log` is written by admin actions; it is not used by the core user-facing handlers except for audit recording and admin inspection.

Data flow examples (concrete sequences implemented in code)
- Login/register flow (in `handlers/auth.go`):
	1. Client POSTs credentials to `/.../auth/login` or `/.../auth/register`.
	2. Server verifies/creates `users` row (register) and computes `bcrypt` password hash.
	3. Server creates an `auth_sessions` row (session id), issues a JWT access token (signed) and an opaque `auth_refresh_tokens` row storing the hashed refresh token.
	4. Server sets cookies: `ace_access` (JWT), `ace_refresh` (opaque token), and `ace_csrf` (double-submit token). Client uses cookies for subsequent requests.

- Token refresh flow (in `handlers/auth.go` and `internal/auth`):
	1. Client calls `/.../auth/refresh` (cookie `ace_refresh` included by browser).
	2. Server looks up `auth_refresh_tokens` by hashed token, verifies session not revoked and not expired, then inserts a new refresh token row and revokes the old one (records replaced_by_token_id) and updates `auth_sessions.last_seen_at`.
	3. Server issues a new JWT access token and sets cookies (rotates refresh token cookie and csrf cookie).

- Exam heartbeat / event flow (in `handlers/exam.go`):
	1. Student sends heartbeat to `/exam-sessions/:sessionId/heartbeat` with snapshot. Server resolves `exam_package_id` (either provided or inferred from `user_exam_package_enrollments`).
	2. Server upserts into `exam_sessions` (insert or update last_heartbeat_at, snapshot, status active).
	3. Events posted to `/exam-sessions/:sessionId/events` are inserted into `exam_session_events` for later inspection by admin.

- Practice session flow (in `handlers/practice.go`):
	1. Student creates a practice session (optionally template-driven). Server validates enrollment and template publishing state, then writes a `practice_sessions` row and returns the first question snapshot.
	2. Submitting answers writes rows to `practice_answers`, updates `practice_sessions` counters, and the session can be reviewed via `practice_sessions/.../review` which reads `practice_answers` and `practice_sessions` snapshots.

Summary
- The migration script (`db.Migrate`) defines a normalized relational schema capturing users, sessions, exam packages, enrollments, practice and exam sessions, question banks, and admin-related limits and audit logs. Handlers implement concrete flows that read and mutate those tables; auth/session tables are central to request validation.
- No tables appear to be orphaned — even admin/limits tables are referenced from admin routes and session-limit enforcement logic. Legacy fields exist for migration/backfill safety and are only minimally used by the migration code.

If you want, I can generate a DOT/graphviz diagram of these table relationships, or an endpoint→table mapping CSV to drive a data migration plan. Which would help you most next?

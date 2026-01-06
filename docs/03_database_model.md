**Database Model (implemented schema and data flows)**

This document summarizes the PostgreSQL schema (as implemented by `services/api-gateway/internal/db/db.go`), the relationships between tables, which backend modules read and write each table, and how data flows through the system at runtime. Only tables and flows that are actually referenced in the code should be described here.

## Core tables and purpose

### Users & auth
- `users` — primary user records (id, email, password_hash, role, created_at, updated_at, deleted_at).
  - Used by: `handlers/auth.go` (register/login/me), `handlers/admin_routes.go` (admin user CRUD, stats), `db.Migrate` (bootstrap), and as the FK target for most user-owned records.

- `auth_sessions` — server-side session records (id, user_id, role, audience, ip, user_agent, created_at, last_seen_at, expires_at, revoked_at, revoked_reason).
  - Used by: `handlers/auth.go` (create on login/register, revoke on logout/logout-all, enforce session limits), `internal/auth` middleware (validate access token by checking session revocation/expiry and updating last_seen_at), `handlers/admin_routes.go` (list/revoke sessions).

- `auth_refresh_tokens` — hashed opaque refresh tokens linked to sessions (id, session_id, token_hash, created_at, expires_at, revoked_at, replaced_by_token_id).
  - Used by: `handlers/auth.go` (store/rotate refresh tokens, revoke old tokens), `handlers/admin_routes.go` (revoke tokens for user sessions).

- `auth_session_groups`, `auth_session_group_memberships`, `auth_session_limits_group`, `auth_session_limits_user`, `auth_session_limits_role` — session grouping/limit tables.
  - Purpose: allow admin to set active-session limits per user/group/role; groups map users to a named group with an optional cap.
  - Used by: `handlers/auth.go` (getSessionLimit/enforceSessionLimit), `handlers/admin_routes.go` (admin CRUD for groups and limits).

### Exam packages & tiers
- `exam_packages` — canonical exam package metadata (id uuid, code, name, subtitle, overview, modules, highlights, module_sections, is_hidden, created_at, updated_at).
  - Used by: `handlers/enrollments.go` (list public packages), `handlers/practice.go` (resolve enrollment), `handlers/questions.go` (question bank package scoping), `handlers/admin_routes.go` (admin CRUD), `db.Migrate` (seed/backfill).

- `exam_package_tiers` — tier definitions per exam package (id uuid, exam_package_id, code, name, sort_order, is_default, is_active, policy json, optional extracted limits, created_at, updated_at).
  - Purpose: package-specific entitlement/rate-limit policy (stored as a validated JSON policy blob), with optional “hot-path” extracted numeric limits.
  - Used by: enrollment logic (resolving a user’s tier), practice/exam session creation (tier-aware policy enforcement), and admin/instructor configuration.

- `user_exam_package_enrollments` — many-to-many enrollments (user_id, exam_package_id, tier_id nullable for legacy/backfill, created_at, updated_at).
  - Used by: `handlers/enrollments.go` (list/enroll/cancel/change tier), `handlers/auth.go` (best-effort enroll new students), `handlers/practice.go` / `handlers/exam.go` / `handlers/practice_templates.go` (authorization + tier resolution).

- `user_exam_package_enrollment_events` — append-only history of enrollment tier changes (id, user_id, exam_package_id, from_tier_id, to_tier_id, changed_at, changed_by_user_id, reason, metadata).
  - Used by: enrollment update flows and admin/instructor actions for auditability of tier transitions.

### Practice templates & sessions
- `practice_templates` — instructor-created templates describing practice selection (id, exam_package_id, name, section, topic_id, difficulty_id, is_timed, target_count, sort_order, is_published, created_by_user_id, updated_by_user_id, created_at, updated_at).
  - Used by: `handlers/practice_templates.go` (CRUD/publish), `handlers/practice.go` (template-driven practice session creation).

- `practice_sessions` — practice sessions (id, user_id, package_id uuid nullable for legacy rows, tier_id uuid, template_id uuid, is_timed, started_at, time_limit_seconds, target_count, current_index, current_question_started_at, paused_at, status, questions_snapshot json, question_timings json, correct_count, created_at, last_activity_at).
  - Used by: `handlers/practice.go` (create/pause/resume/submit/review/list/summary), plus policy checks against enrollment tier (where enforced by application).

- `practice_answers` — recorded answers for practice sessions (id, session_id, user_id, question_id, choice_id, correct, explanation, ts).
  - Used by: `handlers/practice.go` (recording answers and review).

### Exam sessions (mock tests)
- `exam_sessions` — server-backed exam sessions (composite PK (user_id, id); status; exam_package_id uuid nullable; tier_id uuid; snapshot json; created/updated/heartbeat/submission/termination/invalidation fields).
  - Used by: `handlers/exam.go` (heartbeat upserts, submit, state transitions), `handlers/admin_routes.go` (admin listing/actions/invalidations), enrollment resolution when package/tier aren’t explicitly provided.

- `exam_session_events` — event log for exam sessions (id, user_id, session_id, event_type, payload, created_at).
  - Used by: `handlers/exam.go` (record events), `handlers/admin_routes.go` (admin listing/inspection).

- `exam_session_flags` — admin flags for sessions (id, user_id, session_id, flag_type, note, created_by_user_id, created_at).
  - Used by: `handlers/admin_routes.go` (flagging), and admin review workflows.

### Question bank
- `question_banks` — question bank containers scoped to an exam package (id text, name, exam_package_id uuid, created_by_user_id, is_hidden, created_at, updated_at; unique (exam_package_id, name)).
  - Used by: `handlers/questions.go` (CRUD; bank selection and visibility), `handlers/admin_routes.go` (stats).

- `question_topics` — topics scoped to an exam package (id text, package_id uuid, name, created_by_user_id, is_hidden, created_at, updated_at; unique (package_id, name)).
  - Used by: `handlers/questions.go` (topic CRUD and filtering), practice template selection (topic_id).

- `question_difficulties` — difficulty reference rows (id, display_name, sort_order). Seeded with `easy`, `medium`, `hard`.
  - Used by: `handlers/questions.go` (read) and template/question filtering.

- `question_bank_questions` — question rows (id, question_bank_id, topic_id, difficulty_id, prompt, explanation_text, review_note, status, created_by_user_id, updated_by_user_id, created_at, updated_at).
  - Used by: `handlers/questions.go` (CRUD + listing), practice session snapshot generation.

- `question_bank_choices` — choices for questions (id, question_id, order_index, text; unique (question_id, order_index)).
  - Used by: `handlers/questions.go` (CRUD), practice/exam rendering.

- `question_bank_correct_choice` — maps question_id → correct choice_id.
  - Used by: `handlers/questions.go` and correctness checking.

### Audit log
- `audit_log` — audit trail for admin/instructor actions (id, actor_user_id, actor_role, action, target_type, target_id, metadata, created_at; indexes actor_user_id, created_at).
  - Used by: `handlers/admin_routes.go` and any privileged mutation endpoints that record audit actions.

## Relationships (key foreign keys and common joins)

### Auth
- `auth_sessions.user_id` → `users.id`
- `auth_refresh_tokens.session_id` → `auth_sessions.id`
- `auth_refresh_tokens.replaced_by_token_id` → `auth_refresh_tokens.id`
- `auth_session_group_memberships.group_id` → `auth_session_groups.id`
- `auth_session_group_memberships.user_id` → `users.id`
- `auth_session_limits_group.group_id` → `auth_session_groups.id`
- `auth_session_limits_user.user_id` → `users.id`

### Packages, tiers, enrollments
- `exam_package_tiers.exam_package_id` → `exam_packages.id`
- `user_exam_package_enrollments.user_id` → `users.id`
- `user_exam_package_enrollments.exam_package_id` → `exam_packages.id`
- `user_exam_package_enrollments.tier_id` → `exam_package_tiers.id` (nullable for legacy/backfill)
- `user_exam_package_enrollment_events.user_id` → `users.id`
- `user_exam_package_enrollment_events.exam_package_id` → `exam_packages.id`
- `user_exam_package_enrollment_events.from_tier_id` → `exam_package_tiers.id`
- `user_exam_package_enrollment_events.to_tier_id` → `exam_package_tiers.id`
- `user_exam_package_enrollment_events.changed_by_user_id` → `users.id`

### Practice
- `practice_templates.exam_package_id` → `exam_packages.id`
- `practice_templates.topic_id` → `question_topics.id`
- `practice_templates.difficulty_id` → `question_difficulties.id`
- `practice_templates.created_by_user_id` → `users.id`
- `practice_templates.updated_by_user_id` → `users.id`

- `practice_sessions.user_id` → `users.id`
- `practice_sessions.package_id` → `exam_packages.id` (nullable legacy)
- `practice_sessions.tier_id` → `exam_package_tiers.id`
- `practice_sessions.template_id` → `practice_templates.id`

- `practice_answers.session_id` → `practice_sessions.id`
- `practice_answers.user_id` → `users.id`
- `practice_answers.question_id` → `question_bank_questions.id`
- `practice_answers.choice_id` → `question_bank_choices.id`

### Exams
- `exam_sessions` primary key is composite `(user_id, id)`
- `exam_sessions.user_id` → `users.id`
- `exam_sessions.exam_package_id` → `exam_packages.id` (nullable)
- `exam_sessions.tier_id` → `exam_package_tiers.id`
- `exam_sessions.terminated_by_user_id` → `users.id`
- `exam_sessions.invalidated_by_user_id` → `users.id`

- `exam_session_events.(user_id, session_id)` → `exam_sessions.(user_id, id)`
- `exam_session_flags.(user_id, session_id)` → `exam_sessions.(user_id, id)`
- `exam_session_flags.created_by_user_id` → `users.id`

### Question bank
- `question_banks.exam_package_id` → `exam_packages.id`
- `question_banks.created_by_user_id` → `users.id`

- `question_topics.package_id` → `exam_packages.id`
- `question_topics.created_by_user_id` → `users.id`

- `question_bank_questions.question_bank_id` → `question_banks.id`
- `question_bank_questions.topic_id` → `question_topics.id`
- `question_bank_questions.difficulty_id` → `question_difficulties.id`
- `question_bank_questions.created_by_user_id` → `users.id`
- `question_bank_questions.updated_by_user_id` → `users.id`

- `question_bank_choices.question_id` → `question_bank_questions.id`
- `question_bank_correct_choice.question_id` → `question_bank_questions.id`
- `question_bank_correct_choice.choice_id` → `question_bank_choices.id`

### Audit
- `audit_log.actor_user_id` → `users.id`

## Which backend modules interact with which tables (summary)

- `handlers/auth.go`:
  - Write: `users`, `auth_sessions`, `auth_refresh_tokens`, `user_exam_package_enrollments` (best-effort enroll on register).
  - Read: `users`, `auth_refresh_tokens`, `auth_sessions`, (and tier/package resolution via enrollment joins when required).

- `internal/auth` (middleware):
  - Read/update: `auth_sessions` (validate not revoked/expired, update last_seen_at).

- `handlers/enrollments.go`:
  - Read/Write: `exam_packages`, `exam_package_tiers` (list/resolve defaults), `user_exam_package_enrollments` (create/update/delete), `user_exam_package_enrollment_events` (append tier-change history).

- `handlers/practice_templates.go`:
  - Read/Write: `practice_templates` (including publish state), reads `question_topics` / `question_difficulties` for selection constraints, and uses `users` for created/updated attribution.

- `handlers/practice.go`:
  - Read/Write: `practice_sessions`, `practice_answers`.
  - Read: `user_exam_package_enrollments` + `exam_package_tiers` (resolve tier/policy), and question-bank tables for building immutable `questions_snapshot`.

- `handlers/exam.go`:
  - Read/Write: `exam_sessions` (upsert heartbeat, submit, terminate/invalidate), `exam_session_events`.
  - Read: `user_exam_package_enrollments` + `exam_package_tiers` when resolving package/tier context.

- `handlers/questions.go`:
  - Read/Write: `question_banks`, `question_topics`, `question_bank_questions`, `question_bank_choices`, `question_bank_correct_choice`.
  - Read: `question_difficulties`, `exam_packages` (scoping), plus visibility/ownership checks via `users`.

- `handlers/admin_routes.go`:
  - Wide coverage across: `users`, auth tables, session-limit tables, `exam_packages`, `exam_package_tiers`, enrollment tables/events, exam/practice session tables, question-bank tables, and `audit_log`.

- `db.Migrate` (`internal/db/db.go`):
  - Creates all tables and indexes; seeds reference data (e.g., difficulties) and initial package/tier rows as applicable; bootstraps admin/instructor users.

## Tables removed / renamed compared to earlier iterations
- The package↔question-bank mapping table (`exam_package_question_bank_packages`) is no longer part of the active model; `question_banks` are directly scoped to an `exam_package_id`.
- `question_bank_topics` has been replaced by `question_topics` (scoped to `exam_packages` via `package_id`).
- Tiering is first-class: `exam_package_tiers` + tier references on enrollments and sessions.

## Data flow examples (concrete sequences implemented in code)

- Login/register flow:
  1. Client POSTs credentials to `/.../auth/login` or `/.../auth/register`.
  2. Server verifies/creates `users` row; password hashed with `bcrypt`.
  3. Server creates an `auth_sessions` row, issues JWT access token, and stores a hashed opaque refresh token in `auth_refresh_tokens`.
  4. Server sets cookies: `ace_access` (JWT), `ace_refresh` (opaque), `ace_csrf` (double-submit token).

- Token refresh flow:
  1. Client calls `/.../auth/refresh` (includes `ace_refresh` cookie).
  2. Server looks up `auth_refresh_tokens` by hashed token, verifies session validity, inserts a new refresh token row and revokes the old one (sets replaced_by_token_id), updates `auth_sessions.last_seen_at`.
  3. Server issues a new JWT access token and rotates refresh/csrf cookies.

- Enrollment + tier assignment/change:
  1. User enrolls (or is auto-enrolled) into an `exam_packages` row; server selects a tier (often the package’s default active tier) and writes `user_exam_package_enrollments` with `tier_id`.
  2. Tier changes update `user_exam_package_enrollments.tier_id` and append a corresponding `user_exam_package_enrollment_events` record (from_tier_id → to_tier_id, changed_by_user_id, reason/metadata).
  3. Practice/exam session creation resolves tier from enrollment and applies tier policy in application logic.

- Practice session flow:
  1. Student creates a practice session (optionally template-driven). Server validates enrollment, resolves `tier_id`, checks template `is_published` where applicable, then writes `practice_sessions` with an immutable `questions_snapshot`.
  2. Submitting answers writes `practice_answers`, updates session counters/state, and updates `last_activity_at`.
  3. Review endpoints read `practice_sessions` snapshots + `practice_answers` for rendering.

- Exam heartbeat / event flow:
  1. Student sends heartbeat to `/exam-sessions/:sessionId/heartbeat` with snapshot. Server resolves `exam_package_id`/`tier_id` (explicit or inferred from `user_exam_package_enrollments`).
  2. Server upserts into `exam_sessions` (insert or update `last_heartbeat_at`, snapshot, status).
  3. Events posted to `/exam-sessions/:sessionId/events` are inserted into `exam_session_events` for later inspection; admins may add `exam_session_flags`.

## Summary
- The schema captures: users/auth sessions, exam packages with tiered entitlements, enrollments with tier history, practice and exam sessions, a package-scoped question bank, and admin audit trails.
- Tiering (`exam_package_tiers` + tier_id on enrollments/sessions) is the primary structural change: policies are stored per tier and enforced in the application layer, with optional extracted numeric limits for hot paths.


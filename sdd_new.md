# Software Design Document (SDD) — Authoritative

Online Exam Preparation Platform

Version: 2.0
Date: January 2026
Status: Authoritative (Post-MVP, Upgrade Baseline)

---

## 1. Executive Summary

This document is the **single-source-of-truth** design for the Online Exam Preparation Platform. It defines the authoritative architecture, domain model, API contracts, data model, operational considerations, and migration/cleanup strategy.

Goals:
- Establish a clear domain model centered on **Exam Packages, Tiers, Enrollments, Templates, and Sessions**.
- Move responsibilities consistently to the backend: server-enforced entitlements and session lifecycle.
- Make the codebase modular and refactorable (modular monolith, extraction-friendly boundaries).
- Provide a concrete migration path from legacy behaviors to the model defined here.

Non-goals:
- Full microservice deployment at this stage.
- Client-enforced authorization or core business logic.

Document guarantees:
- Backend behavior must conform to this SDD for: **entitlements**, **session state machines**, **API status semantics**, and **database invariants**.
- The OpenAPI specification is the executable contract for clients; this SDD is the design authority when clarifying intent and invariants.

---

## 2. Scope & Audience

This SDD targets backend, frontend, and product engineers who will implement or refactor features post-upgrade, as well as DevOps and QA engineers who will deploy and validate changes. It defines the authoritative runtime behavior, API contracts, and data model that must be preserved.

---

## 3. Terminology and Primary Roles

- Student: consumes practice and mock test experiences.
- Instructor: creates and manages content (templates, question banks) and packages.
- Admin: operational steward; can manage global configuration and remediate sessions.

Domain terms:
- Exam Package: top-level product (e.g., GRE, IELTS). Owns question banks, templates, and tier definitions.
- Tier: a policy container within an Exam Package (e.g., Free, Premium). Controls feature access.
- Enrollment: binds a `user` to an `exam package` and a specific `tier` (authorization primitive).
- Question Bank: curated collection of questions owned by an Exam Package.
- Practice Template: blueprint (question selection, timing, constraints) used to instantiate practice sessions.
- Practice Session / Exam Session: runtime instantiation of a template; persisted server-side and treated as a state machine.

---

## 4. High-Level Architecture

4.1 Architecture Style
- Modular Monolith with clear Clean Architecture boundaries to enable future extraction to microservices.

4.2 Logical Layers
- Presentation (React): UI, routing, local caching for UX only.
- API Layer (Go): request validation, authentication, orchestration, policy decision point.
- Domain Layer: business rules, entitlement checks, session state machines.
- Persistence Layer: PostgreSQL primary, Redis for caching/session/rate limits, optional MongoDB for future flexible question storage.

4.3 Responsibilities
- Frontend: rendering, optimistic UX, minimal client-side validations; never enforce entitlements.
- Backend: single source of truth — enforces enrollment, tiers, session lifecycle, and persistence.
- Database: durable storage of facts, not business logic.

4.4 Rationale
- Cohesion for domain complexity; avoid premature distributed architecture.

4.5 Core Backend Modules (Authoritative Boundaries)

Goal: keep business rules in one place, minimize cross-module coupling, and keep seams that allow future service extraction.

**Module map (Go)**
- `cmd/api`: bootstraps HTTP server, DI wiring, config loading.
- `internal/api/http`:
  - Route definitions (versioned), request/response DTOs, validation.
  - Calls application services; does not contain business rules.
- `internal/auth`:
  - Cookie/JWT parsing, refresh, CSRF primitives, identity extraction (`Principal`).
- `internal/policy` (centralized Policy Decision Point):
  - Tier + role checks; returns decision objects `{allowed, reason, metadata}`.
  - Emits audit events for allow/deny.
- `internal/domain/...` (pure domain rules; no DB calls):
  - `enrollment`: invariants for active tier, transitions, history immutability.
  - `sessions/practice`: state machine + timing rules (pause/resume, expiry, finalize).
  - `sessions/exam`: state machine + heartbeat rules + integrity events.
  - `templates`: publish immutability rules and snapshot semantics.
- `internal/app` (application services / use-cases):
  - Orchestrates: validate principal → policy check → domain transitions → persistence.
  - Owns transactions and idempotency behavior.
  - Example services:
    - `EnrollmentService`
    - `PracticeSessionService`
    - `ExamSessionService`
    - `TemplateService`
- `internal/repo` (persistence adapters):
  - PostgreSQL repositories; query code; transaction helpers.
  - Redis adapters for caching/rate limits (never source-of-truth).
- `internal/obs`:
  - Structured logging, tracing, metrics, audit log writer.
- `internal/admin`:
  - Admin-only orchestration: invalidate sessions, remediate enrollments, configuration toggles.

**Extraction-friendly seams**
- `policy` and `question-bank` are designed to be separable services later:
  - They expose interfaces used by `internal/app`.
  - No direct HTTP calls inside domain logic; only interfaces.

---

## 5. Core Domain Model (Authoritative)

5.1 Exam Package
- Contains metadata (code, name, description), owned question banks, templates, and tier definitions metadata pointer.
- Can be versioned; packages are first-class product units.

5.2 Tier
- A policy object bound to a single Exam Package.
- Contains capability flags (e.g., can_start_practice_session, can_access_mock_tests), rate limits (e.g., max_practice_sessions_per_week), and feature toggles (analytics depth, review granularity).

5.3 Enrollment
- Binds `user_id` → `exam_package_id` with an active tier.
- History of tier changes is immutable; current active tier is used for authorization decisions.

5.4 Question Bank
- Owned by an Exam Package; questions are canonical and referenced by sessions.

5.5 Practice Template
- Reusable, immutable when published; templates define question selection criteria, timing, target counts, and optional tier restrictions.

5.6 Practice Session & Exam Session
- Persisted server-side in `practice_sessions` and `exam_sessions` tables respectively.
- Created only after enrollment & tier checks by the API.
- Exposed as state machines; allowed transitions validated server-side.
- Sessions are append-only for primary activity (answers, heartbeats) until finalization.

---

## 6. Tier Policy & Authorization Model

6.1 Policy Engine
- Centralized policy evaluation in the backend. Public decision APIs are simple booleans or small decision objects (e.g., `can_start_session(user, package, template)` returns {allowed: true/false, reason}).

6.2 Enforcement Points
- Session creation, template visibility, feature gating, rate-limited endpoints.

6.3 Design Principles
- DRY: Avoid duplicated rules across controllers; use a single policy layer.
- Observable: Policy decisions are logged for audit and debugging.

---

## 7. API Design (OpenAPI-first)

7.1 Principles
- RESTful and resource-oriented.
- OpenAPI contract is authoritative for client code generation.
- Cookie-based auth with CSRF protection for unsafe methods.

7.2 Key Resources & Endpoints (Authoritative)
- `GET /exam-packages` — list packages and public metadata.
- `POST /student/enrollments` — create enrollment (server validates eligibility).
- `GET /practice-templates` — student catalog (only published templates for enrolled packages).
- `POST /practice-sessions` — create a session (validates enrollment and applies template settings).
- `GET /practice-sessions/{id}` — fetch session state.
- `POST /practice-sessions/{id}/answers` — submit an answer (records time, correctness, explanation snapshot).
- `POST /practice-sessions/{id}/pause` and `/resume` — pause/resume for untimed sessions only.
- `GET /practice-sessions/{id}/review` — review finished session.
- `GET /exam-sessions` and `/exam-sessions/{id}` — exam (mock) lifecycle with heartbeat and submit endpoints.

7.3 Error Handling and Status Codes
- 403 for entitlement violations, 404 for missing resources, 400 for validation errors, 409 for illegal state transitions.

7.4 Contract Guarantees
- When a session is returned, fields such as `question_order`, `current_index`, `status`, `time_limit_seconds`, and `question_timings` must be present and authoritative.

---

## 8. Data Model — Conceptual and Implementation Notes

8.1 Authoritative Storage Strategy
- PostgreSQL is the source-of-truth for: users, packages, tiers, enrollments, templates, sessions, answers, audit trails.
- Redis is a performance and rate-limit layer only; it must be safe to evict at any time.
- Optional MongoDB may be introduced for flexible question/explanation documents; Postgres retains canonical references and entitlements.

8.2 Authoritative Tables (PostgreSQL)
- `users` — user identity and role.
- `exam_packages` — package metadata and tier definitions metadata pointer.
- `exam_package_tiers` — per-package tier policy definitions (JSONB for flexible flags + typed columns for common constraints).
- `user_exam_package_enrollments` — enrollment history and active tier pointer.
- `question_bank`, `question_bank_questions`, `question_bank_choices`, `question_bank_correct_choice` — canonical question storage.
- `practice_templates` — templates with `is_published` and package linkage.
- `practice_sessions` — persisted sessions (id, user_id, package_id, template_id, question_order: JSONB, question_timings: JSONB, status, started_at, last_activity_at, etc.).
- `practice_answers` — append-only answers with verdict and explanation snapshot.
- `exam_sessions`, `exam_session_events`, `exam_session_flags` — exam integrity and events.

8.3 Modeling Choices and Constraints
- Keep `practice_sessions.package_id` nullable only for legacy compatibility; new sessions must include a package.
- Store tier policy in `exam_package_tiers` as JSONB rules plus normalized columns for frequently enforced constraints.
- Use indexes on `(user_id, status)` and `(created_at, last_activity_at)` for efficient history queries.

8.4 Authoritative PostgreSQL Schema (Tables, Keys, Indexes)

Note: column names below reflect required invariants; exact types may be `uuid`, `text`, `timestamptz`, `int`, `jsonb`, and `boolean`.

### `users`
- `id` (PK)
- `email` (unique), `role` (`student|instructor|admin`)
- `created_at`, `updated_at`

Indexes/constraints:
- unique(`email`)

### `exam_packages`
- `id` (PK)
- `code` (unique, stable identifier), `name`, `description`
- `tier_definitions_ref` (optional pointer/metadata)
- `created_at`, `updated_at`

Indexes/constraints:
- unique(`code`)

### `exam_package_tiers`
- `id` (PK)
- `exam_package_id` (FK → `exam_packages.id`, ON DELETE CASCADE)
- `code` (e.g., `free`, `premium`) unique **per package**
- `display_name`
- `policy` (JSONB; feature flags, caps, toggles)
- Common enforced columns (normalized for performance), e.g.:
  - `can_start_practice_session` (bool)
  - `can_access_mock_tests` (bool)
  - `max_practice_sessions_per_week` (int, nullable)
- `created_at`, `updated_at`

Indexes/constraints:
- unique(`exam_package_id`, `code`)
- index(`exam_package_id`)

### `user_exam_package_enrollments` (immutable history + active pointer)
- `id` (PK)
- `user_id` (FK → `users.id`)
- `exam_package_id` (FK → `exam_packages.id`)
- `tier_id` (FK → `exam_package_tiers.id`)
- `status` (`active|ended`)
- `started_at`, `ended_at` (nullable)
- `created_at`

Invariants:
- Exactly one `active` enrollment per (`user_id`, `exam_package_id`) at a time.
- Tier changes create a new row; old row is ended.

Indexes/constraints:
- index(`user_id`, `exam_package_id`, `status`)
- partial unique: unique(`user_id`, `exam_package_id`) WHERE `status` = 'active'

### Question bank (canonical, package-owned)
#### `question_bank`
- `id` (PK)
- `exam_package_id` (FK → `exam_packages.id`)
- `name`, `created_at`

#### `question_bank_questions`
- `id` (PK)
- `question_bank_package_id` (FK → `question_bank.id`)
- `prompt` (text), `metadata` (JSONB), `difficulty` (nullable)
- `created_at`, `updated_at`

#### `question_bank_choices`
- `id` (PK)
- `question_id` (FK → `question_bank_questions.id`)
- `label` (e.g., `A`), `text`
- `created_at`

#### `question_bank_correct_choice`
- `question_id` (PK/FK → `question_bank_questions.id`)
- `choice_id` (FK → `question_bank_choices.id`)

Indexes/constraints:
- index(`question_bank_package_id`)
- index(`question_id`) on choices
- enforce one correct choice per question (PK on `question_id`)

### `practice_templates`
- `id` (PK)
- `exam_package_id` (FK → `exam_packages.id`)
- `title`, `description`
- `selection_rules` (JSONB: topic tags, difficulty bounds, etc.)
- `time_limit_seconds` (nullable; null = untimed)
- `question_count` (int)
- `tier_restrictions` (JSONB or nullable)
- `is_published` (bool)
- `published_at` (nullable)
- `version` (int; increments on publish snapshot)
- `created_at`, `updated_at`

Invariants:
- Published templates are immutable; changes require creating a new version/snapshot.

Indexes/constraints:
- index(`exam_package_id`, `is_published`)

### `practice_sessions`
- `id` (PK)
- `user_id` (FK → `users.id`)
- `exam_package_id` (FK → `exam_packages.id`) **NOT NULL for new sessions**
- `template_id` (FK → `practice_templates.id`)
- `status` (`active|paused|finished|invalidated`)
- `question_order` (JSONB array of question IDs; authoritative)
- `question_timings` (JSONB; per-question start/elapsed; authoritative)
- `current_index` (int)
- `time_limit_seconds` (nullable; copied from template at creation)
- `started_at`, `finished_at` (nullable)
- `last_activity_at`
- `invalidated_at` (nullable), `invalidated_reason` (nullable)
- `created_at`

Indexes/constraints:
- index(`user_id`, `status`)
- index(`created_at`)
- index(`last_activity_at`)
- (migration-stage) allow nullable `exam_package_id` only for legacy rows; enforce NOT NULL after cleanup.

### `practice_answers` (append-only)
- `id` (PK)
- `practice_session_id` (FK → `practice_sessions.id`, ON DELETE CASCADE)
- `question_id` (FK → `question_bank_questions.id`)
- `answer_payload` (JSONB; selected choice, text, etc.)
- `is_correct` (nullable until graded if needed)
- `explanation_snapshot` (JSONB or text; captured at answer time)
- `answered_at`
- `created_at`

Indexes/constraints:
- index(`practice_session_id`, `answered_at`)
- index(`question_id`)

### Exam (mock) sessions
#### `exam_sessions`
- `id` (PK)
- `user_id` (FK → `users.id`)
- `exam_package_id` (FK → `exam_packages.id`)
- `status` (`active|finished|invalidated`)
- `snapshot` (JSONB; minimal resume state; authoritative)
- `started_at`, `finished_at` (nullable)
- `last_heartbeat_at` (nullable)
- `created_at`

Indexes:
- index(`user_id`, `status`)
- index(`last_heartbeat_at`)

#### `exam_session_events` (append-only)
- `id` (PK)
- `exam_session_id` (FK → `exam_sessions.id`, ON DELETE CASCADE)
- `type` (text; e.g., `heartbeat`, `focus_lost`, `network_drop`)
- `payload` (JSONB)
- `created_at`

#### `exam_session_flags`
- `id` (PK)
- `exam_session_id` (FK → `exam_sessions.id`, ON DELETE CASCADE)
- `flag_type` (text), `reason` (text), `created_at`

### `audit_log` (immutable)
- `id` (PK)
- `actor_user_id` (nullable FK → `users.id`)
- `action` (text; e.g., `policy_decision`, `session_transition`)
- `resource_type`, `resource_id`
- `payload` (JSONB; include decision reason codes)
- `created_at`

Indexes:
- index(`resource_type`, `resource_id`)
- index(`created_at`)

8.5 Future DB Plan
- Introduce a document store (MongoDB) for flexible question schema and media-rich explanations; keep Postgres as source-of-truth for enrollments, sessions, and audit trails.

---

## 9. Session Lifecycle & State Machine

9.1 Session States
- `active`, `paused`, `finished`, `invalidated`.

9.2 Transition Rules
- Create: allowed only when enrollment/tier permits.
- Answer submission: allowed only when `active`.
- Pause: allowed only for untimed sessions.
- Forced-finish: server-enforced when time expires for timed sessions.
- Illegal transitions return 409 with a reason code.

9.3 Persistence & Heartbeat
- For exam sessions, client heartbeat persists snapshot to `exam_sessions.snapshot` and updates `last_heartbeat_at`.

---

## 10. Admin & Instructor Workflows

10.1 Instructor
- Manage templates, create and publish practice templates, view package analytics.

10.2 Admin
- Manage exam packages, user enrollments, and administrative session operations (invalidate/terminate).

10.3 Auditing
- Keep immutable `audit_log` records for policy decisions, session lifecycle events, and admin actions.

---

## 11. Security & Authentication

11.1 Auth Model
- Cookie-based short-lived JWT in HttpOnly cookie plus refresh tokens; CSRF protection for state-changing endpoints.

11.2 Authorization
- Role-based checks plus tier-based entitlement checks performed in the centralized policy layer.

11.3 Integrity
- Server-side timing, heartbeat signature verification (HMAC optional for integrity), and exam integrity events persisted for analysis.

11.4 Secrets & Key Management
- Use environment-based secret provisioning; rotate signing keys periodically and store in the secret manager used by the deployment environment.

---

## 12. Observability & Metrics

- Instrument key policy decisions and session lifecycle events.
- Expose metrics: sessions started/finished, enrollments created, policy denials, average time-per-question, heartbeats per minute.
- Centralized logs with structured JSON entries; optional export to Sentry/ELK.

---

## 13. Deployment, Dev & Local Environment

13.1 Local Dev
- Use `docker-compose` for local Postgres and Redis as current repo does. Backend runs via Go toolchain container; frontend via Vite.

13.2 Staging & Prod
- Container images built from repo; deployments managed by Kubernetes or managed container service.
  
---

## 14. Migration & Cleanup Plan

Purpose: remove legacy behaviors and converge implementation to this SDD with minimal user disruption.

14.1 Principles
- Preserve user data and session integrity.
- Migrate behavior incrementally behind feature flags.
- Keep audit logs to debug regressions.

14.2 Steps (high level)
1. Introduce centralized policy layer and implement `can_start_session` checks behind a feature flag.
2. Authorize create-session requests to always include `exam_package_id` (or infer only if single enrollment). Deprecate ambiguous create flows.
3. Convert published templates to immutable snapshots when published; rewrite creation flows so published templates cannot be altered in-place (publish/unpublish workflow retained).
4. Add DB constraints gradually: enforce FK for `practice_sessions.package_id` once all callers start providing package_id (migrations will fill missing values from session audit).
5. Migrate question-rich media and flexible schema to MongoDB if needed; keep references in Postgres.

14.3 Rollback & Monitoring
- Monitor policy denials and errors; roll back feature flags if unexplained regressions occur.

---

## 15. Testing Strategy

- Unit tests for policy engine and state machine logic.
- Integration tests for key API flows (session create, answer submission, pause/resume, review).
- End-to-end smoke tests for instructor workflows (template publish) and student flows (enroll → start session → submit → review).

---

## 16. Operational Runbook (Key Playbooks)

- How to invalidate a session: Admin API endpoint that marks `invalidated_at` and appends an `exam_session_flag`.
- How to repair enrollment mismatches: a db migration script to reconcile `practice_sessions.package_id` from session audit or answer history.
- How to rotate keys: documented sequence for key rollover with a dual-key acceptance window.

---

## 17. Future Extensions

- Service extraction: policy service, question service, analytics service.
- Document store for question content and AI-enhanced generation.
- Adaptive testing engine (CAT) as a separate service.

---

End of Document

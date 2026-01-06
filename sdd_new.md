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
- PostgreSQL is the source-of-truth for users, sessions, packages, tiers, enrollments, templates, question banks, and audit trails.
- Redis remains a volatile performance and rate-limit layer.

8.2 Source Schema
- The production canonical schema (implemented as ordered SQL migrations) includes the following primary tables and columns (types summarized):

### `users`
- `id` text PRIMARY KEY
- `email` text UNIQUE NOT NULL
- `password_hash` text NOT NULL
- `role` text NOT NULL DEFAULT 'student'
- `created_at` timestamp NOT NULL DEFAULT now()
- `updated_at` timestamp
- `deleted_at` timestamp

### `auth_sessions`
- `id` text PRIMARY KEY
- `user_id` text NOT NULL
- `role` text NOT NULL
- `audience` text NOT NULL
- `ip` text, `user_agent` text
- `created_at` timestamp NOT NULL DEFAULT now()
- `last_seen_at` timestamp, `expires_at` timestamp NOT NULL
- `revoked_at` timestamp, `revoked_reason` text

### `auth_refresh_tokens`
- `id` text PRIMARY KEY
- `session_id` text NOT NULL
- `token_hash` bytea NOT NULL
- `created_at` timestamp NOT NULL DEFAULT now(), `expires_at` timestamp NOT NULL
- `revoked_at` timestamp, `replaced_by_token_id` text

### Auth session groups & limits
- `auth_session_groups`, `auth_session_group_memberships`, `auth_session_limits_group`, `auth_session_limits_user`, `auth_session_limits_role` tables exist to support group-based limits and per-role/user caps.

### `exam_packages`
- `id` uuid PRIMARY KEY
- `code` text UNIQUE NOT NULL, `name` text UNIQUE NOT NULL, `subtitle` text, `overview` text
- `modules`, `highlights`, `module_sections` json
- `is_hidden` boolean NOT NULL DEFAULT false
- `created_at` timestamp NOT NULL DEFAULT now(), `updated_at` timestamp

### `exam_package_tiers`
- `id` uuid PRIMARY KEY
- `exam_package_id` uuid NOT NULL REFERENCES `exam_packages`(id)
- `code` text NOT NULL, `name` text NOT NULL, `sort_order` integer NOT NULL DEFAULT 0
- `is_default` boolean NOT NULL DEFAULT false, `is_active` boolean NOT NULL DEFAULT true
- `policy` json NOT NULL
- `max_practice_sessions_per_week` integer, `max_exam_sessions_per_week` integer
- `created_at` timestamp NOT NULL DEFAULT now(), `updated_at` timestamp

### `user_exam_package_enrollments` and events
- `user_exam_package_enrollments` uses composite PK (`user_id`, `exam_package_id`) and stores `tier_id`, timestamps and `updated_at`.
- `user_exam_package_enrollment_events` records changes with `from_tier_id`, `to_tier_id`, `changed_by_user_id` and metadata.

### `practice_templates`
- `id` uuid PRIMARY KEY
- `exam_package_id` uuid NOT NULL REFERENCES `exam_packages`(id)
- `name` text NOT NULL, `section` text NOT NULL
- optional `topic_id` (references `question_topics.id`) and `difficulty_id` (references `question_bank_difficulties.id`)
- `is_timed` boolean NOT NULL, `target_count` integer NOT NULL, `sort_order` integer
- `is_published` boolean NOT NULL DEFAULT false
- `created_by_user_id`, `updated_by_user_id` (user refs), `created_at`, `updated_at`

### `practice_sessions`
- `id` text PRIMARY KEY
- `user_id` text NOT NULL REFERENCES `users`(id)
- `package_id` uuid (nullable for legacy) REFERENCES `exam_packages`(id)
- `tier_id` uuid REFERENCES `exam_package_tiers`(id)
- `template_id` uuid REFERENCES `practice_templates`(id)
- `is_timed` boolean NOT NULL, `started_at` timestamp NOT NULL
- `time_limit_seconds` integer, `target_count` integer NOT NULL
- `current_index` integer NOT NULL DEFAULT 0, `current_question_started_at` timestamp
- `paused_at` timestamp, `status` text NOT NULL
- `questions_snapshot` json NOT NULL, `question_timings` json
- `correct_count` integer NOT NULL DEFAULT 0, `created_at` timestamp NOT NULL DEFAULT now(), `last_activity_at` timestamp

### `practice_answers`
- `id` bigserial PRIMARY KEY
- `session_id` text NOT NULL REFERENCES `practice_sessions`(id)
- `user_id` text NOT NULL REFERENCES `users`(id)
- `question_id` text NOT NULL, `choice_id` text NOT NULL
- `correct` boolean NOT NULL, `explanation` text, `ts` timestamp NOT NULL DEFAULT now()

### `exam_sessions`, `exam_session_events`, `exam_session_flags`
- `exam_sessions` uses composite PK (`user_id`, `id`) and includes `status`, `exam_package_id`, `tier_id`, `snapshot` json, timestamps for heartbeat/submit/termination/invalidation.
- `exam_session_events` and `exam_session_flags` are append-only event/flag stores referencing the session composite key.

### Question bank tables
- `question_banks` (`id` text PK, `name`, `exam_package_id` uuid NOT NULL)
- `question_topics` (`id` text PK, `package_id` uuid NOT NULL, `name`, ...)
- `question_bank_difficulties` (`id` text PK, `display_name`, `sort_order`)
- `question_bank_questions` (`id` text PK, `question_bank_id` text NOT NULL, `topic_id`, `difficulty_id`, `prompt`, `explanation_text`, `status`, created/updated timestamps)
- `question_bank_choices` (`id` text PK, `question_id` text NOT NULL, `order_index` integer NOT NULL, `text`)
- `question_bank_correct_choice` (`question_id` text PK, `choice_id` text NOT NULL)

### `audit_log`
- `id` bigserial PRIMARY KEY
- `actor_user_id` text, `actor_role` text, `action` text NOT NULL
- `target_type`, `target_id`, `metadata` json, `created_at` timestamp NOT NULL DEFAULT now()

8.3 Indexes, Uniques and FK constraints
- Unique and composite indexes present in ACE.sql include: unique on `exam_package_tiers` (`exam_package_id`,`code`), unique package/name on `question_banks`, unique topic name per package, and various functional indexes on session and audit tables.
- Foreign keys are applied after base tables are created; the ACE.sql ordering places FK creation blocks to ensure referenced tables exist (migrations must preserve ordering).

8.4 Modeling Notes and Migration Guidance
- `practice_sessions.package_id` is allowed nullable for legacy data (ACE.sql uses `package_id`); migrations should populate and then enforce NOT NULL during cleanup.
- Status columns are stored as `text` with check/comment metadata in ACE.sql; domain code should validate and map allowed state strings (`practice_sessions.status` and `exam_sessions.status`).
- Use `json`/`jsonb` columns for flexible payloads such as `modules`, `questions_snapshot`, `snapshot`, and `policy`.
- Seed data (difficulties, topics, example packages) is present in migration seeds and tests should assert expected seeded counts.

8.5 Future DB Plan
- Keep Postgres as the authoritative store for enrollments, sessions, audit logs and entitlements. Consider document store for media-rich question content later; maintain migration-driven evolution with ordered SQL files and a migration table.

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

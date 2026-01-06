This file lists code and schema elements that appear unused, legacy, partially implemented, or support features not present in the main workflows. Each item includes the file/module, inferred intent, evidence of non-use or partiality, and a risk assessment for removal.

1) Legacy auth aliases (`/auth/*`) and related handlers
- File/module: `apps/backend/internal/handlers/auth.go` (legacy alias section)
- Original intent: Backwards-compatibility for older clients that addressed auth under `/auth/*` rather than portal-scoped `/student/auth`, `/instructor/auth`, `/admin/auth`.
- Evidence of non-use / legacy:
  - Code contains an explicit "Legacy aliases" comment and registers legacy routes as aliases to student portal handlers.
  - `sdd.md` and docs note these aliases are deprecated.
- Risk level of removal: Medium → High. Removing will break older clients or integrations relying on the legacy path; safe only after verifying no consumers or after providing redirects.

2) Migration-only DB fields and legacy package-id handling
- File/module: `apps/backend/internal/db/db.go` (many backfill/normalize SQL blocks)
- Original intent: Support older development/production databases that used textual package IDs (e.g. 'gre', 'sat') and to backfill/normalize to UUIDs and mapping tables.
- Evidence of non-use / legacy:
  - Numerous comments in `db.go` describing "legacy", backfill, and normalization of `exam_packages.id` and `question_banks.exam_package_id`.
  - `docs/03_database_model.md` explicitly states `question_banks.exam_package_id` is retained for migration safety and application logic prefers `exam_package_question_bank_packages` mapping table.
- Risk level of removal: High. Dropping/migrating these fields before confirming backfill completion or removing clients that depend on the legacy column may break migrations and historical data access.

3) Frontend catalog scaffold (`apps/web/src/packages/catalog.ts`)
- File/module: `apps/web/src/packages/catalog.ts`
- Original intent: Local/static exam package catalog used for UI scaffolding and demos (sample package metadata for front-end prototypes).
- Evidence of non-use / legacy:
  - No imports/reference found in the codebase (search for `getExamPackageById` / `EXAM_PACKAGES` returned only that file and docs).
  - Production data for exam packages is served from the backend (`/exam-packages` endpoint), and DB-backed packages are used elsewhere.
- Risk level of removal: Low. Safe to remove if you do not rely on the file for local dev; consider keeping or moving to a `examples/` folder if still useful for demos.

4) Frontend token helpers partially retained (`apps/web/src/auth/token.ts`)
- File/module: `apps/web/src/auth/token.ts`
- Original intent: Client-side storage and management of access tokens for multiple portals (student/instructor/admin); legacy migration helper for older storage keys.
- Evidence of non-use / partial implementation:
  - File now primarily stores a small "active portal" hint in `localStorage` and removes legacy/stored tokens on normalization.
  - `getActiveAccessToken()` returns `null` (no actual active token returned), and most token functions are noop/persistence-cleanup (cookie-based auth is used instead).
  - Search shows `getActiveAccessToken` is not referenced elsewhere.
- Risk level of removal: Low → Medium. Removing or simplifying is safe if you preserve the portal hint behavior (used for navigation). If any edge-case code expects a token value, removal could break it — but current codebase indicates server-auth uses cookies and accessToken values are not required by runtime paths.

5) Stubbed exam modules (front-end)
- File/module: UX text in `apps/web/src/pages/ExamSimulationPage.tsx` and related placeholders
- Original intent: Multi-modal IELTS/TOEFL speaking/listening UI scaffolds for future audio/video components and LLM feedback panels.
- Evidence of partial/absent implementation:
  - `ExamSimulationPage.tsx` contains copy: "Listening/audio and speaking/recording UI are stubbed as modules." and other placeholder scaffolding.
  - No obvious implementations of audio-recording upload/processing, or integrated LLM feedback pipeline in the front-end codebase (only placeholders/hook points exist).
- Risk level of removal: Low. These are UI scaffolds — removing them only affects planned features. If you intend to implement the multi-modal modules later, keep scaffolding; otherwise remove to reduce noise.

6) API/OpenAPI spec used for codegen (`packages/shared-proto/openapi.yaml`)
- File/module: `packages/shared-proto/openapi.yaml`
- Original intent: Machine-readable API contract and potential codegen source for typed clients (`apps/web/src/api/__generated__/schema` appears generated from schema).
- Evidence of redundancy/legacy:
  - The repo already contains generated TypeScript under `apps/web/src/api/__generated__/schema` and typed `endpoints.ts`. The `openapi.yaml` may be a source of truth but isn't actively imported at runtime.
- Risk level of removal: Low. Keep if you rely on it for codegen or documentation; safe to archive otherwise.

7) Small unused helpers / dead exports discovered during scan
- Examples:
  - `apps/web/src/auth/token.ts` (`getActiveAccessToken`) — not referenced (see item 4).
  - Any static `apps/web/src/dist` artifacts (build output) — should be ignored/removed from source control if present.
- Evidence of non-use: Grep shows no references in the codebase.
- Risk level of removal: Low. Remove or consolidate these small helpers after verifying no external consumers.

Recommendations & next steps
- Conservative approach: treat DB migration-only fields and legacy server aliases as higher-risk — plan a migration window and confirm historical data/backfill completion before removing columns or routes.
- Low-risk cleanups: remove or relocate `apps/web/src/packages/catalog.ts`, delete unused build artifacts, and simplify `token.ts` by removing unused functions (while preserving portal-hint behavior).
- Medium-risk changes: remove `/auth/*` aliases only after checking telemetry/logs or communicating to integrators; provide redirects or a migration grace period.

If you want, I can:
- Produce a one-file patch that removes or archives low-risk candidates (e.g., move `catalog.ts` to `docs/examples/`),
- Generate a short migration plan for safely dropping the legacy DB fields and `/auth` aliases, or
- Produce a CSV mapping every occurrence of `@/api/endpoints` → handler → DB tables to help validate consumer usage before removal.

---
Generated from code inspection of `services/api-gateway/internal/*`, `apps/web/src/*`, and repository docs.

Title: restructure: monorepo layout — move backend to apps/backend, frontend to apps/web, centralize API specs

Summary:
- Move the Go backend into `apps/backend` and reorganize internals to follow Go-first layout.
- Move SQL migrations and ACE.sql into `infrastructure/database/migrations` as the canonical DB migration store.
- Centralize OpenAPI spec into `packages/api-specs/openapi.yaml` and add CI steps to generate SDKs into `packages/sdks`.
- Add pnpm workspace (`package.json`, `pnpm-workspace.yaml`), Makefiles, Dockerfiles, CODEOWNERS, CI workflows, and boundary checks.

Moved files (representative mapping):
- services/api-gateway/ -> apps/backend/
  - services/api-gateway/cmd/api-gateway/main.go -> apps/backend/cmd/api/main.go
  - services/api-gateway/cmd/migrate/main.go -> apps/backend/cmd/migrate/main.go
  - services/api-gateway/internal/* -> apps/backend/internal/*
  - services/api-gateway/migrations/* -> infrastructure/database/migrations/migrations/*
  - ACE.sql -> infrastructure/database/migrations/ACE.sql
- packages/shared-proto/openapi.yaml -> packages/api-specs/openapi.yaml
- apps/web/ (unchanged path, script updated to reference packages/api-specs)
- Added: packages/sdks/, packages/ui-components/, .github/CODEOWNERS, .github/workflows/ci.yml, scripts/verify-boundaries.sh

Commands used (for reviewer verification):
- git checkout -b restructure/monorepo-layout
- git mv services/api-gateway apps/backend
- git mv services/api-gateway/migrations infrastructure/database/migrations
- git mv packages/shared-proto/openapi.yaml packages/api-specs/openapi.yaml
- Updated Go module path in `apps/backend/go.mod` to `module github.com/ace-platform/apps/backend` and updated imports
- Added Makefile and Dockerfile at `apps/backend` and `apps/web`
- Added pnpm workspace at repo root and updated `apps/web/package.json` to point at centralized OpenAPI
- Added CI workflow which generates TypeScript and Go SDKs from `packages/api-specs/openapi.yaml` and runs tests/lints

Checklist (performed):
- [x] Files moved via `git mv` so history is preserved
- [x] Go module path updated and imports rewritten
- [x] Added Makefile and Dockerfiles for apps/backend and apps/web
- [x] Centralized OpenAPI spec and added CI client generation job
- [x] Added pnpm workspace and updated web build scripts
- [x] Added import boundary check script and wired to CI
- [x] Updated docs, README, and contributor guide
- [ ] Backend unit tests passing (CI run required)
- [ ] Frontend build & tests passing (CI run required)
- [ ] Integration / e2e tests passing (CI run required)

Rollout & rollback plan:
- This is a filesystem-only reorganization; merge when CI is green and reviewers have approved.
- To rollback: revert/close PR or run `git revert -m 1 <merge-commit>` to restore previous paths; branch `restructure/monorepo-layout` can be force-reset if needed.
- If runtime DB migrations are needed, deploy them in a controlled window behind feature flags, and have a rollback script to re-apply old schema if necessary.

Post-merge tasks:
- Run CI to generate SDKs and optionally commit them or publish them as artifacts.
- Monitor production metrics and policy-denial counts after merging and rollout.
- After a grace period, remove legacy compatibility shims and paths.

Notes for reviewers:
- I could not run `go test` locally because `go` is not available in this environment. CI runs on GitHub Actions (go 1.24 / node 20) and will run the full matrix.
- If you prefer a different module path (e.g., `github.com/ace-platform/backend` vs `github.com/ace-platform/apps/backend`) I can update all references accordingly.

Please review:
- Permissions and CODEOWNERS for `apps/backend/internal` and `packages/api-specs`.
- CI workflow definitions (caching, matrix and job dependencies).
- The migration of SQL files into `infrastructure/database/migrations` and the updated migrate CLI invocation in `apps/backend/Makefile`.

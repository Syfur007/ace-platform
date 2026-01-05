# API Gateway database migrations

This service uses **file-based, ordered SQL migrations** (no embedding) under this directory.

## Conventions

- File naming: `NNNNNN_description.up.sql` / `NNNNNN_description.down.sql`
  - `NNNNNN` is a **6-digit** numeric prefix. Higher numbers run later.
  - Keep names descriptive (tables or feature area).
- SQL style:
  - Prefer `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` so dev databases are tolerant of reruns.
  - Prefer explicit, stable FK constraint names (so they can be dropped in down migrations).
- Types/defaults:
  - Schema source of truth: `ACE.sql` at repo root.
  - UUID PKs use `DEFAULT gen_random_uuid()` and migrations enable `pgcrypto`.
  - Use `json` (not `jsonb`) where the schema specifies `json`.

## Adding a migration

1. Pick the next number (e.g. `000010_...`).
2. Add both files:
   - `000010_your_change.up.sql`
   - `000010_your_change.down.sql`
3. Keep `down.sql` only when a **safe** reversal exists.
   - If the migration is destructive/irreversible, leave the down file intentionally empty and **state why** at the top.

## Irreversible migrations

The current initial migration set is reversible in the sense that tables can be dropped. However:
- `000009_seeds.down.sql` is **best-effort** and may fail if seeded rows are referenced.

## Running migrations locally

From the repo root:

```sh
cd services/api-gateway

go run ./cmd/migrate --database "$DATABASE_URL" --path ./migrations up
```

Useful commands:

- Status: `go run ./cmd/migrate status`
- Step forward: `go run ./cmd/migrate --steps 1 up`
- Step back: `go run ./cmd/migrate --steps 1 down`
- Force version (dangerous): `go run ./cmd/migrate --force 9` (marks schema_migrations without running SQL)

## Notes

- The api-gateway service **does not run migrations on startup**. Migrations must be applied explicitly via the migrate CLI (or in CI/CD).
- The service *does* automatically bootstrap admin/instructor users on startup if `BOOTSTRAP_*` env vars are set.

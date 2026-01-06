# API Gateway

## Database

This service uses **versioned, file-based SQL migrations** stored at `infrastructure/database/migrations`.

- Migrations are **not** run automatically on service startup.
- Apply migrations explicitly via the migrate CLI (local dev / CI/CD) or via the repository-level Makefile.

### Run migrations locally (from repository root)

```sh
go run ./apps/backend/cmd/migrate --database "$DATABASE_URL" --path ./infrastructure/database/migrations up
```

### Automatic bootstrap users (startup)

On startup, the service will automatically create users if these environment variables are set:

- `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`
- `BOOTSTRAP_INSTRUCTOR_EMAIL`, `BOOTSTRAP_INSTRUCTOR_PASSWORD`

Behavior:
- If the email does not exist, it is inserted with the specified role.
- If the email exists with a different role, startup fails.

### CI/CD guidance (run before deploy)

In staging/production, run migrations **before** deploying a new api-gateway revision:

```sh
cd services/api-gateway

go run ./cmd/migrate --database "$DATABASE_URL" --path ./migrations up
```

Safety checklist:
- Take a DB backup/snapshot first.
- Test migrations on a staging copy of production.
- Ensure `status` is clean (`dirty=false`) after running.
- Deploy only after migrations succeed.

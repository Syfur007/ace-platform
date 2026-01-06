Auth package

Environment variables (required / optional):

- JWT_SECRET (required in production): HMAC secret used to sign tokens. The service fails fast on startup if this is empty unless one of the following is set:
  - DEV_MODE=true
  - ALLOW_DEV_JWT_SECRET=true
  Rationale: avoid shipping a default insecure secret in production.

- JWT_ISSUER (required for issuer validation if set): value used as the `iss` claim when issuing tokens. If set, incoming tokens are validated to have this issuer.

- JWT_AUDIENCE (optional): when set, incoming tokens must include this audience. Issued tokens include the audience passed to `IssueAccessToken`.

- AUTH_DB_TIMEOUT_MS (optional, default 2000): timeout in milliseconds for DB session checks.

- AUTH_STRICT_SESSION_CHECK (optional, default true): when true, the middleware rejects requests if the auth DB session check fails. When false, the middleware logs a warning and falls back to JWT-only validation.

- BCRYPT_COST (optional): bcrypt cost for password hashing. If not set, `bcrypt.DefaultCost` is used. Invalid values cause `HashPassword` to return an error.

Notes for local testing

- To run unit tests locally:

  Set a JWT secret and issuer before running tests:

  ```powershell
  $env:JWT_SECRET = "test-secret"
  $env:JWT_ISSUER = "test-issuer"
  go test ./services/api-gateway/internal/auth -v
  ```

- To run the service locally and avoid failing on missing JWT secret, set `DEV_MODE=true` or `ALLOW_DEV_JWT_SECRET=true`.

Security rationale: the package intentionally requires an explicit JWT secret in non-dev environments and validates issuer/audience when configured to reduce risk from malformed or replayed tokens. Token verification uses strict signing method checks and opaque token verification uses constant-time comparisons.

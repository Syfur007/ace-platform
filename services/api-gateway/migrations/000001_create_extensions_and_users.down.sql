-- 000001_create_extensions_and_users.down.sql
-- Purpose: Drop core user table (will cascade only if later migrations are rolled back first).
-- Risk: fast.
-- Reversible: yes.

DROP INDEX IF EXISTS idx_users_role;
DROP INDEX IF EXISTS idx_users_email;
DROP TABLE IF EXISTS users;
-- Note: we intentionally do not drop pgcrypto; other schemas may rely on it.

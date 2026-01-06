-- 000001_create_extensions_and_users.up.sql
-- Purpose: Enable required extensions and create core user table.
-- Risk: fast.
-- Reversible: yes (see down).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'student',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp,
  deleted_at timestamp
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

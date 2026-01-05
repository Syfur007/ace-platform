-- 000004_auth.up.sql
-- Purpose: Create auth session tracking and session limit tables.
-- Risk: fast.
-- Reversible: yes.

CREATE TABLE IF NOT EXISTS auth_sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  role text NOT NULL,
  audience text NOT NULL,
  ip text,
  user_agent text,
  created_at timestamp NOT NULL DEFAULT now(),
  last_seen_at timestamp,
  expires_at timestamp NOT NULL,
  revoked_at timestamp,
  revoked_reason text
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_auth_sessions_user_id') THEN
    ALTER TABLE auth_sessions
      ADD CONSTRAINT fk_auth_sessions_user_id
      FOREIGN KEY (user_id) REFERENCES users(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
  id text PRIMARY KEY,
  session_id text NOT NULL,
  token_hash bytea NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  expires_at timestamp NOT NULL,
  revoked_at timestamp,
  replaced_by_token_id text
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_auth_refresh_tokens_session_id') THEN
    ALTER TABLE auth_refresh_tokens
      ADD CONSTRAINT fk_auth_refresh_tokens_session_id
      FOREIGN KEY (session_id) REFERENCES auth_sessions(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_auth_refresh_tokens_replaced_by_token_id') THEN
    ALTER TABLE auth_refresh_tokens
      ADD CONSTRAINT fk_auth_refresh_tokens_replaced_by_token_id
      FOREIGN KEY (replaced_by_token_id) REFERENCES auth_refresh_tokens(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS auth_session_groups (
  id text PRIMARY KEY,
  name text UNIQUE NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_session_group_memberships (
  group_id text NOT NULL,
  user_id text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_auth_session_group_memberships_group_id') THEN
    ALTER TABLE auth_session_group_memberships
      ADD CONSTRAINT fk_auth_session_group_memberships_group_id
      FOREIGN KEY (group_id) REFERENCES auth_session_groups(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_auth_session_group_memberships_user_id') THEN
    ALTER TABLE auth_session_group_memberships
      ADD CONSTRAINT fk_auth_session_group_memberships_user_id
      FOREIGN KEY (user_id) REFERENCES users(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS auth_session_limits_group (
  group_id text PRIMARY KEY,
  max_active_sessions integer
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_auth_session_limits_group_group_id') THEN
    ALTER TABLE auth_session_limits_group
      ADD CONSTRAINT fk_auth_session_limits_group_group_id
      FOREIGN KEY (group_id) REFERENCES auth_session_groups(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS auth_session_limits_user (
  user_id text PRIMARY KEY,
  max_active_sessions integer
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_auth_session_limits_user_user_id') THEN
    ALTER TABLE auth_session_limits_user
      ADD CONSTRAINT fk_auth_session_limits_user_user_id
      FOREIGN KEY (user_id) REFERENCES users(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS auth_session_limits_role (
  role text PRIMARY KEY,
  max_active_sessions integer
);

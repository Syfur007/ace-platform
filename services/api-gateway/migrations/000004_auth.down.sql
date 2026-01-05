-- 000004_auth.down.sql
-- Purpose: Drop auth tables.
-- Risk: fast.
-- Reversible: yes.

DROP TABLE IF EXISTS auth_session_limits_role;

ALTER TABLE auth_session_limits_user DROP CONSTRAINT IF EXISTS fk_auth_session_limits_user_user_id;
DROP TABLE IF EXISTS auth_session_limits_user;

ALTER TABLE auth_session_limits_group DROP CONSTRAINT IF EXISTS fk_auth_session_limits_group_group_id;
DROP TABLE IF EXISTS auth_session_limits_group;

ALTER TABLE auth_session_group_memberships DROP CONSTRAINT IF EXISTS fk_auth_session_group_memberships_user_id;
ALTER TABLE auth_session_group_memberships DROP CONSTRAINT IF EXISTS fk_auth_session_group_memberships_group_id;
DROP TABLE IF EXISTS auth_session_group_memberships;

DROP TABLE IF EXISTS auth_session_groups;

ALTER TABLE auth_refresh_tokens DROP CONSTRAINT IF EXISTS fk_auth_refresh_tokens_replaced_by_token_id;
ALTER TABLE auth_refresh_tokens DROP CONSTRAINT IF EXISTS fk_auth_refresh_tokens_session_id;
DROP TABLE IF EXISTS auth_refresh_tokens;

ALTER TABLE auth_sessions DROP CONSTRAINT IF EXISTS fk_auth_sessions_user_id;
DROP TABLE IF EXISTS auth_sessions;

-- 000008_audit_log.down.sql
-- Purpose: Drop audit log table.
-- Risk: fast.
-- Reversible: yes (destructive).

DROP INDEX IF EXISTS idx_audit_log_created_at;
DROP INDEX IF EXISTS idx_audit_log_actor_user_id;

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS fk_audit_log_actor_user_id;
DROP TABLE IF EXISTS audit_log;

-- 000008_audit_log.up.sql
-- Purpose: Create audit log table.
-- Risk: medium (can grow large; indexes help).
-- Reversible: yes (drops table; destructive).

CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY,
  actor_user_id text,
  actor_role text,
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata json,
  created_at timestamp NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_audit_log_actor_user_id') THEN
    ALTER TABLE audit_log
      ADD CONSTRAINT fk_audit_log_actor_user_id
      FOREIGN KEY (actor_user_id) REFERENCES users(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_log_actor_user_id ON audit_log (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at);

-- 000006_exam_sessions.up.sql
-- Purpose: Create exam sessions, events, and flags.
-- Risk: medium (events/flags can grow).
-- Reversible: yes (drops tables; destructive).

CREATE TABLE IF NOT EXISTS exam_sessions (
  user_id text NOT NULL,
  id text NOT NULL,
  status text NOT NULL,
  exam_package_id uuid,
  tier_id uuid,
  snapshot json NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp,
  last_heartbeat_at timestamp,
  submitted_at timestamp,
  terminated_at timestamp,
  terminated_by_user_id text,
  termination_reason text,
  invalidated_at timestamp,
  invalidated_by_user_id text,
  invalidation_reason text,
  PRIMARY KEY (user_id, id)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_exam_sessions_user_id') THEN
    ALTER TABLE exam_sessions
      ADD CONSTRAINT fk_exam_sessions_user_id
      FOREIGN KEY (user_id) REFERENCES users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_exam_sessions_exam_package_id') THEN
    ALTER TABLE exam_sessions
      ADD CONSTRAINT fk_exam_sessions_exam_package_id
      FOREIGN KEY (exam_package_id) REFERENCES exam_packages(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_exam_sessions_tier_id') THEN
    ALTER TABLE exam_sessions
      ADD CONSTRAINT fk_exam_sessions_tier_id
      FOREIGN KEY (tier_id) REFERENCES exam_package_tiers(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_exam_sessions_terminated_by_user_id') THEN
    ALTER TABLE exam_sessions
      ADD CONSTRAINT fk_exam_sessions_terminated_by_user_id
      FOREIGN KEY (terminated_by_user_id) REFERENCES users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_exam_sessions_invalidated_by_user_id') THEN
    ALTER TABLE exam_sessions
      ADD CONSTRAINT fk_exam_sessions_invalidated_by_user_id
      FOREIGN KEY (invalidated_by_user_id) REFERENCES users(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_exam_sessions_user_id_status ON exam_sessions (user_id, status);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_exam_package_id_created_at ON exam_sessions (exam_package_id, created_at);

CREATE TABLE IF NOT EXISTS exam_session_events (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL,
  session_id text NOT NULL,
  event_type text NOT NULL,
  payload json,
  created_at timestamp NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_exam_session_events_user_session') THEN
    ALTER TABLE exam_session_events
      ADD CONSTRAINT fk_exam_session_events_user_session
      FOREIGN KEY (user_id, session_id) REFERENCES exam_sessions(user_id, id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS exam_session_flags (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL,
  session_id text NOT NULL,
  flag_type text NOT NULL,
  note text,
  created_by_user_id text,
  created_at timestamp NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_exam_session_flags_user_session') THEN
    ALTER TABLE exam_session_flags
      ADD CONSTRAINT fk_exam_session_flags_user_session
      FOREIGN KEY (user_id, session_id) REFERENCES exam_sessions(user_id, id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_exam_session_flags_created_by_user_id') THEN
    ALTER TABLE exam_session_flags
      ADD CONSTRAINT fk_exam_session_flags_created_by_user_id
      FOREIGN KEY (created_by_user_id) REFERENCES users(id);
  END IF;
END $$;

COMMENT ON COLUMN exam_sessions.status IS 'check (status in (''active'',''submitted'',''terminated'',''invalidated''))';

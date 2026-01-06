-- 000005_practice.up.sql
-- Purpose: Create practice templates, sessions, and answers.
-- Risk: medium (sessions/answers can grow).
-- Reversible: yes (drops tables; destructive).

CREATE TABLE IF NOT EXISTS practice_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_package_id uuid NOT NULL,
  name text NOT NULL,
  section text NOT NULL,
  topic_id text,
  difficulty_id text,
  is_timed boolean NOT NULL,
  target_count integer NOT NULL,
  sort_order integer,
  is_published boolean NOT NULL DEFAULT false,
  created_by_user_id text,
  updated_by_user_id text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_practice_templates_exam_package_id') THEN
    ALTER TABLE practice_templates
      ADD CONSTRAINT fk_practice_templates_exam_package_id
      FOREIGN KEY (exam_package_id) REFERENCES exam_packages(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_practice_templates_updated_by_user_id') THEN
    ALTER TABLE practice_templates
      ADD CONSTRAINT fk_practice_templates_updated_by_user_id
      FOREIGN KEY (updated_by_user_id) REFERENCES users(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS practice_sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  package_id uuid,
  tier_id uuid,
  template_id uuid,
  is_timed boolean NOT NULL,
  started_at timestamp NOT NULL,
  time_limit_seconds integer,
  target_count integer NOT NULL,
  current_index integer NOT NULL DEFAULT 0,
  current_question_started_at timestamp,
  paused_at timestamp,
  status text NOT NULL,
  questions_snapshot json NOT NULL,
  question_timings json,
  correct_count integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  last_activity_at timestamp
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_practice_sessions_user_id') THEN
    ALTER TABLE practice_sessions
      ADD CONSTRAINT fk_practice_sessions_user_id
      FOREIGN KEY (user_id) REFERENCES users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_practice_sessions_package_id') THEN
    ALTER TABLE practice_sessions
      ADD CONSTRAINT fk_practice_sessions_package_id
      FOREIGN KEY (package_id) REFERENCES exam_packages(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_practice_sessions_tier_id') THEN
    ALTER TABLE practice_sessions
      ADD CONSTRAINT fk_practice_sessions_tier_id
      FOREIGN KEY (tier_id) REFERENCES exam_package_tiers(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_practice_sessions_template_id') THEN
    ALTER TABLE practice_sessions
      ADD CONSTRAINT fk_practice_sessions_template_id
      FOREIGN KEY (template_id) REFERENCES practice_templates(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_practice_sessions_user_id ON practice_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_user_id_status ON practice_sessions (user_id, status);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_user_id_package_id_created_at ON practice_sessions (user_id, package_id, created_at);

CREATE TABLE IF NOT EXISTS practice_answers (
  id bigserial PRIMARY KEY,
  session_id text NOT NULL,
  user_id text NOT NULL,
  question_id text NOT NULL,
  choice_id text NOT NULL,
  correct boolean NOT NULL,
  explanation text,
  ts timestamp NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_practice_answers_session_id') THEN
    ALTER TABLE practice_answers
      ADD CONSTRAINT fk_practice_answers_session_id
      FOREIGN KEY (session_id) REFERENCES practice_sessions(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_practice_answers_user_id') THEN
    ALTER TABLE practice_answers
      ADD CONSTRAINT fk_practice_answers_user_id
      FOREIGN KEY (user_id) REFERENCES users(id);
  END IF;

END $$;

CREATE INDEX IF NOT EXISTS idx_practice_answers_session_id ON practice_answers (session_id);
CREATE INDEX IF NOT EXISTS idx_practice_answers_user_id_ts ON practice_answers (user_id, ts);

COMMENT ON COLUMN practice_sessions.status IS 'check (status in (''active'',''paused'',''completed'',''terminated''))';

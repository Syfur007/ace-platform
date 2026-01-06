-- 000003_enrollments_and_events.up.sql
-- Purpose: Create enrollments and enrollment event history.
-- Risk: fast.
-- Reversible: yes.

CREATE TABLE IF NOT EXISTS user_exam_package_enrollments (
  user_id text NOT NULL,
  exam_package_id uuid NOT NULL,
  tier_id uuid,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp,
  PRIMARY KEY (user_id, exam_package_id)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_user_exam_package_enrollments_user_id') THEN
    ALTER TABLE user_exam_package_enrollments
      ADD CONSTRAINT fk_user_exam_package_enrollments_user_id
      FOREIGN KEY (user_id) REFERENCES users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_user_exam_package_enrollments_exam_package_id') THEN
    ALTER TABLE user_exam_package_enrollments
      ADD CONSTRAINT fk_user_exam_package_enrollments_exam_package_id
      FOREIGN KEY (exam_package_id) REFERENCES exam_packages(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_user_exam_package_enrollments_tier_id') THEN
    ALTER TABLE user_exam_package_enrollments
      ADD CONSTRAINT fk_user_exam_package_enrollments_tier_id
      FOREIGN KEY (tier_id) REFERENCES exam_package_tiers(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_exam_package_enrollments_user_id
  ON user_exam_package_enrollments (user_id);

CREATE TABLE IF NOT EXISTS user_exam_package_enrollment_events (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL,
  exam_package_id uuid NOT NULL,
  from_tier_id uuid,
  to_tier_id uuid NOT NULL,
  changed_at timestamp NOT NULL DEFAULT now(),
  changed_by_user_id text,
  reason text,
  metadata json
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_enrollment_events_user_id') THEN
    ALTER TABLE user_exam_package_enrollment_events
      ADD CONSTRAINT fk_enrollment_events_user_id
      FOREIGN KEY (user_id) REFERENCES users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_enrollment_events_exam_package_id') THEN
    ALTER TABLE user_exam_package_enrollment_events
      ADD CONSTRAINT fk_enrollment_events_exam_package_id
      FOREIGN KEY (exam_package_id) REFERENCES exam_packages(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_enrollment_events_from_tier_id') THEN
    ALTER TABLE user_exam_package_enrollment_events
      ADD CONSTRAINT fk_enrollment_events_from_tier_id
      FOREIGN KEY (from_tier_id) REFERENCES exam_package_tiers(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_enrollment_events_to_tier_id') THEN
    ALTER TABLE user_exam_package_enrollment_events
      ADD CONSTRAINT fk_enrollment_events_to_tier_id
      FOREIGN KEY (to_tier_id) REFERENCES exam_package_tiers(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_enrollment_events_changed_by_user_id') THEN
    ALTER TABLE user_exam_package_enrollment_events
      ADD CONSTRAINT fk_enrollment_events_changed_by_user_id
      FOREIGN KEY (changed_by_user_id) REFERENCES users(id);
  END IF;
END $$;

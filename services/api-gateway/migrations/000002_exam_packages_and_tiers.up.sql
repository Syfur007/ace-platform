-- 000002_exam_packages_and_tiers.up.sql
-- Purpose: Create exam_packages and exam_package_tiers.
-- Risk: fast.
-- Reversible: yes.

CREATE TABLE IF NOT EXISTS exam_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text UNIQUE NOT NULL,
  subtitle text,
  overview text,
  modules json,
  highlights json,
  module_sections json,
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp
);

CREATE TABLE IF NOT EXISTS exam_package_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_package_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  policy json NOT NULL,
  max_practice_sessions_per_week integer,
  max_exam_sessions_per_week integer,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_exam_package_tiers_exam_package_id'
  ) THEN
    ALTER TABLE exam_package_tiers
      ADD CONSTRAINT fk_exam_package_tiers_exam_package_id
      FOREIGN KEY (exam_package_id) REFERENCES exam_packages(id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_exam_package_tiers_exam_package_id_code
  ON exam_package_tiers (exam_package_id, code);

CREATE INDEX IF NOT EXISTS idx_exam_package_tiers_exam_package_id_is_active
  ON exam_package_tiers (exam_package_id, is_active);

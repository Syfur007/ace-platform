-- 000003_enrollments_and_events.down.sql
-- Purpose: Drop enrollments and enrollment events.
-- Risk: fast.
-- Reversible: yes.

ALTER TABLE user_exam_package_enrollment_events DROP CONSTRAINT IF EXISTS fk_enrollment_events_changed_by_user_id;
ALTER TABLE user_exam_package_enrollment_events DROP CONSTRAINT IF EXISTS fk_enrollment_events_to_tier_id;
ALTER TABLE user_exam_package_enrollment_events DROP CONSTRAINT IF EXISTS fk_enrollment_events_from_tier_id;
ALTER TABLE user_exam_package_enrollment_events DROP CONSTRAINT IF EXISTS fk_enrollment_events_exam_package_id;
ALTER TABLE user_exam_package_enrollment_events DROP CONSTRAINT IF EXISTS fk_enrollment_events_user_id;

DROP TABLE IF EXISTS user_exam_package_enrollment_events;

DROP INDEX IF EXISTS idx_user_exam_package_enrollments_user_id;

ALTER TABLE user_exam_package_enrollments DROP CONSTRAINT IF EXISTS fk_user_exam_package_enrollments_tier_id;
ALTER TABLE user_exam_package_enrollments DROP CONSTRAINT IF EXISTS fk_user_exam_package_enrollments_exam_package_id;
ALTER TABLE user_exam_package_enrollments DROP CONSTRAINT IF EXISTS fk_user_exam_package_enrollments_user_id;

DROP TABLE IF EXISTS user_exam_package_enrollments;

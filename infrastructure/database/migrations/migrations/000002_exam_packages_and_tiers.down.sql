-- 000002_exam_packages_and_tiers.down.sql
-- Purpose: Drop exam_packages and exam_package_tiers.
-- Risk: fast.
-- Reversible: yes.

DROP INDEX IF EXISTS idx_exam_package_tiers_exam_package_id_is_active;
DROP INDEX IF EXISTS idx_exam_package_tiers_exam_package_id_code;

ALTER TABLE exam_package_tiers DROP CONSTRAINT IF EXISTS fk_exam_package_tiers_exam_package_id;

DROP TABLE IF EXISTS exam_package_tiers;
DROP TABLE IF EXISTS exam_packages;

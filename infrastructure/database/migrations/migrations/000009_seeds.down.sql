-- 000009_seeds.down.sql
-- Purpose: Attempt to remove seeded reference data.
-- Risk: fast.
-- Reversible: partial.
-- Notes: This may fail if data is referenced by other tables.

DELETE FROM exam_package_tiers WHERE code='default' AND name='Default';
DELETE FROM exam_packages WHERE code IN ('gre','ielts','sat');
DELETE FROM question_bank_difficulties WHERE id IN ('easy','medium','hard');

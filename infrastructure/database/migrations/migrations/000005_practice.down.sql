-- 000005_practice.down.sql
-- Purpose: Drop practice tables.
-- Risk: fast.
-- Reversible: yes (destructive).

DROP INDEX IF EXISTS idx_practice_answers_user_id_ts;
DROP INDEX IF EXISTS idx_practice_answers_session_id;

ALTER TABLE practice_answers DROP CONSTRAINT IF EXISTS fk_practice_answers_choice_id;
ALTER TABLE practice_answers DROP CONSTRAINT IF EXISTS fk_practice_answers_question_id;
ALTER TABLE practice_answers DROP CONSTRAINT IF EXISTS fk_practice_answers_user_id;
ALTER TABLE practice_answers DROP CONSTRAINT IF EXISTS fk_practice_answers_session_id;
DROP TABLE IF EXISTS practice_answers;

DROP INDEX IF EXISTS idx_practice_sessions_user_id_package_id_created_at;
DROP INDEX IF EXISTS idx_practice_sessions_user_id_status;
DROP INDEX IF EXISTS idx_practice_sessions_user_id;

ALTER TABLE practice_sessions DROP CONSTRAINT IF EXISTS fk_practice_sessions_template_id;
ALTER TABLE practice_sessions DROP CONSTRAINT IF EXISTS fk_practice_sessions_tier_id;
ALTER TABLE practice_sessions DROP CONSTRAINT IF EXISTS fk_practice_sessions_package_id;
ALTER TABLE practice_sessions DROP CONSTRAINT IF EXISTS fk_practice_sessions_user_id;
DROP TABLE IF EXISTS practice_sessions;

ALTER TABLE practice_templates DROP CONSTRAINT IF EXISTS fk_practice_templates_updated_by_user_id;
ALTER TABLE practice_templates DROP CONSTRAINT IF EXISTS fk_practice_templates_created_by_user_id;
ALTER TABLE practice_templates DROP CONSTRAINT IF EXISTS fk_practice_templates_difficulty_id;
ALTER TABLE practice_templates DROP CONSTRAINT IF EXISTS fk_practice_templates_topic_id;
ALTER TABLE practice_templates DROP CONSTRAINT IF EXISTS fk_practice_templates_exam_package_id;
DROP TABLE IF EXISTS practice_templates;

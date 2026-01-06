-- 000007_question_bank.down.sql
-- Purpose: Drop question bank tables.
-- Risk: fast.
-- Reversible: yes (destructive).

-- Drop deferred foreign keys from practice tables first (they reference question-bank tables).
ALTER TABLE practice_answers DROP CONSTRAINT IF EXISTS fk_practice_answers_choice_id;
ALTER TABLE practice_answers DROP CONSTRAINT IF EXISTS fk_practice_answers_question_id;
ALTER TABLE practice_templates DROP CONSTRAINT IF EXISTS fk_practice_templates_difficulty_id;
ALTER TABLE practice_templates DROP CONSTRAINT IF EXISTS fk_practice_templates_topic_id;

ALTER TABLE question_bank_correct_choice DROP CONSTRAINT IF EXISTS fk_question_bank_correct_choice_choice_id;
ALTER TABLE question_bank_correct_choice DROP CONSTRAINT IF EXISTS fk_question_bank_correct_choice_question_id;
DROP TABLE IF EXISTS question_bank_correct_choice;

DROP INDEX IF EXISTS idx_question_bank_choices_question_id_order_index_unique;
ALTER TABLE question_bank_choices DROP CONSTRAINT IF EXISTS fk_question_bank_choices_question_id;
DROP TABLE IF EXISTS question_bank_choices;

DROP INDEX IF EXISTS idx_question_bank_questions_question_bank_id_topic_id_difficulty_id;
DROP INDEX IF EXISTS idx_question_bank_questions_question_bank_id;
ALTER TABLE question_bank_questions DROP CONSTRAINT IF EXISTS fk_question_bank_questions_updated_by_user_id;
ALTER TABLE question_bank_questions DROP CONSTRAINT IF EXISTS fk_question_bank_questions_created_by_user_id;
ALTER TABLE question_bank_questions DROP CONSTRAINT IF EXISTS fk_question_bank_questions_difficulty_id;
ALTER TABLE question_bank_questions DROP CONSTRAINT IF EXISTS fk_question_bank_questions_topic_id;
ALTER TABLE question_bank_questions DROP CONSTRAINT IF EXISTS fk_question_bank_questions_question_bank_id;
DROP TABLE IF EXISTS question_bank_questions;

DROP TABLE IF EXISTS question_bank_difficulties;

DROP INDEX IF EXISTS idx_question_topics_package_id_name_unique;
ALTER TABLE question_topics DROP CONSTRAINT IF EXISTS fk_question_topics_created_by_user_id;
ALTER TABLE question_topics DROP CONSTRAINT IF EXISTS fk_question_topics_package_id;
DROP TABLE IF EXISTS question_topics;

DROP INDEX IF EXISTS idx_question_banks_exam_package_id_name_unique;
ALTER TABLE question_banks DROP CONSTRAINT IF EXISTS fk_question_banks_exam_package_id;
ALTER TABLE question_banks DROP CONSTRAINT IF EXISTS fk_question_banks_created_by_user_id;
DROP TABLE IF EXISTS question_banks;

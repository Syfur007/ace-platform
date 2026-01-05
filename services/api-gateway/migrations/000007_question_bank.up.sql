-- 000007_question_bank.up.sql
-- Purpose: Create question bank tables.
-- Risk: medium (can grow with content).
-- Reversible: yes (drops tables; destructive).

CREATE TABLE IF NOT EXISTS question_banks (
  id text PRIMARY KEY,
  name text NOT NULL,
  exam_package_id uuid NOT NULL,
  created_by_user_id text,
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_question_banks_created_by_user_id') THEN
    ALTER TABLE question_banks
      ADD CONSTRAINT fk_question_banks_created_by_user_id
      FOREIGN KEY (created_by_user_id) REFERENCES users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_question_banks_exam_package_id') THEN
    ALTER TABLE question_banks
      ADD CONSTRAINT fk_question_banks_exam_package_id
      FOREIGN KEY (exam_package_id) REFERENCES exam_packages(id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_question_banks_exam_package_id_name_unique
  ON question_banks (exam_package_id, name);

CREATE TABLE IF NOT EXISTS question_topics (
  id text PRIMARY KEY,
  package_id uuid NOT NULL,
  name text NOT NULL,
  created_by_user_id text,
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_question_topics_package_id') THEN
    ALTER TABLE question_topics
      ADD CONSTRAINT fk_question_topics_package_id
      FOREIGN KEY (package_id) REFERENCES exam_packages(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_question_topics_created_by_user_id') THEN
    ALTER TABLE question_topics
      ADD CONSTRAINT fk_question_topics_created_by_user_id
      FOREIGN KEY (created_by_user_id) REFERENCES users(id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_question_topics_package_id_name_unique
  ON question_topics (package_id, name);

CREATE TABLE IF NOT EXISTS question_bank_difficulties (
  id text PRIMARY KEY,
  display_name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS question_bank_questions (
  id text PRIMARY KEY,
  question_bank_id text NOT NULL,
  topic_id text,
  difficulty_id text,
  prompt text NOT NULL,
  explanation_text text,
  review_note text,
  status text NOT NULL,
  created_by_user_id text,
  updated_by_user_id text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_question_bank_questions_question_bank_id') THEN
    ALTER TABLE question_bank_questions
      ADD CONSTRAINT fk_question_bank_questions_question_bank_id
      FOREIGN KEY (question_bank_id) REFERENCES question_banks(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_question_bank_questions_topic_id') THEN
    ALTER TABLE question_bank_questions
      ADD CONSTRAINT fk_question_bank_questions_topic_id
      FOREIGN KEY (topic_id) REFERENCES question_topics(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_question_bank_questions_difficulty_id') THEN
    ALTER TABLE question_bank_questions
      ADD CONSTRAINT fk_question_bank_questions_difficulty_id
      FOREIGN KEY (difficulty_id) REFERENCES question_bank_difficulties(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_question_bank_questions_created_by_user_id') THEN
    ALTER TABLE question_bank_questions
      ADD CONSTRAINT fk_question_bank_questions_created_by_user_id
      FOREIGN KEY (created_by_user_id) REFERENCES users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_question_bank_questions_updated_by_user_id') THEN
    ALTER TABLE question_bank_questions
      ADD CONSTRAINT fk_question_bank_questions_updated_by_user_id
      FOREIGN KEY (updated_by_user_id) REFERENCES users(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_question_bank_questions_question_bank_id
  ON question_bank_questions (question_bank_id);

CREATE INDEX IF NOT EXISTS idx_question_bank_questions_question_bank_id_topic_id_difficulty_id
  ON question_bank_questions (question_bank_id, topic_id, difficulty_id);

CREATE TABLE IF NOT EXISTS question_bank_choices (
  id text PRIMARY KEY,
  question_id text NOT NULL,
  order_index integer NOT NULL,
  text text NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_question_bank_choices_question_id') THEN
    ALTER TABLE question_bank_choices
      ADD CONSTRAINT fk_question_bank_choices_question_id
      FOREIGN KEY (question_id) REFERENCES question_bank_questions(id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_question_bank_choices_question_id_order_index_unique
  ON question_bank_choices (question_id, order_index);

CREATE TABLE IF NOT EXISTS question_bank_correct_choice (
  question_id text PRIMARY KEY,
  choice_id text NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_question_bank_correct_choice_question_id') THEN
    ALTER TABLE question_bank_correct_choice
      ADD CONSTRAINT fk_question_bank_correct_choice_question_id
      FOREIGN KEY (question_id) REFERENCES question_bank_questions(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_question_bank_correct_choice_choice_id') THEN
    ALTER TABLE question_bank_correct_choice
      ADD CONSTRAINT fk_question_bank_correct_choice_choice_id
      FOREIGN KEY (choice_id) REFERENCES question_bank_choices(id);
  END IF;
END $$;

-- Deferred foreign keys from practice tables (practice migration runs earlier).
-- These must run after question bank tables exist.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_practice_test_templates_topic_id') THEN
    ALTER TABLE practice_test_templates
      ADD CONSTRAINT fk_practice_test_templates_topic_id
      FOREIGN KEY (topic_id) REFERENCES question_topics(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_practice_test_templates_difficulty_id') THEN
    ALTER TABLE practice_test_templates
      ADD CONSTRAINT fk_practice_test_templates_difficulty_id
      FOREIGN KEY (difficulty_id) REFERENCES question_bank_difficulties(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_practice_answers_question_id') THEN
    ALTER TABLE practice_answers
      ADD CONSTRAINT fk_practice_answers_question_id
      FOREIGN KEY (question_id) REFERENCES question_bank_questions(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_practice_answers_choice_id') THEN
    ALTER TABLE practice_answers
      ADD CONSTRAINT fk_practice_answers_choice_id
      FOREIGN KEY (choice_id) REFERENCES question_bank_choices(id);
  END IF;
END $$;

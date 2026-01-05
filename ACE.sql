CREATE TABLE "users" (
  "id" text PRIMARY KEY,
  "email" text UNIQUE NOT NULL,
  "password_hash" text NOT NULL,
  "role" text NOT NULL DEFAULT 'student',
  "created_at" timestamp NOT NULL DEFAULT (now()),
  "updated_at" timestamp,
  "deleted_at" timestamp
);

CREATE TABLE "auth_sessions" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL,
  "role" text NOT NULL,
  "audience" text NOT NULL,
  "ip" text,
  "user_agent" text,
  "created_at" timestamp NOT NULL DEFAULT (now()),
  "last_seen_at" timestamp,
  "expires_at" timestamp NOT NULL,
  "revoked_at" timestamp,
  "revoked_reason" text
);

CREATE TABLE "auth_refresh_tokens" (
  "id" text PRIMARY KEY,
  "session_id" text NOT NULL,
  "token_hash" bytea NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT (now()),
  "expires_at" timestamp NOT NULL,
  "revoked_at" timestamp,
  "replaced_by_token_id" text
);

CREATE TABLE "auth_session_groups" (
  "id" text PRIMARY KEY,
  "name" text UNIQUE NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE "auth_session_group_memberships" (
  "group_id" text NOT NULL,
  "user_id" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY ("group_id", "user_id")
);

CREATE TABLE "auth_session_limits_group" (
  "group_id" text PRIMARY KEY,
  "max_active_sessions" integer
);

CREATE TABLE "auth_session_limits_user" (
  "user_id" text PRIMARY KEY,
  "max_active_sessions" integer
);

CREATE TABLE "auth_session_limits_role" (
  "role" text PRIMARY KEY,
  "max_active_sessions" integer
);

CREATE TABLE "exam_packages" (
  "id" uuid PRIMARY KEY,
  "code" text UNIQUE NOT NULL,
  "name" text UNIQUE NOT NULL,
  "subtitle" text,
  "overview" text,
  "modules" json,
  "highlights" json,
  "module_sections" json,
  "is_hidden" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT (now()),
  "updated_at" timestamp
);

CREATE TABLE "exam_package_tiers" (
  "id" uuid PRIMARY KEY,
  "exam_package_id" uuid NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_default" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "policy" json NOT NULL,
  "max_practice_sessions_per_week" integer,
  "max_exam_sessions_per_week" integer,
  "created_at" timestamp NOT NULL DEFAULT (now()),
  "updated_at" timestamp
);

CREATE TABLE "user_exam_package_enrollments" (
  "user_id" text NOT NULL,
  "exam_package_id" uuid NOT NULL,
  "tier_id" uuid,
  "created_at" timestamp NOT NULL DEFAULT (now()),
  "updated_at" timestamp,
  PRIMARY KEY ("user_id", "exam_package_id")
);

CREATE TABLE "user_exam_package_enrollment_events" (
  "id" bigserial PRIMARY KEY,
  "user_id" text NOT NULL,
  "exam_package_id" uuid NOT NULL,
  "from_tier_id" uuid,
  "to_tier_id" uuid NOT NULL,
  "changed_at" timestamp NOT NULL DEFAULT (now()),
  "changed_by_user_id" text,
  "reason" text,
  "metadata" json
);

CREATE TABLE "practice_test_templates" (
  "id" uuid PRIMARY KEY,
  "exam_package_id" uuid NOT NULL,
  "name" text NOT NULL,
  "section" text NOT NULL,
  "topic_id" text,
  "difficulty_id" text,
  "is_timed" boolean NOT NULL,
  "target_count" integer NOT NULL,
  "sort_order" integer,
  "is_published" boolean NOT NULL DEFAULT false,
  "created_by_user_id" text,
  "updated_by_user_id" text,
  "created_at" timestamp NOT NULL DEFAULT (now()),
  "updated_at" timestamp
);

CREATE TABLE "practice_sessions" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL,
  "package_id" uuid,
  "tier_id" uuid,
  "template_id" uuid,
  "is_timed" boolean NOT NULL,
  "started_at" timestamp NOT NULL,
  "time_limit_seconds" integer,
  "target_count" integer NOT NULL,
  "current_index" integer NOT NULL DEFAULT 0,
  "current_question_started_at" timestamp,
  "paused_at" timestamp,
  "status" text NOT NULL,
  "questions_snapshot" json NOT NULL,
  "question_timings" json,
  "correct_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT (now()),
  "last_activity_at" timestamp
);

CREATE TABLE "practice_answers" (
  "id" bigserial PRIMARY KEY,
  "session_id" text NOT NULL,
  "user_id" text NOT NULL,
  "question_id" text NOT NULL,
  "choice_id" text NOT NULL,
  "correct" boolean NOT NULL,
  "explanation" text,
  "ts" timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE "exam_sessions" (
  "user_id" text NOT NULL,
  "id" text NOT NULL,
  "status" text NOT NULL,
  "exam_package_id" uuid,
  "tier_id" uuid,
  "snapshot" json NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT (now()),
  "updated_at" timestamp,
  "last_heartbeat_at" timestamp,
  "submitted_at" timestamp,
  "terminated_at" timestamp,
  "terminated_by_user_id" text,
  "termination_reason" text,
  "invalidated_at" timestamp,
  "invalidated_by_user_id" text,
  "invalidation_reason" text,
  PRIMARY KEY ("user_id", "id")
);

CREATE TABLE "exam_session_events" (
  "id" bigserial PRIMARY KEY,
  "user_id" text NOT NULL,
  "session_id" text NOT NULL,
  "event_type" text NOT NULL,
  "payload" json,
  "created_at" timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE "exam_session_flags" (
  "id" bigserial PRIMARY KEY,
  "user_id" text NOT NULL,
  "session_id" text NOT NULL,
  "flag_type" text NOT NULL,
  "note" text,
  "created_by_user_id" text,
  "created_at" timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE "question_banks" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "exam_package_id" uuid NOT NULL,
  "created_by_user_id" text,
  "is_hidden" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT (now()),
  "updated_at" timestamp
);

CREATE TABLE "question_topics" (
  "id" text PRIMARY KEY,
  "package_id" uuid NOT NULL,
  "name" text NOT NULL,
  "created_by_user_id" text,
  "is_hidden" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT (now()),
  "updated_at" timestamp
);

CREATE TABLE "question_bank_difficulties" (
  "id" text PRIMARY KEY,
  "display_name" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0
);

CREATE TABLE "question_bank_questions" (
  "id" text PRIMARY KEY,
  "question_bank_id" text NOT NULL,
  "topic_id" text,
  "difficulty_id" text,
  "prompt" text NOT NULL,
  "explanation_text" text,
  "review_note" text,
  "status" text NOT NULL,
  "created_by_user_id" text,
  "updated_by_user_id" text,
  "created_at" timestamp NOT NULL DEFAULT (now()),
  "updated_at" timestamp
);

CREATE TABLE "question_bank_choices" (
  "id" text PRIMARY KEY,
  "question_id" text NOT NULL,
  "order_index" integer NOT NULL,
  "text" text NOT NULL
);

CREATE TABLE "question_bank_correct_choice" (
  "question_id" text PRIMARY KEY,
  "choice_id" text NOT NULL
);

CREATE TABLE "audit_log" (
  "id" bigserial PRIMARY KEY,
  "actor_user_id" text,
  "actor_role" text,
  "action" text NOT NULL,
  "target_type" text,
  "target_id" text,
  "metadata" json,
  "created_at" timestamp NOT NULL DEFAULT (now())
);

CREATE UNIQUE INDEX ON "exam_package_tiers" ("exam_package_id", "code");

CREATE INDEX ON "exam_package_tiers" ("exam_package_id", "is_active");

CREATE INDEX ON "user_exam_package_enrollments" ("user_id");

CREATE INDEX ON "practice_sessions" ("user_id");

CREATE INDEX ON "practice_sessions" ("user_id", "status");

CREATE INDEX ON "practice_sessions" ("user_id", "package_id", "created_at");

CREATE INDEX ON "practice_answers" ("session_id");

CREATE INDEX ON "practice_answers" ("user_id", "ts");

CREATE INDEX ON "exam_sessions" ("user_id", "status");

CREATE INDEX ON "exam_sessions" ("exam_package_id", "created_at");

CREATE UNIQUE INDEX ON "question_banks" ("exam_package_id", "name");

CREATE UNIQUE INDEX ON "question_topics" ("package_id", "name");

CREATE INDEX ON "question_bank_questions" ("question_bank_id");

CREATE INDEX ON "question_bank_questions" ("question_bank_id", "topic_id", "difficulty_id");

CREATE UNIQUE INDEX ON "question_bank_choices" ("question_id", "order_index");

CREATE INDEX ON "audit_log" ("actor_user_id");

CREATE INDEX ON "audit_log" ("created_at");

COMMENT ON COLUMN "practice_sessions"."status" IS 'check (status in (''active'',''paused'',''completed'',''terminated''))';

COMMENT ON COLUMN "exam_sessions"."status" IS 'check (status in (''active'',''submitted'',''terminated'',''invalidated''))';

ALTER TABLE "auth_sessions" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "auth_refresh_tokens" ADD FOREIGN KEY ("session_id") REFERENCES "auth_sessions" ("id");

ALTER TABLE "auth_refresh_tokens" ADD FOREIGN KEY ("replaced_by_token_id") REFERENCES "auth_refresh_tokens" ("id");

ALTER TABLE "auth_session_group_memberships" ADD FOREIGN KEY ("group_id") REFERENCES "auth_session_groups" ("id");

ALTER TABLE "auth_session_group_memberships" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "auth_session_limits_group" ADD FOREIGN KEY ("group_id") REFERENCES "auth_session_groups" ("id");

ALTER TABLE "auth_session_limits_user" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "exam_package_tiers" ADD FOREIGN KEY ("exam_package_id") REFERENCES "exam_packages" ("id");

ALTER TABLE "user_exam_package_enrollments" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "user_exam_package_enrollments" ADD FOREIGN KEY ("exam_package_id") REFERENCES "exam_packages" ("id");

ALTER TABLE "user_exam_package_enrollments" ADD FOREIGN KEY ("tier_id") REFERENCES "exam_package_tiers" ("id");

ALTER TABLE "user_exam_package_enrollment_events" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "user_exam_package_enrollment_events" ADD FOREIGN KEY ("exam_package_id") REFERENCES "exam_packages" ("id");

ALTER TABLE "user_exam_package_enrollment_events" ADD FOREIGN KEY ("from_tier_id") REFERENCES "exam_package_tiers" ("id");

ALTER TABLE "user_exam_package_enrollment_events" ADD FOREIGN KEY ("to_tier_id") REFERENCES "exam_package_tiers" ("id");

ALTER TABLE "user_exam_package_enrollment_events" ADD FOREIGN KEY ("changed_by_user_id") REFERENCES "users" ("id");

ALTER TABLE "practice_test_templates" ADD FOREIGN KEY ("exam_package_id") REFERENCES "exam_packages" ("id");

ALTER TABLE "practice_test_templates" ADD FOREIGN KEY ("topic_id") REFERENCES "question_topics" ("id");

ALTER TABLE "practice_test_templates" ADD FOREIGN KEY ("difficulty_id") REFERENCES "question_bank_difficulties" ("id");

ALTER TABLE "practice_test_templates" ADD FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id");

ALTER TABLE "practice_test_templates" ADD FOREIGN KEY ("updated_by_user_id") REFERENCES "users" ("id");

ALTER TABLE "practice_sessions" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "practice_sessions" ADD FOREIGN KEY ("package_id") REFERENCES "exam_packages" ("id");

ALTER TABLE "practice_sessions" ADD FOREIGN KEY ("tier_id") REFERENCES "exam_package_tiers" ("id");

ALTER TABLE "practice_sessions" ADD FOREIGN KEY ("template_id") REFERENCES "practice_test_templates" ("id");

ALTER TABLE "practice_answers" ADD FOREIGN KEY ("session_id") REFERENCES "practice_sessions" ("id");

ALTER TABLE "practice_answers" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "practice_answers" ADD FOREIGN KEY ("question_id") REFERENCES "question_bank_questions" ("id");

ALTER TABLE "practice_answers" ADD FOREIGN KEY ("choice_id") REFERENCES "question_bank_choices" ("id");

ALTER TABLE "exam_sessions" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "exam_sessions" ADD FOREIGN KEY ("exam_package_id") REFERENCES "exam_packages" ("id");

ALTER TABLE "exam_sessions" ADD FOREIGN KEY ("tier_id") REFERENCES "exam_package_tiers" ("id");

ALTER TABLE "exam_sessions" ADD FOREIGN KEY ("terminated_by_user_id") REFERENCES "users" ("id");

ALTER TABLE "exam_sessions" ADD FOREIGN KEY ("invalidated_by_user_id") REFERENCES "users" ("id");

ALTER TABLE "exam_session_events" ADD FOREIGN KEY ("user_id", "session_id") REFERENCES "exam_sessions" ("user_id", "id");

ALTER TABLE "exam_session_flags" ADD FOREIGN KEY ("user_id", "session_id") REFERENCES "exam_sessions" ("user_id", "id");

ALTER TABLE "exam_session_flags" ADD FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id");

ALTER TABLE "audit_log" ADD FOREIGN KEY ("actor_user_id") REFERENCES "users" ("id");

ALTER TABLE "question_banks" ADD FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id");

ALTER TABLE "question_banks" ADD FOREIGN KEY ("exam_package_id") REFERENCES "exam_packages" ("id");

ALTER TABLE "question_topics" ADD FOREIGN KEY ("package_id") REFERENCES "exam_packages" ("id");

ALTER TABLE "question_topics" ADD FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id");

ALTER TABLE "question_bank_questions" ADD FOREIGN KEY ("question_bank_id") REFERENCES "question_banks" ("id");

ALTER TABLE "question_bank_questions" ADD FOREIGN KEY ("topic_id") REFERENCES "question_topics" ("id");

ALTER TABLE "question_bank_questions" ADD FOREIGN KEY ("difficulty_id") REFERENCES "question_bank_difficulties" ("id");

ALTER TABLE "question_bank_questions" ADD FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id");

ALTER TABLE "question_bank_questions" ADD FOREIGN KEY ("updated_by_user_id") REFERENCES "users" ("id");

ALTER TABLE "question_bank_choices" ADD FOREIGN KEY ("question_id") REFERENCES "question_bank_questions" ("id");

ALTER TABLE "question_bank_correct_choice" ADD FOREIGN KEY ("question_id") REFERENCES "question_bank_questions" ("id");

ALTER TABLE "question_bank_correct_choice" ADD FOREIGN KEY ("choice_id") REFERENCES "question_bank_choices" ("id");

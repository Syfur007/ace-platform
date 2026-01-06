-- 000006_exam_sessions.down.sql
-- Purpose: Drop exam session tables.
-- Risk: fast.
-- Reversible: yes (destructive).

ALTER TABLE exam_session_flags DROP CONSTRAINT IF EXISTS fk_exam_session_flags_created_by_user_id;
ALTER TABLE exam_session_flags DROP CONSTRAINT IF EXISTS fk_exam_session_flags_user_session;
DROP TABLE IF EXISTS exam_session_flags;

ALTER TABLE exam_session_events DROP CONSTRAINT IF EXISTS fk_exam_session_events_user_session;
DROP TABLE IF EXISTS exam_session_events;

DROP INDEX IF EXISTS idx_exam_sessions_exam_package_id_created_at;
DROP INDEX IF EXISTS idx_exam_sessions_user_id_status;

ALTER TABLE exam_sessions DROP CONSTRAINT IF EXISTS fk_exam_sessions_invalidated_by_user_id;
ALTER TABLE exam_sessions DROP CONSTRAINT IF EXISTS fk_exam_sessions_terminated_by_user_id;
ALTER TABLE exam_sessions DROP CONSTRAINT IF EXISTS fk_exam_sessions_tier_id;
ALTER TABLE exam_sessions DROP CONSTRAINT IF EXISTS fk_exam_sessions_exam_package_id;
ALTER TABLE exam_sessions DROP CONSTRAINT IF EXISTS fk_exam_sessions_user_id;
DROP TABLE IF EXISTS exam_sessions;

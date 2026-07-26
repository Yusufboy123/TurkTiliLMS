-- Manual rollback for Module 8.1B before Module 8.2 writes progress data.
--
-- Prisma does not execute down migrations automatically. This script is an
-- operator-reviewed recovery aid and is exercised only against an isolated test
-- schema. After any progress row exists, prefer a reviewed forward fix or an
-- approved data-preserving export/recovery plan.

BEGIN;

DROP TABLE IF EXISTS "progress_events";
DROP TABLE IF EXISTS "lesson_progress";
DROP TABLE IF EXISTS "block_progress";
DROP TABLE IF EXISTS "idempotency_records";
DROP TABLE IF EXISTS "enrollment_progress_roots";

ALTER TABLE "courses"
DROP CONSTRAINT IF EXISTS "courses_curriculum_version_positive_check";

ALTER TABLE "courses"
DROP COLUMN IF EXISTS "curriculum_version";

DROP TYPE IF EXISTS "idempotency_operation";
DROP TYPE IF EXISTS "progress_event_state";
DROP TYPE IF EXISTS "progress_event_type";
DROP TYPE IF EXISTS "lesson_progress_state";
DROP TYPE IF EXISTS "block_progress_state";

COMMIT;

-- Module 8.1B read-only preflight.
-- Run against the exact target database before `prisma migrate deploy`.
-- Review the result with the database/data owner; this script changes no data.

BEGIN TRANSACTION READ ONLY;

SELECT
    current_database() AS database_name,
    current_schema() AS schema_name,
    inet_server_addr()::TEXT AS server_address,
    version() AS postgres_version;

SELECT
    "status"::TEXT AS enrollment_status,
    COUNT(*) AS enrollment_count
FROM "course_enrollments"
GROUP BY "status"
ORDER BY "status";

SELECT
    COUNT(*) AS course_count
FROM "courses";

SELECT
    COUNT(*) FILTER (
        WHERE "status" = 'PUBLISHED' AND "deleted_at" IS NULL
    ) AS eligible_lesson_count,
    COUNT(*) AS total_lesson_count
FROM "lessons";

SELECT
    COUNT(*) FILTER (
        WHERE "is_visible" = TRUE AND "deleted_at" IS NULL
    ) AS completion_addressable_block_count,
    COUNT(*) FILTER (
        WHERE "is_visible" = TRUE
          AND "is_required" = TRUE
          AND "deleted_at" IS NULL
    ) AS aggregate_eligible_block_count,
    COUNT(*) AS total_block_count
FROM "lesson_content_blocks";

-- Any returned name is a collision or legacy structure that requires explicit
-- data-owner review. The migration never renames, drops, or backfills it.
SELECT "table_name"
FROM "information_schema"."tables"
WHERE "table_schema" = current_schema()
  AND "table_name" IN (
      'enrollment_progress_roots',
      'lesson_progress',
      'block_progress',
      'progress_events',
      'idempotency_records'
  )
ORDER BY "table_name";

-- Existing enrollment rows should already satisfy the Module #7 lifecycle
-- constraints. A nonzero result blocks migration review.
SELECT COUNT(*) AS invalid_enrollment_lifecycle_count
FROM "course_enrollments"
WHERE NOT (
    (
        "status" = 'ACTIVE'
        AND "cancelled_at" IS NULL
        AND "completed_at" IS NULL
        AND "suspended_at" IS NULL
    )
    OR (
        "status" = 'SUSPENDED'
        AND "suspended_at" IS NOT NULL
        AND "cancelled_at" IS NULL
        AND "completed_at" IS NULL
    )
    OR (
        "status" = 'CANCELLED'
        AND "cancelled_at" IS NOT NULL
        AND "completed_at" IS NULL
        AND "suspended_at" IS NULL
    )
    OR (
        "status" = 'COMPLETED'
        AND "completed_at" IS NOT NULL
        AND "cancelled_at" IS NULL
        AND "suspended_at" IS NULL
    )
);

ROLLBACK;

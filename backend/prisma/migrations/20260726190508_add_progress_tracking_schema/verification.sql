-- Module 8.1B post-deploy verification.
-- Every expected count must match the comment beside the query.

-- Expected: 5 rows.
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

-- Expected: is_nullable = NO, column_default = 1.
SELECT "is_nullable", "column_default"
FROM "information_schema"."columns"
WHERE "table_schema" = current_schema()
  AND "table_name" = 'courses'
  AND "column_name" = 'curriculum_version';

-- Expected: 20 rows.
SELECT "conname", "convalidated"
FROM "pg_catalog"."pg_constraint"
WHERE "connamespace" = (
    SELECT "oid"
    FROM "pg_catalog"."pg_namespace"
    WHERE "nspname" = current_schema()
)
  AND "conname" IN (
      'courses_curriculum_version_positive_check',
      'enrollment_progress_roots_versions_check',
      'enrollment_progress_roots_counts_check',
      'enrollment_progress_roots_percentage_check',
      'enrollment_progress_roots_last_visited_pair_check',
      'enrollment_progress_roots_activity_timestamps_check',
      'lesson_progress_curriculum_version_positive_check',
      'lesson_progress_state_completion_check',
      'lesson_progress_timestamps_check',
      'block_progress_curriculum_version_positive_check',
      'block_progress_state_completion_check',
      'progress_events_versions_check',
      'progress_events_shape_check',
      'progress_events_transition_check',
      'progress_events_snapshot_check',
      'idempotency_records_key_check',
      'idempotency_records_fingerprint_check',
      'idempotency_records_response_status_check',
      'idempotency_records_result_versions_check',
      'idempotency_records_expiry_check'
  )
ORDER BY "conname";

-- Expected: 27 rows. Primary-key indexes are included.
SELECT "indexname"
FROM "pg_catalog"."pg_indexes"
WHERE "schemaname" = current_schema()
  AND "tablename" IN (
      'enrollment_progress_roots',
      'lesson_progress',
      'block_progress',
      'progress_events',
      'idempotency_records'
  )
ORDER BY "indexname";

-- Expected: every delete action is RESTRICT except nullable progress-event
-- actor and idempotency-record relations, which are SET NULL to preserve
-- append-only history while allowing anonymization and bounded replay cleanup.
SELECT
    "conname",
    CASE "confdeltype"
        WHEN 'a' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
    END AS on_delete
FROM "pg_catalog"."pg_constraint"
WHERE "connamespace" = (
    SELECT "oid"
    FROM "pg_catalog"."pg_namespace"
    WHERE "nspname" = current_schema()
)
  AND "contype" = 'f'
  AND "conrelid" IN (
      'enrollment_progress_roots'::REGCLASS,
      'lesson_progress'::REGCLASS,
      'block_progress'::REGCLASS,
      'progress_events'::REGCLASS,
      'idempotency_records'::REGCLASS
  )
ORDER BY "conname";

-- Expected immediately after 8.1B: zero rows in every progress table. Module
-- 8.1B never fabricates historical progress.
SELECT
    (SELECT COUNT(*) FROM "enrollment_progress_roots") AS progress_root_count,
    (SELECT COUNT(*) FROM "lesson_progress") AS lesson_progress_count,
    (SELECT COUNT(*) FROM "block_progress") AS block_progress_count,
    (SELECT COUNT(*) FROM "progress_events") AS progress_event_count,
    (SELECT COUNT(*) FROM "idempotency_records") AS idempotency_record_count;

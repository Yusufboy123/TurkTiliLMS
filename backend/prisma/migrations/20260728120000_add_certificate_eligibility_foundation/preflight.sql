-- Module 8.5B read-only preflight.
-- Run against the exact target database before `prisma migrate deploy`.
-- A database/data owner must review every result. This script changes no data.

BEGIN TRANSACTION READ ONLY;

SELECT
    current_database() AS database_name,
    current_schema() AS schema_name,
    inet_server_addr()::TEXT AS server_address,
    version() AS postgres_version;

-- Expected before first deployment: no rows. Any result is a name collision or
-- manually created structure that requires deliberate review.
SELECT "object_kind", "object_name"
FROM (
    SELECT 'relation' AS "object_kind", "pg_class"."relname" AS "object_name"
    FROM "pg_catalog"."pg_class"
    JOIN "pg_catalog"."pg_namespace"
      ON "pg_namespace"."oid" = "pg_class"."relnamespace"
    WHERE "pg_namespace"."nspname" = current_schema()
      AND "pg_class"."relname" IN (
          'certificate_eligibility_policies',
          'certificate_eligibility_evaluations',
          'certificate_eligibility_reasons',
          'course_enrollments_id_course_id_key',
          'certificate_eligibility_policies_code_version_key',
          'eligibility_evaluations_supersedes_id_key',
          'eligibility_evaluations_enrollment_version_key',
          'eligibility_evaluations_snapshot_key',
          'eligibility_evaluations_course_status_at_idx',
          'eligibility_evaluations_enrollment_status_at_idx',
          'eligibility_evaluations_policy_status_at_idx',
          'eligibility_evaluations_evaluator_at_idx',
          'certificate_eligibility_reasons_code_evaluation_id_idx'
      )

    UNION ALL

    SELECT 'type', "pg_type"."typname"
    FROM "pg_catalog"."pg_type"
    JOIN "pg_catalog"."pg_namespace"
      ON "pg_namespace"."oid" = "pg_type"."typnamespace"
    WHERE "pg_namespace"."nspname" = current_schema()
      AND "pg_type"."typname" IN (
          'certificate_eligibility_policy_code',
          'certificate_eligibility_assessment_rule',
          'certificate_eligibility_status',
          'certificate_eligibility_reason_code',
          'certificate_eligibility_evaluator_type'
      )

    UNION ALL

    SELECT 'function', "pg_proc"."proname"
    FROM "pg_catalog"."pg_proc"
    JOIN "pg_catalog"."pg_namespace"
      ON "pg_namespace"."oid" = "pg_proc"."pronamespace"
    WHERE "pg_namespace"."nspname" = current_schema()
      AND "pg_proc"."proname" IN (
          'prevent_certificate_eligibility_mutation',
          'enforce_certificate_eligibility_reason_state'
      )
) AS "collisions"
ORDER BY "object_kind", "object_name";

-- Existing completed enrollments are classified without changing them.
SELECT
    COUNT(*) AS completed_enrollment_count,
    COUNT(*) FILTER (WHERE "progress_root_id" IS NULL) AS missing_progress_root_count,
    COUNT(*) FILTER (
        WHERE "progress_root_id" IS NOT NULL
          AND "frozen_at" IS NULL
    ) AS unfrozen_progress_count,
    COUNT(*) FILTER (
        WHERE "progress_root_id" IS NOT NULL
          AND (
              "course_percentage" <> 100
              OR "completed_eligible_blocks" < 0
              OR "total_eligible_blocks" < 0
              OR "completed_eligible_blocks" > "total_eligible_blocks"
              OR "total_eligible_lessons" <= 0
              OR "completed_lessons" <> "total_eligible_lessons"
              OR "completion_version" <= 0
              OR "curriculum_version" <= 0
          )
    ) AS invalid_completion_snapshot_count,
    COUNT(*) FILTER (WHERE "matching_event_count" = 0) AS missing_completion_event_count,
    COUNT(*) FILTER (WHERE "matching_event_count" > 1) AS ambiguous_completion_event_count,
    COUNT(*) FILTER (
        WHERE "completed_at" IS NOT NULL
          AND "frozen_at" IS NOT NULL
          AND "completed_at" <> "frozen_at"
    ) AS timestamp_mismatch_count
FROM (
    SELECT
        "ce"."id",
        "ce"."completed_at",
        "epr"."id" AS "progress_root_id",
        "epr"."frozen_at",
        "epr"."course_percentage",
        "epr"."completed_eligible_blocks",
        "epr"."total_eligible_blocks",
        "epr"."completed_lessons",
        "epr"."total_eligible_lessons",
        "epr"."completion_version",
        "epr"."curriculum_version",
        COUNT("pe"."id") FILTER (
            WHERE "pe"."event_type" = 'COURSE_COMPLETED'
              AND "pe"."resulting_completion_version" = "epr"."completion_version"
              AND "pe"."curriculum_version" = "epr"."curriculum_version"
              AND "pe"."snapshot_completed_eligible_blocks" = "epr"."completed_eligible_blocks"
              AND "pe"."snapshot_total_eligible_blocks" = "epr"."total_eligible_blocks"
              AND "pe"."snapshot_completed_lessons" = "epr"."completed_lessons"
              AND "pe"."snapshot_total_eligible_lessons" = "epr"."total_eligible_lessons"
              AND "pe"."snapshot_course_percentage" = "epr"."course_percentage"
              AND "pe"."occurred_at" = "ce"."completed_at"
        ) AS "matching_event_count"
    FROM "course_enrollments" AS "ce"
    LEFT JOIN "enrollment_progress_roots" AS "epr"
      ON "epr"."enrollment_id" = "ce"."id"
    LEFT JOIN "progress_events" AS "pe"
      ON "pe"."enrollment_id" = "ce"."id"
    WHERE "ce"."status" = 'COMPLETED'
    GROUP BY
        "ce"."id",
        "ce"."completed_at",
        "epr"."id",
        "epr"."frozen_at",
        "epr"."course_percentage",
        "epr"."completed_eligible_blocks",
        "epr"."total_eligible_blocks",
        "epr"."completed_lessons",
        "epr"."total_eligible_lessons",
        "epr"."completion_version",
        "epr"."curriculum_version"
) AS "completed_evidence";

-- These are candidates for a separately reviewed, idempotent backfill. This
-- migration intentionally does not create eligibility evidence for them.
SELECT COUNT(*) AS deterministic_backfill_candidate_count
FROM (
    SELECT "ce"."id"
    FROM "course_enrollments" AS "ce"
    JOIN "enrollment_progress_roots" AS "epr"
      ON "epr"."enrollment_id" = "ce"."id"
    JOIN "progress_events" AS "pe"
      ON "pe"."enrollment_id" = "ce"."id"
     AND "pe"."event_type" = 'COURSE_COMPLETED'
     AND "pe"."resulting_completion_version" = "epr"."completion_version"
     AND "pe"."curriculum_version" = "epr"."curriculum_version"
     AND "pe"."snapshot_completed_eligible_blocks" = "epr"."completed_eligible_blocks"
     AND "pe"."snapshot_total_eligible_blocks" = "epr"."total_eligible_blocks"
     AND "pe"."snapshot_completed_lessons" = "epr"."completed_lessons"
     AND "pe"."snapshot_total_eligible_lessons" = "epr"."total_eligible_lessons"
     AND "pe"."snapshot_course_percentage" = "epr"."course_percentage"
     AND "pe"."occurred_at" = "ce"."completed_at"
    WHERE "ce"."status" = 'COMPLETED'
      AND "ce"."completed_at" IS NOT NULL
      AND "epr"."frozen_at" = "ce"."completed_at"
      AND "epr"."course_percentage" = 100
      AND "epr"."total_eligible_lessons" > 0
      AND "epr"."completed_lessons" = "epr"."total_eligible_lessons"
      AND "epr"."completion_version" > 0
      AND "epr"."curriculum_version" > 0
    GROUP BY "ce"."id"
    HAVING COUNT("pe"."id") = 1
) AS "backfill_candidates";

ROLLBACK;

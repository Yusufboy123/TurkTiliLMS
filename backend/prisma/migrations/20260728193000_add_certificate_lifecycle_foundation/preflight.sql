-- Module 8.6B read-only preflight.
-- Run against the exact target database before `prisma migrate deploy`.
-- Every non-empty collision or unsafe-data result requires database-owner
-- review. This script changes no schema or data.

BEGIN TRANSACTION READ ONLY;

SELECT
    CURRENT_DATABASE() AS database_name,
    CURRENT_SCHEMA() AS schema_name,
    INET_SERVER_ADDR()::TEXT AS server_address,
    VERSION() AS postgres_version;

-- Expected before first deployment: no rows. Prefix matching deliberately
-- catches manually-created objects that would collide with this foundation.
SELECT "object_kind", "object_name"
FROM (
    SELECT
        CASE "pg_class"."relkind"
            WHEN 'S' THEN 'sequence'
            WHEN 'i' THEN 'index'
            ELSE 'relation'
        END AS "object_kind",
        "pg_class"."relname" AS "object_name"
    FROM "pg_catalog"."pg_class"
    JOIN "pg_catalog"."pg_namespace"
      ON "pg_namespace"."oid" = "pg_class"."relnamespace"
    WHERE "pg_namespace"."nspname" = CURRENT_SCHEMA()
      AND (
          "pg_class"."relname" LIKE 'certificate_templates%'
          OR "pg_class"."relname" LIKE 'certificate_template_versions%'
          OR "pg_class"."relname" LIKE 'certificates%'
          OR "pg_class"."relname" LIKE 'certificate_artifacts%'
          OR "pg_class"."relname" LIKE 'certificate_disclosure_controls%'
          OR "pg_class"."relname" LIKE 'step_up_challenges%'
          OR "pg_class"."relname" LIKE 'step_up_proofs%'
          OR "pg_class"."relname" = 'certificate_number_global_seq'
          OR "pg_class"."relname" = 'eligibility_evaluations_id_enrollment_course_key'
          OR "pg_class"."relname" = 'user_sessions_id_user_id_key'
          OR "pg_class"."relname" = 'certificates_id_enrollment_id_key'
          OR "pg_class"."relname" = 'idempotency_records_resulting_certificate_id_idx'
      )

    UNION ALL

    SELECT 'type', "pg_type"."typname"
    FROM "pg_catalog"."pg_type"
    JOIN "pg_catalog"."pg_namespace"
      ON "pg_namespace"."oid" = "pg_type"."typnamespace"
    WHERE "pg_namespace"."nspname" = CURRENT_SCHEMA()
      AND "pg_type"."typname" IN (
          'certificate_lifecycle_status',
          'certificate_revocation_reason_code',
          'certificate_template_version_status',
          'certificate_artifact_storage_provider',
          'step_up_action',
          'step_up_target_type',
          'step_up_continuation'
      )

    UNION ALL

    SELECT 'function', "pg_proc"."proname"
    FROM "pg_catalog"."pg_proc"
    JOIN "pg_catalog"."pg_namespace"
      ON "pg_namespace"."oid" = "pg_proc"."pronamespace"
    WHERE "pg_namespace"."nspname" = CURRENT_SCHEMA()
      AND "pg_proc"."proname" IN (
          'generate_certificate_number',
          'protect_certificate_template_identity',
          'protect_certificate_template_version',
          'protect_certificate_lifecycle',
          'prevent_certificate_artifact_mutation',
          'protect_step_up_challenge',
          'enforce_step_up_proof_challenge_state',
          'protect_step_up_proof',
          'prevent_idempotency_receipt_update'
      )

    UNION ALL

    SELECT 'trigger', "trigger_name"
    FROM "information_schema"."triggers"
    WHERE "trigger_schema" = CURRENT_SCHEMA()
      AND "trigger_name" IN (
          'certificate_templates_identity_guard',
          'certificate_template_versions_immutable_guard',
          'certificates_lifecycle_guard',
          'certificate_artifacts_immutable_guard',
          'step_up_challenges_lifecycle_guard',
          'step_up_proofs_challenge_state_guard',
          'step_up_proofs_single_use_guard',
          'idempotency_records_immutable_guard'
      )

    UNION ALL

    SELECT 'constraint', "pg_constraint"."conname"
    FROM "pg_catalog"."pg_constraint"
    JOIN "pg_catalog"."pg_namespace"
      ON "pg_namespace"."oid" = "pg_constraint"."connamespace"
    WHERE "pg_namespace"."nspname" = CURRENT_SCHEMA()
      AND "pg_constraint"."conname" IN (
          'idempotency_records_result_shape_check',
          'idempotency_records_resulting_certificate_id_fkey'
      )

    UNION ALL

    SELECT 'column', "table_name" || '.' || "column_name"
    FROM "information_schema"."columns"
    WHERE "table_schema" = CURRENT_SCHEMA()
      AND (
          (
              "table_name" = 'user_sessions'
              AND "column_name" = 'last_authenticated_at'
          )
          OR (
              "table_name" = 'idempotency_records'
              AND "column_name" IN (
                  'resulting_certificate_id',
                  'resulting_certificate_version'
              )
          )
      )
) AS "collisions"
ORDER BY "object_kind", "object_name";

-- Expected: zero. The existing operation vocabulary must be the exact approved
-- Progress-only set before this migration replaces the enum atomically.
SELECT DISTINCT "operation"::TEXT AS unsupported_idempotency_operation
FROM "idempotency_records"
WHERE "operation"::TEXT NOT IN (
    'COMPLETE_BLOCK',
    'REOPEN_BLOCK',
    'COMPLETE_LESSON',
    'REOPEN_LESSON',
    'RECORD_LAST_VISITED_LESSON'
)
ORDER BY unsupported_idempotency_operation;

-- Expected: zero. Retargeting the FK is safe only when every existing replay
-- record already maps to its real course enrollment.
SELECT COUNT(*) AS idempotency_records_without_enrollment_count
FROM "idempotency_records" AS "ir"
LEFT JOIN "course_enrollments" AS "ce"
  ON "ce"."id" = "ir"."enrollment_id"
WHERE "ce"."id" IS NULL;

-- Expected: the current FK targets enrollment_progress_roots before migration,
-- or course_enrollments when this preflight is rerun after deployment.
SELECT
    "constraint_name",
    "foreign_table_name"
FROM (
    SELECT
        "pc"."conname" AS "constraint_name",
        "target"."relname" AS "foreign_table_name"
    FROM "pg_catalog"."pg_constraint" AS "pc"
    JOIN "pg_catalog"."pg_class" AS "source"
      ON "source"."oid" = "pc"."conrelid"
    JOIN "pg_catalog"."pg_class" AS "target"
      ON "target"."oid" = "pc"."confrelid"
    JOIN "pg_catalog"."pg_namespace" AS "namespace"
      ON "namespace"."oid" = "source"."relnamespace"
    WHERE "namespace"."nspname" = CURRENT_SCHEMA()
      AND "source"."relname" = 'idempotency_records'
      AND "pc"."conname" = 'idempotency_records_enrollment_id_fkey'
) AS "idempotency_fk";

-- Existing Progress receipts must already satisfy their approved shape.
-- Expected: zero.
SELECT COUNT(*) AS incompatible_progress_receipt_count
FROM "idempotency_records"
WHERE "request_fingerprint" !~ '^[0-9a-f]{64}$'
   OR "response_status" NOT BETWEEN 200 AND 299
   OR "expires_at" <= "created_at"
   OR (
       "operation" = 'RECORD_LAST_VISITED_LESSON'
       AND (
           "resulting_completion_version" IS NOT NULL
           OR "resulting_activity_version" IS NULL
           OR "resulting_activity_version" < 0
       )
   )
   OR (
       "operation" <> 'RECORD_LAST_VISITED_LESSON'
       AND (
           "resulting_completion_version" IS NULL
           OR "resulting_completion_version" < 0
           OR "resulting_activity_version" IS NOT NULL
       )
   );

-- Expected: zero. Existing permission codes with incompatible resource/action
-- meanings must be resolved manually; this preflight never rewrites them.
SELECT "code", "resource", "action"
FROM "permissions"
WHERE (
        "code" = 'certificates.self_download'
        AND (
            "resource" <> 'certificates'
            OR "action" <> 'self_download'
        )
    )
   OR (
        "code" = 'certificates.download'
        AND (
            "resource" <> 'certificates'
            OR "action" <> 'download'
        )
    )
ORDER BY "code";

ROLLBACK;

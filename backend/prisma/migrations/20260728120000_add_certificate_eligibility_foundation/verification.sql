-- Module 8.5B post-deploy verification.

-- Expected: 3 rows.
SELECT "table_name"
FROM "information_schema"."tables"
WHERE "table_schema" = current_schema()
  AND "table_name" IN (
      'certificate_eligibility_policies',
      'certificate_eligibility_evaluations',
      'certificate_eligibility_reasons'
  )
ORDER BY "table_name";

-- Expected: 5 enum types with only the labels approved by Module 8.5A.
SELECT "typname", ARRAY_AGG("enumlabel" ORDER BY "enumsortorder") AS "labels"
FROM "pg_catalog"."pg_enum"
JOIN "pg_catalog"."pg_type"
  ON "pg_type"."oid" = "pg_enum"."enumtypid"
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
GROUP BY "typname"
ORDER BY "typname";

-- Expected: 7 validated CHECK constraints.
SELECT "conname", "convalidated"
FROM "pg_catalog"."pg_constraint"
WHERE "connamespace" = (
    SELECT "oid"
    FROM "pg_catalog"."pg_namespace"
    WHERE "nspname" = current_schema()
)
  AND "conname" IN (
      'eligibility_policies_v1_shape_check',
      'eligibility_evaluations_v1_status_check',
      'eligibility_evaluations_versions_check',
      'eligibility_evaluations_snapshot_check',
      'eligibility_evaluations_timestamps_check',
      'eligibility_evaluations_evaluator_check',
      'eligibility_evaluations_supersession_check'
  )
ORDER BY "conname";

-- Expected: 13 rows, including primary-key and unique indexes.
SELECT "indexname"
FROM "pg_catalog"."pg_indexes"
WHERE "schemaname" = current_schema()
  AND (
      "tablename" IN (
          'certificate_eligibility_policies',
          'certificate_eligibility_evaluations',
          'certificate_eligibility_reasons'
      )
      OR "indexname" = 'course_enrollments_id_course_id_key'
  )
ORDER BY "indexname";

-- Expected: 6 foreign keys, all RESTRICT on delete.
SELECT
    "conname",
    CASE "confdeltype"
        WHEN 'a' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
    END AS "on_delete"
FROM "pg_catalog"."pg_constraint"
WHERE "connamespace" = (
    SELECT "oid"
    FROM "pg_catalog"."pg_namespace"
    WHERE "nspname" = current_schema()
)
  AND "contype" = 'f'
  AND "conrelid" IN (
      'certificate_eligibility_evaluations'::REGCLASS,
      'certificate_eligibility_reasons'::REGCLASS
  )
ORDER BY "conname";

-- Expected: 4 triggers (three immutable-table guards and one reason-state
-- guard).
SELECT
    "trigger_name",
    ARRAY_AGG("event_manipulation" ORDER BY "event_manipulation") AS "events"
FROM "information_schema"."triggers"
WHERE "trigger_schema" = current_schema()
  AND "event_object_table" IN (
      'certificate_eligibility_policies',
      'certificate_eligibility_evaluations',
      'certificate_eligibility_reasons'
  )
GROUP BY "trigger_name"
ORDER BY "trigger_name";

-- Expected immediately after migration: zero rows. The standard seed may later
-- create exactly one typed v1 policy, but neither migration nor seed creates
-- historical eligibility evidence.
SELECT
    (SELECT COUNT(*) FROM "certificate_eligibility_policies") AS "policy_count",
    (SELECT COUNT(*) FROM "certificate_eligibility_evaluations") AS "evaluation_count",
    (SELECT COUNT(*) FROM "certificate_eligibility_reasons") AS "reason_count";

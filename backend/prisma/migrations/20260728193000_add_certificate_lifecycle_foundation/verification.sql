-- Module 8.6B post-deploy verification. This script is read-only.

-- Expected: 7 tables.
SELECT "table_name"
FROM "information_schema"."tables"
WHERE "table_schema" = CURRENT_SCHEMA()
  AND "table_name" IN (
      'certificate_templates',
      'certificate_template_versions',
      'certificates',
      'certificate_artifacts',
      'certificate_disclosure_controls',
      'step_up_challenges',
      'step_up_proofs'
  )
ORDER BY "table_name";

-- Expected: 7 enum types with the exact approved labels.
SELECT "typname", ARRAY_AGG("enumlabel" ORDER BY "enumsortorder") AS "labels"
FROM "pg_catalog"."pg_enum"
JOIN "pg_catalog"."pg_type"
  ON "pg_type"."oid" = "pg_enum"."enumtypid"
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
GROUP BY "typname"
ORDER BY "typname";

-- Expected: both certificate operations appear after all Progress operations.
SELECT "enumlabel", "enumsortorder"
FROM "pg_catalog"."pg_enum"
JOIN "pg_catalog"."pg_type"
  ON "pg_type"."oid" = "pg_enum"."enumtypid"
JOIN "pg_catalog"."pg_namespace"
  ON "pg_namespace"."oid" = "pg_type"."typnamespace"
WHERE "pg_namespace"."nspname" = CURRENT_SCHEMA()
  AND "pg_type"."typname" = 'idempotency_operation'
ORDER BY "enumsortorder";

-- Expected: current FK points to course_enrollments, not Progress root.
SELECT
    "pc"."conname",
    "target"."relname" AS "foreign_table_name",
    "pc"."confdeltype"
FROM "pg_catalog"."pg_constraint" AS "pc"
JOIN "pg_catalog"."pg_class" AS "source"
  ON "source"."oid" = "pc"."conrelid"
JOIN "pg_catalog"."pg_class" AS "target"
  ON "target"."oid" = "pc"."confrelid"
JOIN "pg_catalog"."pg_namespace" AS "namespace"
  ON "namespace"."oid" = "source"."relnamespace"
WHERE "namespace"."nspname" = CURRENT_SCHEMA()
  AND "source"."relname" = 'idempotency_records'
  AND "pc"."conname" = 'idempotency_records_enrollment_id_fkey';

-- Expected: all listed checks are validated.
SELECT "conname", "convalidated"
FROM "pg_catalog"."pg_constraint"
WHERE "connamespace" = (
    SELECT "oid"
    FROM "pg_catalog"."pg_namespace"
    WHERE "nspname" = CURRENT_SCHEMA()
)
  AND "conname" IN (
      'certificate_templates_code_shape_check',
      'certificate_template_versions_version_check',
      'certificate_template_versions_locale_check',
      'certificate_template_versions_lifecycle_check',
      'certificate_template_versions_asset_pairs_check',
      'certificate_template_versions_renderable_shape_check',
      'certificates_number_shape_check',
      'certificates_verification_hash_check',
      'certificates_snapshot_shape_check',
      'certificates_lifecycle_shape_check',
      'certificate_artifacts_pdf_shape_check',
      'certificate_artifacts_storage_key_check',
      'certificate_disclosure_controls_shape_check',
      'step_up_challenges_hash_check',
      'step_up_challenges_attempt_check',
      'step_up_challenges_time_check',
      'step_up_challenges_binding_check',
      'step_up_proofs_hash_check',
      'step_up_proofs_time_check',
      'step_up_proofs_binding_check',
      'idempotency_records_result_shape_check'
  )
ORDER BY "conname";

-- Expected: every justified lookup/uniqueness index listed below is present.
SELECT "indexname"
FROM "pg_catalog"."pg_indexes"
WHERE "schemaname" = CURRENT_SCHEMA()
  AND "indexname" IN (
      'user_sessions_id_user_id_key',
      'eligibility_evaluations_id_enrollment_course_key',
      'certificate_templates_code_key',
      'certificate_template_versions_identity_key',
      'certificate_template_versions_active_key',
      'certificate_template_versions_lookup_idx',
      'certificate_template_versions_status_locale_idx',
      'certificates_certificate_number_key',
      'certificates_verification_token_hash_key',
      'certificates_enrollment_id_key',
      'certificates_eligibility_evaluation_id_key',
      'certificates_enrollment_course_key',
      'certificates_id_enrollment_id_key',
      'certificates_evaluation_enrollment_course_key',
      'certificates_enrollment_id_status_idx',
      'certificates_course_id_status_issued_at_idx',
      'certificates_template_version_id_idx',
      'certificates_issued_by_user_id_issued_at_idx',
      'certificates_revoked_by_user_id_revoked_at_idx',
      'certificate_artifacts_certificate_id_key',
      'certificate_artifacts_storage_key_key',
      'certificate_artifacts_checksum_idx',
      'certificate_artifacts_provider_finalized_at_idx',
      'certificate_artifacts_finalized_at_idx',
      'certificate_disclosure_controls_certificate_id_key',
      'certificate_disclosure_controls_suppressed_at_idx',
      'certificate_disclosure_controls_actor_suppressed_at_idx',
      'step_up_challenges_nonce_hash_key',
      'step_up_challenges_continuation_id_key',
      'step_up_challenges_proof_binding_key',
      'step_up_challenges_user_session_expires_at_idx',
      'step_up_challenges_target_action_idx',
      'step_up_challenges_expires_locked_at_idx',
      'step_up_proofs_challenge_id_key',
      'step_up_proofs_proof_hash_key',
      'step_up_proofs_challenge_binding_key',
      'step_up_proofs_user_session_active_idx',
      'step_up_proofs_expires_consumed_at_idx',
      'step_up_proofs_target_action_idx',
      'idempotency_records_resulting_certificate_id_idx'
  )
ORDER BY "indexname";

-- Expected: every Module 8.6B FK is RESTRICT on delete.
SELECT "conname", "confdeltype"
FROM "pg_catalog"."pg_constraint"
WHERE "connamespace" = (
    SELECT "oid"
    FROM "pg_catalog"."pg_namespace"
    WHERE "nspname" = CURRENT_SCHEMA()
)
  AND "contype" = 'f'
  AND (
      "conrelid" IN (
          'certificate_template_versions'::REGCLASS,
          'certificates'::REGCLASS,
          'certificate_artifacts'::REGCLASS,
          'certificate_disclosure_controls'::REGCLASS,
          'step_up_challenges'::REGCLASS,
          'step_up_proofs'::REGCLASS
      )
      OR "conname" IN (
          'idempotency_records_enrollment_id_fkey',
          'idempotency_records_resulting_certificate_id_fkey'
      )
  )
ORDER BY "conname";

-- Expected: immutable-history and single-use guards are installed.
SELECT DISTINCT "trigger_name", "event_object_table"
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
ORDER BY "event_object_table", "trigger_name";

-- Expected immediately after migration: all zero. The standard seed may later
-- add one certificate template identity and permissions only.
SELECT
    (SELECT COUNT(*) FROM "certificates") AS "certificate_count",
    (SELECT COUNT(*) FROM "certificate_artifacts") AS "artifact_count",
    (SELECT COUNT(*) FROM "certificate_disclosure_controls") AS "disclosure_count",
    (SELECT COUNT(*) FROM "certificate_template_versions") AS "template_version_count",
    (SELECT COUNT(*) FROM "step_up_challenges") AS "challenge_count",
    (SELECT COUNT(*) FROM "step_up_proofs") AS "proof_count",
    (
        SELECT COUNT(*)
        FROM "idempotency_records"
        WHERE "operation" IN ('ISSUE_CERTIFICATE', 'REVOKE_CERTIFICATE')
    ) AS "certificate_receipt_count";

-- Expected after the repeat-safe seed: both rows with the shown exact
-- resource/action identity. Before seed, zero rows is valid.
SELECT "code", "resource", "action"
FROM "permissions"
WHERE "code" IN (
    'certificates.download',
    'certificates.self_download'
)
ORDER BY "code";

-- Expected after the repeat-safe seed: one stable identity and zero versions.
-- A renderable v1 remains deferred until brand/font/renderer inputs are
-- approved; verification must never mistake an incomplete version for ACTIVE.
SELECT
    "certificate_templates"."code",
    "certificate_templates"."name",
    COUNT("certificate_template_versions"."id") AS "template_version_count",
    COUNT("certificate_template_versions"."id") FILTER (
        WHERE "certificate_template_versions"."status" = 'ACTIVE'
    ) AS "active_template_version_count"
FROM "certificate_templates"
LEFT JOIN "certificate_template_versions"
  ON "certificate_template_versions"."template_id" = "certificate_templates"."id"
WHERE "certificate_templates"."code" = 'STANDARD_COURSE_COMPLETION'
GROUP BY
    "certificate_templates"."code",
    "certificate_templates"."name";

-- Guarded manual rollback aid for Module 8.6B.
-- Prisma does not execute down migrations automatically. This aid is safe only
-- before Module 8.6C-8.6F runtime writes security or certificate evidence.

BEGIN;

DO $$
BEGIN
    IF TO_REGCLASS('certificates') IS NOT NULL
       AND EXISTS (SELECT 1 FROM "certificates") THEN
        RAISE EXCEPTION
            'Module 8.6B rollback refused: certificate lifecycle evidence exists';
    END IF;

    IF TO_REGCLASS('certificate_artifacts') IS NOT NULL
       AND EXISTS (SELECT 1 FROM "certificate_artifacts") THEN
        RAISE EXCEPTION
            'Module 8.6B rollback refused: certificate artifact evidence exists';
    END IF;

    IF TO_REGCLASS('certificate_disclosure_controls') IS NOT NULL
       AND EXISTS (SELECT 1 FROM "certificate_disclosure_controls") THEN
        RAISE EXCEPTION
            'Module 8.6B rollback refused: certificate disclosure evidence exists';
    END IF;

    IF TO_REGCLASS('certificate_template_versions') IS NOT NULL
       AND EXISTS (SELECT 1 FROM "certificate_template_versions") THEN
        RAISE EXCEPTION
            'Module 8.6B rollback refused: certificate template versions exist';
    END IF;

    IF TO_REGCLASS('step_up_proofs') IS NOT NULL
       AND EXISTS (SELECT 1 FROM "step_up_proofs") THEN
        RAISE EXCEPTION
            'Module 8.6B rollback refused: step-up proof history exists';
    END IF;

    IF TO_REGCLASS('step_up_challenges') IS NOT NULL
       AND EXISTS (SELECT 1 FROM "step_up_challenges") THEN
        RAISE EXCEPTION
            'Module 8.6B rollback refused: step-up challenge history exists';
    END IF;

    IF TO_REGCLASS('idempotency_records') IS NOT NULL
       AND EXISTS (
           SELECT 1
           FROM "idempotency_records"
           WHERE "operation"::TEXT IN ('ISSUE_CERTIFICATE', 'REVOKE_CERTIFICATE')
       ) THEN
        RAISE EXCEPTION
            'Module 8.6B rollback refused: certificate idempotency receipts exist';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM "information_schema"."columns"
        WHERE "table_schema" = CURRENT_SCHEMA()
          AND "table_name" = 'user_sessions'
          AND "column_name" = 'last_authenticated_at'
    ) AND EXISTS (
        SELECT 1
        FROM "user_sessions"
        WHERE "last_authenticated_at" IS NOT NULL
    ) THEN
        RAISE EXCEPTION
            'Module 8.6B rollback refused: recent-authentication evidence exists';
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS "idempotency_records_immutable_guard"
ON "idempotency_records";
DROP FUNCTION IF EXISTS "prevent_idempotency_receipt_update"();

ALTER TABLE "idempotency_records"
DROP CONSTRAINT IF EXISTS "idempotency_records_resulting_certificate_id_fkey";
DROP INDEX IF EXISTS "idempotency_records_resulting_certificate_id_idx";
ALTER TABLE "idempotency_records"
DROP CONSTRAINT IF EXISTS "idempotency_records_result_shape_check";
ALTER TABLE "idempotency_records"
DROP CONSTRAINT IF EXISTS "idempotency_records_enrollment_id_fkey";

DROP TABLE IF EXISTS "certificate_disclosure_controls";
DROP TABLE IF EXISTS "certificate_artifacts";
DROP TABLE IF EXISTS "step_up_proofs";
DROP TABLE IF EXISTS "step_up_challenges";
DROP TABLE IF EXISTS "certificates";
DROP TABLE IF EXISTS "certificate_template_versions";
DROP TABLE IF EXISTS "certificate_templates";

DROP FUNCTION IF EXISTS "protect_step_up_proof"();
DROP FUNCTION IF EXISTS "enforce_step_up_proof_challenge_state"();
DROP FUNCTION IF EXISTS "prevent_certificate_artifact_mutation"();
DROP FUNCTION IF EXISTS "protect_certificate_lifecycle"();
DROP FUNCTION IF EXISTS "protect_certificate_template_version"();
DROP FUNCTION IF EXISTS "protect_certificate_template_identity"();
DROP FUNCTION IF EXISTS "protect_step_up_challenge"();
DROP FUNCTION IF EXISTS "generate_certificate_number"();
DROP SEQUENCE IF EXISTS "certificate_number_global_seq";

ALTER TABLE "idempotency_records"
DROP COLUMN IF EXISTS "resulting_certificate_id",
DROP COLUMN IF EXISTS "resulting_certificate_version";

-- PostgreSQL enum labels cannot be dropped directly. Recreate the prior exact
-- Progress vocabulary only after the guard proves no certificate receipt uses
-- either Module 8.6B value.
ALTER TYPE "idempotency_operation"
RENAME TO "idempotency_operation_module_86b";

CREATE TYPE "idempotency_operation" AS ENUM (
    'COMPLETE_BLOCK',
    'REOPEN_BLOCK',
    'COMPLETE_LESSON',
    'REOPEN_LESSON',
    'RECORD_LAST_VISITED_LESSON'
);

ALTER TABLE "idempotency_records"
ALTER COLUMN "operation" TYPE "idempotency_operation"
USING "operation"::TEXT::"idempotency_operation";

DROP TYPE "idempotency_operation_module_86b";

ALTER TABLE "idempotency_records"
ADD CONSTRAINT "idempotency_records_result_versions_check" CHECK (
    (
        "operation" = 'RECORD_LAST_VISITED_LESSON'
        AND "resulting_completion_version" IS NULL
        AND "resulting_activity_version" IS NOT NULL
        AND "resulting_activity_version" >= 0
    )
    OR (
        "operation" <> 'RECORD_LAST_VISITED_LESSON'
        AND "resulting_completion_version" IS NOT NULL
        AND "resulting_completion_version" >= 0
        AND "resulting_activity_version" IS NULL
    )
);

ALTER TABLE "idempotency_records"
ADD CONSTRAINT "idempotency_records_enrollment_id_fkey"
FOREIGN KEY ("enrollment_id")
REFERENCES "enrollment_progress_roots" ("enrollment_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX IF EXISTS "eligibility_evaluations_id_enrollment_course_key";
DROP INDEX IF EXISTS "user_sessions_id_user_id_key";
ALTER TABLE "user_sessions"
DROP COLUMN IF EXISTS "last_authenticated_at";

DROP TYPE IF EXISTS "step_up_continuation";
DROP TYPE IF EXISTS "step_up_target_type";
DROP TYPE IF EXISTS "step_up_action";
DROP TYPE IF EXISTS "certificate_artifact_storage_provider";
DROP TYPE IF EXISTS "certificate_template_version_status";
DROP TYPE IF EXISTS "certificate_revocation_reason_code";
DROP TYPE IF EXISTS "certificate_lifecycle_status";

COMMIT;

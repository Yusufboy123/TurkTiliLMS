-- Manual rollback aid for Module 8.5B before Module 8.5C writes eligibility
-- evidence. Prisma does not execute down migrations automatically.
--
-- Once policy or evidence rows are referenced, use a reviewed forward fix or
-- approved evidence-preserving recovery plan instead.

BEGIN;

-- Refuse destructive rollback once immutable eligibility evidence exists.
-- Policy-only seed data is reproducible; evaluation rows are historical facts.
DO $$
BEGIN
    IF to_regclass('certificate_eligibility_evaluations') IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM "certificate_eligibility_evaluations") THEN
            RAISE EXCEPTION
                'Module 8.5B rollback refused: certificate eligibility evidence exists';
        END IF;
    END IF;
END;
$$;

DROP TABLE IF EXISTS "certificate_eligibility_reasons";
DROP TABLE IF EXISTS "certificate_eligibility_evaluations";
DROP TABLE IF EXISTS "certificate_eligibility_policies";

DROP FUNCTION IF EXISTS "enforce_certificate_eligibility_reason_state"();
DROP FUNCTION IF EXISTS "prevent_certificate_eligibility_mutation"();

DROP INDEX IF EXISTS "course_enrollments_id_course_id_key";

DROP TYPE IF EXISTS "certificate_eligibility_evaluator_type";
DROP TYPE IF EXISTS "certificate_eligibility_reason_code";
DROP TYPE IF EXISTS "certificate_eligibility_status";
DROP TYPE IF EXISTS "certificate_eligibility_assessment_rule";
DROP TYPE IF EXISTS "certificate_eligibility_policy_code";

COMMIT;

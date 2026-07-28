-- Module 8.5B is additive database foundation only. It creates typed,
-- immutable certificate-eligibility policy and evidence storage without
-- evaluating enrollments, fabricating historical evidence, or activating API
-- operations.

-- CreateEnum
CREATE TYPE "certificate_eligibility_policy_code" AS ENUM (
    'COURSE_COMPLETION_ONLY'
);

-- CreateEnum
CREATE TYPE "certificate_eligibility_assessment_rule" AS ENUM (
    'NONE'
);

-- NOT_COMPLETED is a derived response and is intentionally not persisted.
CREATE TYPE "certificate_eligibility_status" AS ENUM (
    'ELIGIBLE',
    'NOT_ELIGIBLE'
);

-- Fixed codes only; unrestricted reason metadata is prohibited.
CREATE TYPE "certificate_eligibility_reason_code" AS ENUM (
    'COURSE_NOT_COMPLETED',
    'ZERO_ELIGIBLE_LESSONS',
    'COMPLETION_EVIDENCE_UNAVAILABLE',
    'POLICY_REQUIREMENTS_NOT_MET'
);

CREATE TYPE "certificate_eligibility_evaluator_type" AS ENUM (
    'SYSTEM',
    'USER'
);

-- The composite key lets evidence retain the trusted enrollment-owned course
-- identifier without duplicating a second, independently mutable course link.
CREATE UNIQUE INDEX "course_enrollments_id_course_id_key"
ON "course_enrollments" ("id", "course_id");

-- CreateTable
CREATE TABLE "certificate_eligibility_policies" (
    "id" UUID NOT NULL,
    "code" "certificate_eligibility_policy_code" NOT NULL,
    "version" INTEGER NOT NULL,
    "assessment_rule" "certificate_eligibility_assessment_rule" NOT NULL DEFAULT 'NONE',
    "requires_attendance" BOOLEAN NOT NULL DEFAULT FALSE,
    "requires_manual_approval" BOOLEAN NOT NULL DEFAULT FALSE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificate_eligibility_policies_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "eligibility_policies_v1_shape_check" CHECK (
        "code" = 'COURSE_COMPLETION_ONLY'
        AND "version" = 1
        AND "assessment_rule" = 'NONE'
        AND "requires_attendance" = FALSE
        AND "requires_manual_approval" = FALSE
    )
);

-- CreateTable
CREATE TABLE "certificate_eligibility_evaluations" (
    "id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "policy_id" UUID NOT NULL,
    "status" "certificate_eligibility_status" NOT NULL,
    "evaluation_version" INTEGER NOT NULL,
    "evaluated_at" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3) NOT NULL,
    "completion_curriculum_version" INTEGER NOT NULL,
    "completion_version" INTEGER NOT NULL,
    "completed_lessons" INTEGER NOT NULL,
    "total_eligible_lessons" INTEGER NOT NULL,
    "course_percentage" INTEGER NOT NULL,
    "evaluator_type" "certificate_eligibility_evaluator_type" NOT NULL DEFAULT 'SYSTEM',
    "evaluated_by_user_id" UUID,
    "supersedes_evaluation_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificate_eligibility_evaluations_pkey" PRIMARY KEY ("id"),
    -- V1 persists only successful completion-only decisions. NOT_ELIGIBLE is
    -- reserved in the enum for a later approved typed policy migration.
    CONSTRAINT "eligibility_evaluations_v1_status_check" CHECK (
        "status" = 'ELIGIBLE'
    ),
    CONSTRAINT "eligibility_evaluations_versions_check" CHECK (
        "evaluation_version" > 0
        AND "completion_curriculum_version" > 0
        AND "completion_version" > 0
    ),
    CONSTRAINT "eligibility_evaluations_snapshot_check" CHECK (
        "completed_lessons" > 0
        AND "total_eligible_lessons" > 0
        AND "completed_lessons" = "total_eligible_lessons"
        AND "course_percentage" = 100
    ),
    CONSTRAINT "eligibility_evaluations_timestamps_check" CHECK (
        "evaluated_at" >= "completed_at"
        AND "created_at" >= "evaluated_at"
    ),
    CONSTRAINT "eligibility_evaluations_evaluator_check" CHECK (
        (
            "evaluator_type" = 'SYSTEM'
            AND "evaluated_by_user_id" IS NULL
        )
        OR (
            "evaluator_type" = 'USER'
            AND "evaluated_by_user_id" IS NOT NULL
        )
    ),
    CONSTRAINT "eligibility_evaluations_supersession_check" CHECK (
        "supersedes_evaluation_id" IS NULL
        OR "supersedes_evaluation_id" <> "id"
    )
);

-- CreateTable
CREATE TABLE "certificate_eligibility_reasons" (
    "evaluation_id" UUID NOT NULL,
    "code" "certificate_eligibility_reason_code" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificate_eligibility_reasons_pkey"
        PRIMARY KEY ("evaluation_id", "code")
);

-- CreateIndex
CREATE UNIQUE INDEX "certificate_eligibility_policies_code_version_key"
ON "certificate_eligibility_policies" ("code", "version");

CREATE UNIQUE INDEX "eligibility_evaluations_supersedes_id_key"
ON "certificate_eligibility_evaluations" ("supersedes_evaluation_id");

CREATE UNIQUE INDEX "eligibility_evaluations_enrollment_version_key"
ON "certificate_eligibility_evaluations" ("enrollment_id", "evaluation_version");

-- This is the final idempotency guard for one policy decision over one
-- canonical completion snapshot.
CREATE UNIQUE INDEX "eligibility_evaluations_snapshot_key"
ON "certificate_eligibility_evaluations" (
    "enrollment_id",
    "policy_id",
    "completion_version"
);

CREATE INDEX "eligibility_evaluations_course_status_at_idx"
ON "certificate_eligibility_evaluations" (
    "course_id",
    "status",
    "evaluated_at"
);

CREATE INDEX "eligibility_evaluations_enrollment_status_at_idx"
ON "certificate_eligibility_evaluations" (
    "enrollment_id",
    "status",
    "evaluated_at"
);

CREATE INDEX "eligibility_evaluations_policy_status_at_idx"
ON "certificate_eligibility_evaluations" (
    "policy_id",
    "status",
    "evaluated_at"
);

CREATE INDEX "eligibility_evaluations_evaluator_at_idx"
ON "certificate_eligibility_evaluations" (
    "evaluated_by_user_id",
    "evaluated_at"
);

CREATE INDEX "certificate_eligibility_reasons_code_evaluation_id_idx"
ON "certificate_eligibility_reasons" ("code", "evaluation_id");

-- AddForeignKey
ALTER TABLE "certificate_eligibility_evaluations"
ADD CONSTRAINT "eligibility_evaluations_enrollment_course_fkey"
FOREIGN KEY ("enrollment_id", "course_id")
REFERENCES "course_enrollments" ("id", "course_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "certificate_eligibility_evaluations"
ADD CONSTRAINT "eligibility_evaluations_progress_root_fkey"
FOREIGN KEY ("enrollment_id")
REFERENCES "enrollment_progress_roots" ("enrollment_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "certificate_eligibility_evaluations"
ADD CONSTRAINT "eligibility_evaluations_policy_id_fkey"
FOREIGN KEY ("policy_id")
REFERENCES "certificate_eligibility_policies" ("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "certificate_eligibility_evaluations"
ADD CONSTRAINT "eligibility_evaluations_evaluated_by_fkey"
FOREIGN KEY ("evaluated_by_user_id")
REFERENCES "users" ("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "certificate_eligibility_evaluations"
ADD CONSTRAINT "eligibility_evaluations_supersedes_fkey"
FOREIGN KEY ("supersedes_evaluation_id")
REFERENCES "certificate_eligibility_evaluations" ("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "certificate_eligibility_reasons"
ADD CONSTRAINT "eligibility_reasons_evaluation_id_fkey"
FOREIGN KEY ("evaluation_id")
REFERENCES "certificate_eligibility_evaluations" ("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Policy versions, evaluations, and reason rows are append-only evidence.
-- Supersession is represented on a new evaluation row rather than by updating
-- an existing decision.
CREATE FUNCTION "prevent_certificate_eligibility_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION '% is immutable; % is not permitted', TG_TABLE_NAME, TG_OP
        USING ERRCODE = '23514',
              CONSTRAINT = 'certificate_eligibility_immutable_record_check';
END;
$$;

CREATE TRIGGER "certificate_eligibility_policies_immutable"
BEFORE UPDATE OR DELETE ON "certificate_eligibility_policies"
FOR EACH ROW
EXECUTE FUNCTION "prevent_certificate_eligibility_mutation"();

CREATE TRIGGER "certificate_eligibility_evaluations_immutable"
BEFORE UPDATE OR DELETE ON "certificate_eligibility_evaluations"
FOR EACH ROW
EXECUTE FUNCTION "prevent_certificate_eligibility_mutation"();

CREATE TRIGGER "certificate_eligibility_reasons_immutable"
BEFORE UPDATE OR DELETE ON "certificate_eligibility_reasons"
FOR EACH ROW
EXECUTE FUNCTION "prevent_certificate_eligibility_mutation"();

-- ELIGIBLE decisions have no failure reasons in v1. This cross-table guard
-- keeps the normalized reason collection empty without unrestricted JSON.
CREATE FUNCTION "enforce_certificate_eligibility_reason_state"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "certificate_eligibility_evaluations"
        WHERE "id" = NEW."evaluation_id"
          AND "status" = 'ELIGIBLE'
    ) THEN
        RAISE EXCEPTION 'ELIGIBLE evidence cannot contain reason codes'
            USING ERRCODE = '23514',
                  CONSTRAINT = 'eligibility_reasons_eligible_state_check';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "certificate_eligibility_reasons_state_guard"
BEFORE INSERT ON "certificate_eligibility_reasons"
FOR EACH ROW
EXECUTE FUNCTION "enforce_certificate_eligibility_reason_state"();

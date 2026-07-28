-- Module 8.6B is an additive persistence foundation only. It creates no
-- certificate, artifact, step-up, proof, disclosure, or public-token data and
-- does not activate any Module 8.6 runtime operation.

-- Prisma Migrate does not wrap PostgreSQL migrations by default. The enum/FK
-- ownership transition and every additive object must therefore commit or
-- roll back as one unit.
BEGIN;

-- Extend the shared enrollment-scoped idempotency vocabulary without changing
-- any existing Progress operation. PostgreSQL cannot use an ALTER TYPE ADD
-- VALUE result in another statement of the same transaction. Replacing the
-- enum atomically preserves every existing label/value and avoids a partially
-- applied non-transactional migration.
ALTER TABLE "idempotency_records"
DROP CONSTRAINT "idempotency_records_result_versions_check";

CREATE TYPE "idempotency_operation_module_86b" AS ENUM (
    'COMPLETE_BLOCK',
    'REOPEN_BLOCK',
    'COMPLETE_LESSON',
    'REOPEN_LESSON',
    'RECORD_LAST_VISITED_LESSON',
    'ISSUE_CERTIFICATE',
    'REVOKE_CERTIFICATE'
);

ALTER TABLE "idempotency_records"
ALTER COLUMN "operation" TYPE "idempotency_operation_module_86b"
USING "operation"::TEXT::"idempotency_operation_module_86b";

DROP TYPE "idempotency_operation";

ALTER TYPE "idempotency_operation_module_86b"
RENAME TO "idempotency_operation";

CREATE TYPE "certificate_lifecycle_status" AS ENUM ('ISSUED', 'REVOKED');

CREATE TYPE "certificate_revocation_reason_code" AS ENUM (
    'FRAUD',
    'ADMINISTRATIVE_ERROR',
    'DUPLICATE_ISSUANCE',
    'POLICY_VIOLATION',
    'OTHER'
);

CREATE TYPE "certificate_template_version_status" AS ENUM (
    'DRAFT',
    'ACTIVE',
    'RETIRED'
);

CREATE TYPE "certificate_artifact_storage_provider" AS ENUM ('LOCAL');

CREATE TYPE "step_up_action" AS ENUM (
    'CERTIFICATE_ISSUE',
    'CERTIFICATE_REVOKE'
);

CREATE TYPE "step_up_target_type" AS ENUM ('ENROLLMENT', 'CERTIFICATE');

CREATE TYPE "step_up_continuation" AS ENUM (
    'CERTIFICATE_ISSUE_CONFIRMATION',
    'CERTIFICATE_REVOKE_CONFIRMATION'
);

-- PostgreSQL owns allocation. The sequence is global, gaps are accepted, and
-- values never cycle or exceed the approved ten-digit serial component.
CREATE SEQUENCE "certificate_number_global_seq"
    AS BIGINT
    MINVALUE 1
    MAXVALUE 9999999999
    START WITH 1
    INCREMENT BY 1
    NO CYCLE;

CREATE FUNCTION "generate_certificate_number"()
RETURNS TEXT
LANGUAGE SQL
VOLATILE
AS $$
    SELECT
        'TTL-'
        || TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY')
        || '-'
        || LPAD(NEXTVAL('certificate_number_global_seq')::TEXT, 10, '0');
$$;

-- Recent authentication is session-bound and nullable for every pre-8.6B
-- session. Refresh rotation and ordinary activity do not populate this field.
ALTER TABLE "user_sessions"
ADD COLUMN "last_authenticated_at" TIMESTAMPTZ(3);

CREATE UNIQUE INDEX "user_sessions_id_user_id_key"
ON "user_sessions" ("id", "user_id");

-- This composite identity lets a certificate prove that its exact eligibility
-- evaluation belongs to the same enrollment and course.
CREATE UNIQUE INDEX "eligibility_evaluations_id_enrollment_course_key"
ON "certificate_eligibility_evaluations" ("id", "enrollment_id", "course_id");

CREATE TABLE "certificate_templates" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "certificate_templates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "certificate_templates_code_shape_check" CHECK (
        "code" ~ '^[A-Z][A-Z0-9_]{2,99}$'
        AND BTRIM("name") <> ''
    )
);

CREATE TABLE "certificate_template_versions" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "locale" VARCHAR(35) NOT NULL,
    "status" "certificate_template_version_status" NOT NULL DEFAULT 'DRAFT',
    "renderer_contract_version" VARCHAR(64),
    "organization_display_name" VARCHAR(200),
    "organization_legal_name" VARCHAR(200),
    "logo_asset_id" VARCHAR(128),
    "logo_asset_checksum" CHAR(64),
    "seal_asset_id" VARCHAR(128),
    "seal_asset_checksum" CHAR(64),
    "signatory_name" VARCHAR(160),
    "signatory_title" VARCHAR(160),
    "signatory_asset_id" VARCHAR(128),
    "signatory_asset_checksum" CHAR(64),
    "font_asset_id" VARCHAR(128),
    "font_asset_checksum" CHAR(64),
    "font_family" VARCHAR(100),
    "font_version" VARCHAR(64),
    "font_license_identifier" VARCHAR(100),
    "font_license_provenance" VARCHAR(500),
    "activated_at" TIMESTAMPTZ(3),
    "retired_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "certificate_template_versions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "certificate_template_versions_version_check" CHECK (
        "version" > 0
    ),
    CONSTRAINT "certificate_template_versions_locale_check" CHECK (
        "locale" ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'
    ),
    CONSTRAINT "certificate_template_versions_lifecycle_check" CHECK (
        (
            "status" = 'DRAFT'
            AND "activated_at" IS NULL
            AND "retired_at" IS NULL
        )
        OR (
            "status" = 'ACTIVE'
            AND "activated_at" IS NOT NULL
            AND "activated_at" >= "created_at"
            AND "retired_at" IS NULL
        )
        OR (
            "status" = 'RETIRED'
            AND "activated_at" IS NOT NULL
            AND "activated_at" >= "created_at"
            AND "retired_at" IS NOT NULL
            AND "retired_at" >= "activated_at"
        )
    ),
    CONSTRAINT "certificate_template_versions_asset_pairs_check" CHECK (
        (
            ("logo_asset_id" IS NULL AND "logo_asset_checksum" IS NULL)
            OR (
                "logo_asset_id" IS NOT NULL
                AND "logo_asset_checksum" IS NOT NULL
                AND BTRIM("logo_asset_id") <> ''
                AND "logo_asset_checksum" ~ '^[0-9a-f]{64}$'
            )
        )
        AND (
            ("seal_asset_id" IS NULL AND "seal_asset_checksum" IS NULL)
            OR (
                "seal_asset_id" IS NOT NULL
                AND "seal_asset_checksum" IS NOT NULL
                AND BTRIM("seal_asset_id") <> ''
                AND "seal_asset_checksum" ~ '^[0-9a-f]{64}$'
            )
        )
        AND (
            (
                "signatory_asset_id" IS NULL
                AND "signatory_asset_checksum" IS NULL
            )
            OR (
                "signatory_asset_id" IS NOT NULL
                AND "signatory_asset_checksum" IS NOT NULL
                AND BTRIM("signatory_asset_id") <> ''
                AND "signatory_asset_checksum" ~ '^[0-9a-f]{64}$'
            )
        )
    ),
    -- DRAFT may be incomplete. ACTIVE and RETIRED versions must retain every
    -- deterministic renderer and font input needed for historical evidence.
    CONSTRAINT "certificate_template_versions_renderable_shape_check" CHECK (
        "status" = 'DRAFT'
        OR (
            "renderer_contract_version" IS NOT NULL
            AND "organization_display_name" IS NOT NULL
            AND "organization_legal_name" IS NOT NULL
            AND "font_asset_id" IS NOT NULL
            AND "font_asset_checksum" IS NOT NULL
            AND "font_family" IS NOT NULL
            AND "font_version" IS NOT NULL
            AND "font_license_identifier" IS NOT NULL
            AND "font_license_provenance" IS NOT NULL
            AND BTRIM("renderer_contract_version") <> ''
            AND BTRIM("organization_display_name") <> ''
            AND BTRIM("organization_legal_name") <> ''
            AND BTRIM("font_asset_id") <> ''
            AND "font_asset_checksum" ~ '^[0-9a-f]{64}$'
            AND BTRIM("font_family") <> ''
            AND BTRIM("font_version") <> ''
            AND BTRIM("font_license_identifier") <> ''
            AND BTRIM("font_license_provenance") <> ''
        )
    )
);

CREATE TABLE "certificates" (
    "id" UUID NOT NULL,
    "certificate_number" VARCHAR(19) NOT NULL DEFAULT "generate_certificate_number"(),
    "verification_token_hash" CHAR(64) NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "eligibility_evaluation_id" UUID NOT NULL,
    "template_version_id" UUID NOT NULL,
    "status" "certificate_lifecycle_status" NOT NULL DEFAULT 'ISSUED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "recipient_display_name" VARCHAR(160) NOT NULL,
    "course_title" VARCHAR(200) NOT NULL,
    "organization_name" VARCHAR(200) NOT NULL,
    "locale" VARCHAR(35) NOT NULL,
    "issue_date" DATE NOT NULL,
    "issued_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issued_by_user_id" UUID NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "revoked_by_user_id" UUID,
    "revocation_reason_code" "certificate_revocation_reason_code",
    "revocation_reason_note" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "certificates_number_shape_check" CHECK (
        "certificate_number" ~ '^TTL-[0-9]{4}-[0-9]{10}$'
    ),
    CONSTRAINT "certificates_verification_hash_check" CHECK (
        "verification_token_hash" ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT "certificates_snapshot_shape_check" CHECK (
        BTRIM("recipient_display_name") <> ''
        AND BTRIM("course_title") <> ''
        AND BTRIM("organization_name") <> ''
        AND "locale" ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'
        AND "issue_date" = ("issued_at" AT TIME ZONE 'UTC')::DATE
        AND "created_at" >= "issued_at"
    ),
    CONSTRAINT "certificates_lifecycle_shape_check" CHECK (
        (
            "status" = 'ISSUED'
            AND "version" = 1
            AND "revoked_at" IS NULL
            AND "revoked_by_user_id" IS NULL
            AND "revocation_reason_code" IS NULL
            AND "revocation_reason_note" IS NULL
        )
        OR (
            "status" = 'REVOKED'
            AND "version" = 2
            AND "revoked_at" IS NOT NULL
            AND "revoked_by_user_id" IS NOT NULL
            AND "revocation_reason_code" IS NOT NULL
            AND "revoked_at" >= "issued_at"
            AND (
                "revocation_reason_note" IS NULL
                OR CHAR_LENGTH(BTRIM("revocation_reason_note")) BETWEEN 10 AND 500
            )
        )
    )
);

CREATE TABLE "certificate_artifacts" (
    "id" UUID NOT NULL,
    "certificate_id" UUID NOT NULL,
    "storage_provider" "certificate_artifact_storage_provider" NOT NULL DEFAULT 'LOCAL',
    "storage_key" VARCHAR(512) NOT NULL,
    "mime_type" VARCHAR(64) NOT NULL DEFAULT 'application/pdf',
    "size_bytes" BIGINT NOT NULL,
    "checksum" CHAR(64) NOT NULL,
    "renderer_identifier" VARCHAR(100) NOT NULL,
    "renderer_version" VARCHAR(64) NOT NULL,
    "finalized_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificate_artifacts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "certificate_artifacts_pdf_shape_check" CHECK (
        "mime_type" = 'application/pdf'
        AND "size_bytes" BETWEEN 1 AND 10485760
        AND "checksum" ~ '^[0-9a-f]{64}$'
        AND BTRIM("renderer_identifier") <> ''
        AND BTRIM("renderer_version") <> ''
        AND "finalized_at" <= "created_at"
    ),
    CONSTRAINT "certificate_artifacts_storage_key_check" CHECK (
        "storage_key" LIKE 'certificates/%'
        AND "storage_key" NOT LIKE '/%'
        AND POSITION('\' IN "storage_key") = 0
        AND "storage_key" !~ '(^|/)\.\.(/|$)'
    )
);

CREATE TABLE "certificate_disclosure_controls" (
    "id" UUID NOT NULL,
    "certificate_id" UUID NOT NULL,
    "recipient_name_suppressed_at" TIMESTAMPTZ(3),
    "suppressed_by_user_id" UUID,
    "reason_code" VARCHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "certificate_disclosure_controls_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "certificate_disclosure_controls_shape_check" CHECK (
        (
            "recipient_name_suppressed_at" IS NULL
            AND "suppressed_by_user_id" IS NULL
            AND "reason_code" IS NULL
        )
        OR (
            "recipient_name_suppressed_at" IS NOT NULL
            AND "suppressed_by_user_id" IS NOT NULL
            AND "reason_code" IS NOT NULL
            AND "reason_code" ~ '^[A-Z][A-Z0-9_]{2,63}$'
            AND "updated_at" >= "recipient_name_suppressed_at"
        )
    )
);

CREATE TABLE "step_up_challenges" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "nonce_hash" CHAR(64) NOT NULL,
    "credential_epoch" TIMESTAMPTZ(3) NOT NULL,
    "action" "step_up_action" NOT NULL,
    "target_type" "step_up_target_type" NOT NULL,
    "target_id" UUID NOT NULL,
    "continuation" "step_up_continuation" NOT NULL,
    "continuation_id" UUID NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "verified_at" TIMESTAMPTZ(3),
    "locked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "step_up_challenges_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "step_up_challenges_hash_check" CHECK (
        "nonce_hash" ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT "step_up_challenges_attempt_check" CHECK (
        "attempt_count" BETWEEN 0 AND 5
        AND (
            "attempt_count" < 5
            OR "locked_at" IS NOT NULL
        )
    ),
    CONSTRAINT "step_up_challenges_time_check" CHECK (
        "credential_epoch" <= "created_at"
        AND "expires_at" > "created_at"
        AND "expires_at" <= "created_at" + INTERVAL '5 minutes'
        AND (
            "verified_at" IS NULL
            OR (
                "verified_at" >= "created_at"
                AND "verified_at" <= "expires_at"
            )
        )
        AND (
            "locked_at" IS NULL
            OR (
                "locked_at" >= "created_at"
                AND "locked_at" <= "expires_at"
            )
        )
        AND NOT ("verified_at" IS NOT NULL AND "locked_at" IS NOT NULL)
    ),
    CONSTRAINT "step_up_challenges_binding_check" CHECK (
        (
            "action" = 'CERTIFICATE_ISSUE'
            AND "target_type" = 'ENROLLMENT'
            AND "continuation" = 'CERTIFICATE_ISSUE_CONFIRMATION'
        )
        OR (
            "action" = 'CERTIFICATE_REVOKE'
            AND "target_type" = 'CERTIFICATE'
            AND "continuation" = 'CERTIFICATE_REVOKE_CONFIRMATION'
        )
    )
);

CREATE TABLE "step_up_proofs" (
    "id" UUID NOT NULL,
    "challenge_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "proof_hash" CHAR(64) NOT NULL,
    "credential_epoch" TIMESTAMPTZ(3) NOT NULL,
    "action" "step_up_action" NOT NULL,
    "target_type" "step_up_target_type" NOT NULL,
    "target_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "step_up_proofs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "step_up_proofs_hash_check" CHECK (
        "proof_hash" ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT "step_up_proofs_time_check" CHECK (
        "credential_epoch" <= "created_at"
        AND "expires_at" > "created_at"
        AND "expires_at" <= "created_at" + INTERVAL '2 minutes'
        AND (
            "consumed_at" IS NULL
            OR (
                "consumed_at" >= "created_at"
                AND "consumed_at" <= "expires_at"
            )
        )
    ),
    CONSTRAINT "step_up_proofs_binding_check" CHECK (
        (
            "action" = 'CERTIFICATE_ISSUE'
            AND "target_type" = 'ENROLLMENT'
        )
        OR (
            "action" = 'CERTIFICATE_REVOKE'
            AND "target_type" = 'CERTIFICATE'
        )
    )
);

CREATE UNIQUE INDEX "certificate_templates_code_key"
ON "certificate_templates" ("code");

CREATE UNIQUE INDEX "certificate_template_versions_identity_key"
ON "certificate_template_versions" ("template_id", "version", "locale");

CREATE UNIQUE INDEX "certificate_template_versions_active_key"
ON "certificate_template_versions" ("template_id", "locale")
WHERE "status" = 'ACTIVE';

CREATE INDEX "certificate_template_versions_lookup_idx"
ON "certificate_template_versions" ("template_id", "locale", "status");

CREATE INDEX "certificate_template_versions_status_locale_idx"
ON "certificate_template_versions" ("status", "locale");

CREATE UNIQUE INDEX "certificates_certificate_number_key"
ON "certificates" ("certificate_number");

CREATE UNIQUE INDEX "certificates_verification_token_hash_key"
ON "certificates" ("verification_token_hash");

CREATE UNIQUE INDEX "certificates_enrollment_id_key"
ON "certificates" ("enrollment_id");

CREATE UNIQUE INDEX "certificates_eligibility_evaluation_id_key"
ON "certificates" ("eligibility_evaluation_id");

CREATE UNIQUE INDEX "certificates_enrollment_course_key"
ON "certificates" ("enrollment_id", "course_id");

CREATE UNIQUE INDEX "certificates_id_enrollment_id_key"
ON "certificates" ("id", "enrollment_id");

CREATE UNIQUE INDEX "certificates_evaluation_enrollment_course_key"
ON "certificates" (
    "eligibility_evaluation_id",
    "enrollment_id",
    "course_id"
);

CREATE INDEX "certificates_enrollment_id_status_idx"
ON "certificates" ("enrollment_id", "status");

CREATE INDEX "certificates_course_id_status_issued_at_idx"
ON "certificates" ("course_id", "status", "issued_at");

CREATE INDEX "certificates_template_version_id_idx"
ON "certificates" ("template_version_id");

CREATE INDEX "certificates_issued_by_user_id_issued_at_idx"
ON "certificates" ("issued_by_user_id", "issued_at");

CREATE INDEX "certificates_revoked_by_user_id_revoked_at_idx"
ON "certificates" ("revoked_by_user_id", "revoked_at");

CREATE UNIQUE INDEX "certificate_artifacts_certificate_id_key"
ON "certificate_artifacts" ("certificate_id");

CREATE UNIQUE INDEX "certificate_artifacts_storage_key_key"
ON "certificate_artifacts" ("storage_key");

CREATE INDEX "certificate_artifacts_checksum_idx"
ON "certificate_artifacts" ("checksum");

CREATE INDEX "certificate_artifacts_provider_finalized_at_idx"
ON "certificate_artifacts" ("storage_provider", "finalized_at");

CREATE INDEX "certificate_artifacts_finalized_at_idx"
ON "certificate_artifacts" ("finalized_at");

CREATE UNIQUE INDEX "certificate_disclosure_controls_certificate_id_key"
ON "certificate_disclosure_controls" ("certificate_id");

CREATE INDEX "certificate_disclosure_controls_suppressed_at_idx"
ON "certificate_disclosure_controls" ("recipient_name_suppressed_at");

CREATE INDEX "certificate_disclosure_controls_actor_suppressed_at_idx"
ON "certificate_disclosure_controls" (
    "suppressed_by_user_id",
    "recipient_name_suppressed_at"
);

CREATE UNIQUE INDEX "step_up_challenges_nonce_hash_key"
ON "step_up_challenges" ("nonce_hash");

CREATE UNIQUE INDEX "step_up_challenges_continuation_id_key"
ON "step_up_challenges" ("continuation_id");

CREATE UNIQUE INDEX "step_up_challenges_proof_binding_key"
ON "step_up_challenges" (
    "id",
    "user_id",
    "session_id",
    "credential_epoch",
    "action",
    "target_type",
    "target_id"
);

CREATE INDEX "step_up_challenges_user_session_expires_at_idx"
ON "step_up_challenges" ("user_id", "session_id", "expires_at");

CREATE INDEX "step_up_challenges_target_action_idx"
ON "step_up_challenges" ("target_type", "target_id", "action");

CREATE INDEX "step_up_challenges_expires_locked_at_idx"
ON "step_up_challenges" ("expires_at", "locked_at");

CREATE UNIQUE INDEX "step_up_proofs_challenge_id_key"
ON "step_up_proofs" ("challenge_id");

CREATE UNIQUE INDEX "step_up_proofs_proof_hash_key"
ON "step_up_proofs" ("proof_hash");

CREATE UNIQUE INDEX "step_up_proofs_challenge_binding_key"
ON "step_up_proofs" (
    "challenge_id",
    "user_id",
    "session_id",
    "credential_epoch",
    "action",
    "target_type",
    "target_id"
);

CREATE INDEX "step_up_proofs_user_session_active_idx"
ON "step_up_proofs" (
    "user_id",
    "session_id",
    "expires_at",
    "consumed_at"
);

CREATE INDEX "step_up_proofs_expires_consumed_at_idx"
ON "step_up_proofs" ("expires_at", "consumed_at");

CREATE INDEX "step_up_proofs_target_action_idx"
ON "step_up_proofs" ("target_type", "target_id", "action");

ALTER TABLE "certificate_template_versions"
ADD CONSTRAINT "certificate_template_versions_template_id_fkey"
FOREIGN KEY ("template_id")
REFERENCES "certificate_templates" ("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "certificates"
ADD CONSTRAINT "certificates_enrollment_course_fkey"
FOREIGN KEY ("enrollment_id", "course_id")
REFERENCES "course_enrollments" ("id", "course_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "certificates"
ADD CONSTRAINT "certificates_evaluation_enrollment_course_fkey"
FOREIGN KEY ("eligibility_evaluation_id", "enrollment_id", "course_id")
REFERENCES "certificate_eligibility_evaluations" (
    "id",
    "enrollment_id",
    "course_id"
)
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "certificates"
ADD CONSTRAINT "certificates_template_version_id_fkey"
FOREIGN KEY ("template_version_id")
REFERENCES "certificate_template_versions" ("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "certificates"
ADD CONSTRAINT "certificates_issued_by_user_id_fkey"
FOREIGN KEY ("issued_by_user_id")
REFERENCES "users" ("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "certificates"
ADD CONSTRAINT "certificates_revoked_by_user_id_fkey"
FOREIGN KEY ("revoked_by_user_id")
REFERENCES "users" ("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "certificate_artifacts"
ADD CONSTRAINT "certificate_artifacts_certificate_id_fkey"
FOREIGN KEY ("certificate_id")
REFERENCES "certificates" ("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "certificate_disclosure_controls"
ADD CONSTRAINT "certificate_disclosure_controls_certificate_id_fkey"
FOREIGN KEY ("certificate_id")
REFERENCES "certificates" ("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "certificate_disclosure_controls"
ADD CONSTRAINT "certificate_disclosure_controls_suppressed_by_user_id_fkey"
FOREIGN KEY ("suppressed_by_user_id")
REFERENCES "users" ("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "step_up_challenges"
ADD CONSTRAINT "step_up_challenges_user_id_fkey"
FOREIGN KEY ("user_id")
REFERENCES "users" ("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "step_up_challenges"
ADD CONSTRAINT "step_up_challenges_session_user_fkey"
FOREIGN KEY ("session_id", "user_id")
REFERENCES "user_sessions" ("id", "user_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "step_up_proofs"
ADD CONSTRAINT "step_up_proofs_challenge_binding_fkey"
FOREIGN KEY (
    "challenge_id",
    "user_id",
    "session_id",
    "credential_epoch",
    "action",
    "target_type",
    "target_id"
)
REFERENCES "step_up_challenges" (
    "id",
    "user_id",
    "session_id",
    "credential_epoch",
    "action",
    "target_type",
    "target_id"
)
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "step_up_proofs"
ADD CONSTRAINT "step_up_proofs_user_id_fkey"
FOREIGN KEY ("user_id")
REFERENCES "users" ("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "step_up_proofs"
ADD CONSTRAINT "step_up_proofs_session_user_fkey"
FOREIGN KEY ("session_id", "user_id")
REFERENCES "user_sessions" ("id", "user_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Promote the existing table from Progress relational ownership to the shared
-- enrollment-scoped Operations boundary. Every current value remains valid
-- because each progress root already references its course enrollment.
ALTER TABLE "idempotency_records"
DROP CONSTRAINT "idempotency_records_enrollment_id_fkey";

ALTER TABLE "idempotency_records"
ADD COLUMN "resulting_certificate_id" UUID,
ADD COLUMN "resulting_certificate_version" INTEGER;

ALTER TABLE "idempotency_records"
ADD CONSTRAINT "idempotency_records_result_shape_check" CHECK (
    (
        "operation" = 'RECORD_LAST_VISITED_LESSON'
        AND "resulting_completion_version" IS NULL
        AND "resulting_activity_version" IS NOT NULL
        AND "resulting_activity_version" >= 0
        AND "resulting_certificate_id" IS NULL
        AND "resulting_certificate_version" IS NULL
    )
    OR (
        "operation" IN (
            'COMPLETE_BLOCK',
            'REOPEN_BLOCK',
            'COMPLETE_LESSON',
            'REOPEN_LESSON'
        )
        AND "resulting_completion_version" IS NOT NULL
        AND "resulting_completion_version" >= 0
        AND "resulting_activity_version" IS NULL
        AND "resulting_certificate_id" IS NULL
        AND "resulting_certificate_version" IS NULL
    )
    OR (
        "operation" = 'ISSUE_CERTIFICATE'
        AND "resulting_completion_version" IS NULL
        AND "resulting_activity_version" IS NULL
        AND "resulting_certificate_id" IS NOT NULL
        AND "resulting_certificate_version" = 1
    )
    OR (
        "operation" = 'REVOKE_CERTIFICATE'
        AND "resulting_completion_version" IS NULL
        AND "resulting_activity_version" IS NULL
        AND "resulting_certificate_id" IS NOT NULL
        AND "resulting_certificate_version" = 2
    )
);

ALTER TABLE "idempotency_records"
ADD CONSTRAINT "idempotency_records_enrollment_id_fkey"
FOREIGN KEY ("enrollment_id")
REFERENCES "course_enrollments" ("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "idempotency_records"
ADD CONSTRAINT "idempotency_records_resulting_certificate_id_fkey"
FOREIGN KEY ("resulting_certificate_id", "enrollment_id")
REFERENCES "certificates" ("id", "enrollment_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "idempotency_records_resulting_certificate_id_idx"
ON "idempotency_records" ("resulting_certificate_id");

-- Stable template code cannot be renamed or removed. Its administrative name
-- may be updated without changing versioned rendering evidence.
CREATE FUNCTION "protect_certificate_template_identity"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' OR NEW."code" IS DISTINCT FROM OLD."code" THEN
        RAISE EXCEPTION 'certificate template identity is immutable'
            USING ERRCODE = '23514',
                  CONSTRAINT = 'certificate_template_identity_immutable_check';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "certificate_templates_identity_guard"
BEFORE UPDATE OR DELETE ON "certificate_templates"
FOR EACH ROW
EXECUTE FUNCTION "protect_certificate_template_identity"();

CREATE FUNCTION "protect_certificate_template_version"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD."status" = 'DRAFT' THEN
            RETURN OLD;
        END IF;

        RAISE EXCEPTION 'active or retired certificate template versions are immutable'
            USING ERRCODE = '23514',
                  CONSTRAINT = 'certificate_template_version_immutable_check';
    END IF;

    IF OLD."status" = 'DRAFT' THEN
        IF NEW."status" IN ('DRAFT', 'ACTIVE') THEN
            RETURN NEW;
        END IF;

        RAISE EXCEPTION 'DRAFT template version may only remain DRAFT or become ACTIVE'
            USING ERRCODE = '23514',
                  CONSTRAINT = 'certificate_template_version_transition_check';
    END IF;

    IF (
        OLD."status" = 'ACTIVE'
        AND NEW."status" = 'RETIRED'
        AND (
            TO_JSONB(NEW) - ARRAY['status', 'retired_at', 'updated_at']
        ) = (
            TO_JSONB(OLD) - ARRAY['status', 'retired_at', 'updated_at']
        )
    ) THEN
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'active or retired certificate template versions are immutable'
        USING ERRCODE = '23514',
              CONSTRAINT = 'certificate_template_version_immutable_check';
END;
$$;

CREATE TRIGGER "certificate_template_versions_immutable_guard"
BEFORE UPDATE OR DELETE ON "certificate_template_versions"
FOR EACH ROW
EXECUTE FUNCTION "protect_certificate_template_version"();

CREATE FUNCTION "protect_certificate_lifecycle"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'certificate history cannot be deleted'
            USING ERRCODE = '23514',
                  CONSTRAINT = 'certificate_history_immutable_check';
    END IF;

    IF (
        OLD."status" = 'ISSUED'
        AND NEW."status" = 'REVOKED'
        AND NEW."version" = OLD."version" + 1
        AND (
            TO_JSONB(NEW) - ARRAY[
                'status',
                'version',
                'revoked_at',
                'revoked_by_user_id',
                'revocation_reason_code',
                'revocation_reason_note',
                'updated_at'
            ]
        ) = (
            TO_JSONB(OLD) - ARRAY[
                'status',
                'version',
                'revoked_at',
                'revoked_by_user_id',
                'revocation_reason_code',
                'revocation_reason_note',
                'updated_at'
            ]
        )
    ) THEN
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'certificate facts are immutable; only ISSUED to REVOKED is allowed'
        USING ERRCODE = '23514',
              CONSTRAINT = 'certificate_history_immutable_check';
END;
$$;

CREATE TRIGGER "certificates_lifecycle_guard"
BEFORE UPDATE OR DELETE ON "certificates"
FOR EACH ROW
EXECUTE FUNCTION "protect_certificate_lifecycle"();

CREATE FUNCTION "prevent_certificate_artifact_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'certificate artifact metadata is immutable'
        USING ERRCODE = '23514',
              CONSTRAINT = 'certificate_artifact_immutable_check';
END;
$$;

CREATE TRIGGER "certificate_artifacts_immutable_guard"
BEFORE UPDATE OR DELETE ON "certificate_artifacts"
FOR EACH ROW
EXECUTE FUNCTION "prevent_certificate_artifact_mutation"();

-- Challenge security bindings and time bounds are immutable. The failure count
-- may only advance, and verified/locked terminal states cannot be reopened.
CREATE FUNCTION "protect_step_up_challenge"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF (
        NEW."user_id",
        NEW."session_id",
        NEW."nonce_hash",
        NEW."credential_epoch",
        NEW."action",
        NEW."target_type",
        NEW."target_id",
        NEW."continuation",
        NEW."continuation_id",
        NEW."expires_at",
        NEW."created_at"
    ) IS DISTINCT FROM (
        OLD."user_id",
        OLD."session_id",
        OLD."nonce_hash",
        OLD."credential_epoch",
        OLD."action",
        OLD."target_type",
        OLD."target_id",
        OLD."continuation",
        OLD."continuation_id",
        OLD."expires_at",
        OLD."created_at"
    ) THEN
        RAISE EXCEPTION 'step-up challenge security bindings are immutable'
            USING ERRCODE = '23514',
                  CONSTRAINT = 'step_up_challenge_binding_immutable_check';
    END IF;

    IF OLD."verified_at" IS NOT NULL OR OLD."locked_at" IS NOT NULL THEN
        RAISE EXCEPTION 'verified or locked step-up challenge is immutable'
            USING ERRCODE = '23514',
                  CONSTRAINT = 'step_up_challenge_terminal_immutable_check';
    END IF;

    IF NEW."attempt_count" < OLD."attempt_count"
       OR NEW."attempt_count" > OLD."attempt_count" + 1 THEN
        RAISE EXCEPTION 'step-up challenge failure count must advance monotonically'
            USING ERRCODE = '23514',
                  CONSTRAINT = 'step_up_challenge_attempt_monotonic_check';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "step_up_challenges_lifecycle_guard"
BEFORE UPDATE ON "step_up_challenges"
FOR EACH ROW
EXECUTE FUNCTION "protect_step_up_challenge"();

-- Proof creation is allowed only from a verified, unlocked, unexpired
-- challenge. The composite FK already guarantees identical bindings.
CREATE FUNCTION "enforce_step_up_proof_challenge_state"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    "challenge_expires_at" TIMESTAMPTZ(3);
    "challenge_verified_at" TIMESTAMPTZ(3);
BEGIN
    SELECT "expires_at", "verified_at"
    INTO "challenge_expires_at", "challenge_verified_at"
    FROM "step_up_challenges"
    WHERE "id" = NEW."challenge_id"
      AND "verified_at" IS NOT NULL
      AND "locked_at" IS NULL
    FOR UPDATE;

    IF "challenge_expires_at" IS NULL
       OR "challenge_verified_at" IS NULL
       OR CLOCK_TIMESTAMP() >= "challenge_expires_at"
       OR CLOCK_TIMESTAMP() >= NEW."expires_at"
       OR NEW."created_at" > CLOCK_TIMESTAMP()
       OR NEW."created_at" < "challenge_verified_at"
       OR NEW."created_at" > "challenge_expires_at"
       OR NEW."expires_at" > "challenge_expires_at" THEN
        RAISE EXCEPTION 'step-up proof requires a current verified challenge'
            USING ERRCODE = '23514',
                  CONSTRAINT = 'step_up_proof_verified_challenge_check';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "step_up_proofs_challenge_state_guard"
BEFORE INSERT ON "step_up_proofs"
FOR EACH ROW
EXECUTE FUNCTION "enforce_step_up_proof_challenge_state"();

-- A proof may transition from unconsumed to consumed exactly once. Expired
-- records remain hard-deletable by a future reviewed cleanup job.
CREATE FUNCTION "protect_step_up_proof"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF (
        OLD."consumed_at" IS NULL
        AND NEW."consumed_at" IS NOT NULL
        AND CLOCK_TIMESTAMP() < OLD."expires_at"
        AND (
            TO_JSONB(NEW) - ARRAY['consumed_at']
        ) = (
            TO_JSONB(OLD) - ARRAY['consumed_at']
        )
    ) THEN
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'step-up proof is immutable and may be consumed only once'
        USING ERRCODE = '23514',
              CONSTRAINT = 'step_up_proof_single_use_check';
END;
$$;

CREATE TRIGGER "step_up_proofs_single_use_guard"
BEFORE UPDATE ON "step_up_proofs"
FOR EACH ROW
EXECUTE FUNCTION "protect_step_up_proof"();

-- Successful replay records are insert-once. Bounded retention cleanup may
-- still delete expired rows and ProgressEvent retains its nullable reference.
CREATE FUNCTION "prevent_idempotency_receipt_update"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'successful idempotency receipt is immutable'
        USING ERRCODE = '23514',
              CONSTRAINT = 'idempotency_receipt_immutable_check';
END;
$$;

CREATE TRIGGER "idempotency_records_immutable_guard"
BEFORE UPDATE ON "idempotency_records"
FOR EACH ROW
EXECUTE FUNCTION "prevent_idempotency_receipt_update"();

COMMIT;

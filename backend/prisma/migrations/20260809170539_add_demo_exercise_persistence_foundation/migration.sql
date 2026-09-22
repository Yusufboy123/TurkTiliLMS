-- CreateEnum
CREATE TYPE "demo_mapping_status" AS ENUM ('DRAFT', 'ENABLED', 'DISABLED');

-- CreateEnum
CREATE TYPE "exercise_aggregate_status" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "exercise_revision_status" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "exercise_type" AS ENUM ('LETTER_CHOICE', 'AUDIO_TO_LETTER', 'AUDIO_TO_WORD', 'MISSING_LETTER', 'MATCHING', 'WORD_ASSEMBLY', 'MULTIPLE_CHOICE', 'QUICK_ROUND');

-- CreateEnum
CREATE TYPE "exercise_delivery_variant" AS ENUM ('STANDARD', 'AUDIO_ENABLED', 'TEXT_ALTERNATIVE');

-- CreateEnum
CREATE TYPE "exercise_skill_tag" AS ENUM ('alphabet-recognition', 'special-letters', 'pronunciation', 'letter-case', 'word-recognition');

-- CreateEnum
CREATE TYPE "lesson_exercise_placement_status" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "exercise_media_role" AS ENUM ('PROMPT_AUDIO', 'TERMINAL_FEEDBACK_AUDIO', 'TEXT_ALTERNATIVE_MEDIA');

-- CreateEnum
CREATE TYPE "demo_attempt_status" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'ABANDONED', 'REVOKED');

-- CreateEnum
CREATE TYPE "demo_attempt_creation_kind" AS ENUM ('STANDARD', 'RETRY', 'RESET');

-- CreateEnum
CREATE TYPE "demo_retry_mode" AS ENUM ('ALL', 'INCORRECT_ONLY');

-- CreateEnum
CREATE TYPE "demo_audio_mode" AS ENUM ('AUDIO_ENABLED', 'TEXT_ALTERNATIVE');

-- CreateEnum
CREATE TYPE "demo_exercise_outcome" AS ENUM ('UNANSWERED', 'INCORRECT_RETRY_ALLOWED', 'CORRECT', 'INCORRECT_FINAL');

-- CreateEnum
CREATE TYPE "demo_sub_prompt_outcome" AS ENUM ('UNANSWERED', 'CORRECT', 'INCORRECT');

-- CreateEnum
CREATE TYPE "demo_idempotency_operation" AS ENUM ('CREATE_ATTEMPT', 'SUBMIT_ANSWER', 'CREATE_RETRY', 'RESET_ATTEMPT');

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "exercise_curriculum_revision" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "demo_lesson_mappings" (
    "id" UUID NOT NULL,
    "slug" CITEXT NOT NULL,
    "lesson_id" UUID NOT NULL,
    "status" "demo_mapping_status" NOT NULL DEFAULT 'DRAFT',
    "enabled_at" TIMESTAMPTZ(3),
    "disabled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "demo_lesson_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercises" (
    "id" UUID NOT NULL,
    "status" "exercise_aggregate_status" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_revisions" (
    "id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "type" "exercise_type" NOT NULL,
    "delivery_variant" "exercise_delivery_variant" NOT NULL DEFAULT 'STANDARD',
    "status" "exercise_revision_status" NOT NULL DEFAULT 'DRAFT',
    "public_definition" JSONB NOT NULL,
    "private_grading_definition" JSONB NOT NULL,
    "skill_tags" "exercise_skill_tag"[],
    "max_points" INTEGER NOT NULL,
    "max_submissions" INTEGER NOT NULL,
    "submitted_for_review_at" TIMESTAMPTZ(3),
    "published_at" TIMESTAMPTZ(3),
    "archived_at" TIMESTAMPTZ(3),
    "security_withdrawn_at" TIMESTAMPTZ(3),
    "security_withdrawal_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "exercise_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_revision_sub_prompts" (
    "id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "type" "exercise_type" NOT NULL,
    "skill_tag" "exercise_skill_tag" NOT NULL,
    "max_points" INTEGER NOT NULL,
    "public_definition" JSONB NOT NULL,
    "private_grading_definition" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercise_revision_sub_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_exercise_placements" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "primary_revision_id" UUID NOT NULL,
    "text_alternative_revision_id" UUID,
    "stage_key" VARCHAR(64) NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "lesson_exercise_placement_status" NOT NULL DEFAULT 'DRAFT',
    "activated_at" TIMESTAMPTZ(3),
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lesson_exercise_placements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_revision_media_usages" (
    "id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "sub_prompt_id" UUID,
    "media_file_id" UUID NOT NULL,
    "role" "exercise_media_role" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercise_revision_media_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demo_attempt_lineages" (
    "id" UUID NOT NULL,
    "last_terminal_at" TIMESTAMPTZ(3),
    "delete_by" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demo_attempt_lineages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demo_attempts" (
    "id" UUID NOT NULL,
    "demo_mapping_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "lineage_id" UUID NOT NULL,
    "source_attempt_id" UUID,
    "creation_kind" "demo_attempt_creation_kind" NOT NULL DEFAULT 'STANDARD',
    "retry_mode" "demo_retry_mode",
    "status" "demo_attempt_status" NOT NULL DEFAULT 'IN_PROGRESS',
    "version" INTEGER NOT NULL DEFAULT 1,
    "token_nonce" CHAR(43) NOT NULL,
    "token_key_version" SMALLINT NOT NULL,
    "token_digest" CHAR(64) NOT NULL,
    "requested_locale" VARCHAR(35) NOT NULL,
    "resolved_locale" VARCHAR(35) NOT NULL,
    "audio_mode" "demo_audio_mode" NOT NULL,
    "lesson_curriculum_revision" INTEGER NOT NULL,
    "last_accepted_mutation_at" TIMESTAMPTZ(3) NOT NULL,
    "idle_expires_at" TIMESTAMPTZ(3) NOT NULL,
    "absolute_expires_at" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "expired_at" TIMESTAMPTZ(3),
    "abandoned_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "evidence_delete_by" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "demo_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demo_attempt_snapshot_items" (
    "id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "placement_id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "source_revision_id" UUID NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "type" "exercise_type" NOT NULL,
    "delivery_variant" "exercise_delivery_variant" NOT NULL,
    "public_definition" JSONB NOT NULL,
    "private_grading_definition" JSONB NOT NULL,
    "skill_tags" "exercise_skill_tag"[],
    "max_points" INTEGER NOT NULL,
    "max_submissions" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demo_attempt_snapshot_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demo_attempt_snapshot_sub_prompts" (
    "id" UUID NOT NULL,
    "snapshot_item_id" UUID NOT NULL,
    "source_sub_prompt_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "type" "exercise_type" NOT NULL,
    "skill_tag" "exercise_skill_tag" NOT NULL,
    "max_points" INTEGER NOT NULL,
    "public_definition" JSONB NOT NULL,
    "private_grading_definition" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demo_attempt_snapshot_sub_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demo_attempt_snapshot_media_usages" (
    "id" UUID NOT NULL,
    "snapshot_item_id" UUID NOT NULL,
    "sub_prompt_id" UUID,
    "media_file_id" UUID NOT NULL,
    "role" "exercise_media_role" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demo_attempt_snapshot_media_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demo_attempt_exercise_states" (
    "id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "snapshot_item_id" UUID NOT NULL,
    "outcome" "demo_exercise_outcome" NOT NULL DEFAULT 'UNANSWERED',
    "submissions_used" INTEGER NOT NULL DEFAULT 0,
    "earned_points" INTEGER NOT NULL DEFAULT 0,
    "terminal_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "demo_attempt_exercise_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demo_attempt_sub_prompt_states" (
    "id" UUID NOT NULL,
    "exercise_state_id" UUID NOT NULL,
    "snapshot_sub_prompt_id" UUID NOT NULL,
    "outcome" "demo_sub_prompt_outcome" NOT NULL DEFAULT 'UNANSWERED',
    "earned_points" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "demo_attempt_sub_prompt_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demo_idempotency_records" (
    "id" UUID NOT NULL,
    "owner_attempt_id" UUID NOT NULL,
    "operation" "demo_idempotency_operation" NOT NULL,
    "scope_digest" CHAR(64) NOT NULL,
    "key" UUID NOT NULL,
    "request_fingerprint" CHAR(64) NOT NULL,
    "response_status" SMALLINT NOT NULL,
    "response_envelope" JSONB NOT NULL,
    "resulting_attempt_id" UUID,
    "reset_replay_token_digest" CHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "demo_idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "demo_lesson_mappings_slug_key" ON "demo_lesson_mappings"("slug");

-- CreateIndex
CREATE INDEX "demo_lesson_mappings_status_slug_idx" ON "demo_lesson_mappings"("status", "slug");

-- CreateIndex
CREATE INDEX "demo_lesson_mappings_lesson_id_status_idx" ON "demo_lesson_mappings"("lesson_id", "status");

-- CreateIndex
CREATE INDEX "exercises_status_created_at_idx" ON "exercises"("status", "created_at");

-- CreateIndex
CREATE INDEX "exercise_revisions_exercise_id_status_revision_number_idx" ON "exercise_revisions"("exercise_id", "status", "revision_number");

-- CreateIndex
CREATE INDEX "exercise_revisions_status_security_withdrawn_at_idx" ON "exercise_revisions"("status", "security_withdrawn_at");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_revisions_exercise_id_revision_number_key" ON "exercise_revisions"("exercise_id", "revision_number");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_revisions_id_exercise_id_key" ON "exercise_revisions"("id", "exercise_id");

-- CreateIndex
CREATE INDEX "exercise_revision_sub_prompts_revision_id_type_idx" ON "exercise_revision_sub_prompts"("revision_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_revision_sub_prompts_revision_id_position_key" ON "exercise_revision_sub_prompts"("revision_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_revision_sub_prompts_id_revision_id_key" ON "exercise_revision_sub_prompts"("id", "revision_id");

-- CreateIndex
CREATE INDEX "lesson_exercise_placements_lesson_status_stage_position_idx" ON "lesson_exercise_placements"("lesson_id", "status", "stage_key", "position");

-- CreateIndex
CREATE INDEX "lesson_exercise_placements_exercise_id_status_idx" ON "lesson_exercise_placements"("exercise_id", "status");

-- CreateIndex
CREATE INDEX "lesson_exercise_placements_primary_revision_id_idx" ON "lesson_exercise_placements"("primary_revision_id");

-- CreateIndex
CREATE INDEX "lesson_exercise_placements_text_alternative_revision_id_idx" ON "lesson_exercise_placements"("text_alternative_revision_id");

-- CreateIndex
CREATE INDEX "exercise_revision_media_usages_media_file_id_role_idx" ON "exercise_revision_media_usages"("media_file_id", "role");

-- CreateIndex
CREATE INDEX "exercise_revision_media_usages_revision_id_role_idx" ON "exercise_revision_media_usages"("revision_id", "role");

-- CreateIndex
CREATE INDEX "exercise_revision_media_usages_sub_prompt_id_idx" ON "exercise_revision_media_usages"("sub_prompt_id");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_revision_media_usages_context_key" ON "exercise_revision_media_usages"("revision_id", "sub_prompt_id", "media_file_id", "role");

-- CreateIndex
CREATE INDEX "demo_attempt_lineages_delete_by_idx" ON "demo_attempt_lineages"("delete_by");

-- CreateIndex
CREATE UNIQUE INDEX "demo_attempts_token_nonce_key" ON "demo_attempts"("token_nonce");

-- CreateIndex
CREATE UNIQUE INDEX "demo_attempts_token_digest_key" ON "demo_attempts"("token_digest");

-- CreateIndex
CREATE INDEX "demo_attempts_demo_mapping_id_status_idx" ON "demo_attempts"("demo_mapping_id", "status");

-- CreateIndex
CREATE INDEX "demo_attempts_lesson_id_status_idx" ON "demo_attempts"("lesson_id", "status");

-- CreateIndex
CREATE INDEX "demo_attempts_lineage_id_created_at_idx" ON "demo_attempts"("lineage_id", "created_at");

-- CreateIndex
CREATE INDEX "demo_attempts_source_attempt_id_idx" ON "demo_attempts"("source_attempt_id");

-- CreateIndex
CREATE INDEX "demo_attempts_active_expiry_idx" ON "demo_attempts"("status", "idle_expires_at", "absolute_expires_at");

-- CreateIndex
CREATE INDEX "demo_attempts_evidence_delete_by_idx" ON "demo_attempts"("evidence_delete_by");

-- CreateIndex
CREATE UNIQUE INDEX "demo_attempts_id_lineage_id_key" ON "demo_attempts"("id", "lineage_id");

-- CreateIndex
CREATE INDEX "demo_attempt_snapshot_items_attempt_id_source_revision_id_idx" ON "demo_attempt_snapshot_items"("attempt_id", "source_revision_id");

-- CreateIndex
CREATE INDEX "demo_attempt_snapshot_items_exercise_id_idx" ON "demo_attempt_snapshot_items"("exercise_id");

-- CreateIndex
CREATE UNIQUE INDEX "demo_attempt_snapshot_items_attempt_id_position_key" ON "demo_attempt_snapshot_items"("attempt_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "demo_attempt_snapshot_items_attempt_id_exercise_id_key" ON "demo_attempt_snapshot_items"("attempt_id", "exercise_id");

-- CreateIndex
CREATE UNIQUE INDEX "demo_attempt_snapshot_items_id_attempt_id_key" ON "demo_attempt_snapshot_items"("id", "attempt_id");

-- CreateIndex
CREATE INDEX "demo_snapshot_sub_prompts_snapshot_item_id_type_idx" ON "demo_attempt_snapshot_sub_prompts"("snapshot_item_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "demo_snapshot_sub_prompts_snapshot_item_id_position_key" ON "demo_attempt_snapshot_sub_prompts"("snapshot_item_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "demo_snapshot_sub_prompts_snapshot_item_id_source_id_key" ON "demo_attempt_snapshot_sub_prompts"("snapshot_item_id", "source_sub_prompt_id");

-- CreateIndex
CREATE INDEX "demo_snapshot_media_usages_media_file_id_role_idx" ON "demo_attempt_snapshot_media_usages"("media_file_id", "role");

-- CreateIndex
CREATE INDEX "demo_snapshot_media_usages_snapshot_item_id_role_idx" ON "demo_attempt_snapshot_media_usages"("snapshot_item_id", "role");

-- CreateIndex
CREATE INDEX "demo_snapshot_media_usages_sub_prompt_id_idx" ON "demo_attempt_snapshot_media_usages"("sub_prompt_id");

-- CreateIndex
CREATE UNIQUE INDEX "demo_snapshot_media_usages_context_key" ON "demo_attempt_snapshot_media_usages"("snapshot_item_id", "sub_prompt_id", "media_file_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "demo_attempt_exercise_states_snapshot_item_id_key" ON "demo_attempt_exercise_states"("snapshot_item_id");

-- CreateIndex
CREATE INDEX "demo_attempt_exercise_states_attempt_id_outcome_idx" ON "demo_attempt_exercise_states"("attempt_id", "outcome");

-- CreateIndex
CREATE UNIQUE INDEX "demo_attempt_exercise_states_item_attempt_key" ON "demo_attempt_exercise_states"("snapshot_item_id", "attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "demo_sub_prompt_states_snapshot_sub_prompt_id_key" ON "demo_attempt_sub_prompt_states"("snapshot_sub_prompt_id");

-- CreateIndex
CREATE INDEX "demo_sub_prompt_states_exercise_state_id_outcome_idx" ON "demo_attempt_sub_prompt_states"("exercise_state_id", "outcome");

-- CreateIndex
CREATE INDEX "demo_idempotency_records_owner_attempt_id_created_at_idx" ON "demo_idempotency_records"("owner_attempt_id", "created_at");

-- CreateIndex
CREATE INDEX "demo_idempotency_records_expires_at_idx" ON "demo_idempotency_records"("expires_at");

-- CreateIndex
CREATE INDEX "demo_idempotency_records_resulting_attempt_id_idx" ON "demo_idempotency_records"("resulting_attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "demo_idempotency_records_operation_scope_key_key" ON "demo_idempotency_records"("operation", "scope_digest", "key");

-- AddForeignKey
ALTER TABLE "demo_lesson_mappings" ADD CONSTRAINT "demo_lesson_mappings_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_revisions" ADD CONSTRAINT "exercise_revisions_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_revision_sub_prompts" ADD CONSTRAINT "exercise_revision_sub_prompts_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "exercise_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_exercise_placements" ADD CONSTRAINT "lesson_exercise_placements_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_exercise_placements" ADD CONSTRAINT "lesson_exercise_placements_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_exercise_placements" ADD CONSTRAINT "lesson_exercise_placements_primary_revision_id_exercise_id_fkey" FOREIGN KEY ("primary_revision_id", "exercise_id") REFERENCES "exercise_revisions"("id", "exercise_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_exercise_placements" ADD CONSTRAINT "lesson_exercise_placements_text_alternative_revision_id_ex_fkey" FOREIGN KEY ("text_alternative_revision_id", "exercise_id") REFERENCES "exercise_revisions"("id", "exercise_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_revision_media_usages" ADD CONSTRAINT "exercise_revision_media_usages_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "exercise_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_revision_media_usages" ADD CONSTRAINT "exercise_revision_media_usages_sub_prompt_id_fkey" FOREIGN KEY ("sub_prompt_id") REFERENCES "exercise_revision_sub_prompts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_revision_media_usages" ADD CONSTRAINT "exercise_revision_media_usages_media_file_id_fkey" FOREIGN KEY ("media_file_id") REFERENCES "media_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_attempts" ADD CONSTRAINT "demo_attempts_demo_mapping_id_fkey" FOREIGN KEY ("demo_mapping_id") REFERENCES "demo_lesson_mappings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_attempts" ADD CONSTRAINT "demo_attempts_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_attempts" ADD CONSTRAINT "demo_attempts_lineage_id_fkey" FOREIGN KEY ("lineage_id") REFERENCES "demo_attempt_lineages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_attempts" ADD CONSTRAINT "demo_attempts_source_attempt_id_fkey" FOREIGN KEY ("source_attempt_id") REFERENCES "demo_attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_attempt_snapshot_items" ADD CONSTRAINT "demo_attempt_snapshot_items_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "demo_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_attempt_snapshot_items" ADD CONSTRAINT "demo_attempt_snapshot_items_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_attempt_snapshot_items" ADD CONSTRAINT "demo_attempt_snapshot_items_source_revision_id_exercise_id_fkey" FOREIGN KEY ("source_revision_id", "exercise_id") REFERENCES "exercise_revisions"("id", "exercise_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_attempt_snapshot_sub_prompts" ADD CONSTRAINT "demo_attempt_snapshot_sub_prompts_snapshot_item_id_fkey" FOREIGN KEY ("snapshot_item_id") REFERENCES "demo_attempt_snapshot_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_attempt_snapshot_media_usages" ADD CONSTRAINT "demo_attempt_snapshot_media_usages_snapshot_item_id_fkey" FOREIGN KEY ("snapshot_item_id") REFERENCES "demo_attempt_snapshot_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_attempt_snapshot_media_usages" ADD CONSTRAINT "demo_attempt_snapshot_media_usages_sub_prompt_id_fkey" FOREIGN KEY ("sub_prompt_id") REFERENCES "demo_attempt_snapshot_sub_prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_attempt_snapshot_media_usages" ADD CONSTRAINT "demo_attempt_snapshot_media_usages_media_file_id_fkey" FOREIGN KEY ("media_file_id") REFERENCES "media_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_attempt_exercise_states" ADD CONSTRAINT "demo_attempt_exercise_states_snapshot_item_id_attempt_id_fkey" FOREIGN KEY ("snapshot_item_id", "attempt_id") REFERENCES "demo_attempt_snapshot_items"("id", "attempt_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_attempt_sub_prompt_states" ADD CONSTRAINT "demo_attempt_sub_prompt_states_exercise_state_id_fkey" FOREIGN KEY ("exercise_state_id") REFERENCES "demo_attempt_exercise_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_attempt_sub_prompt_states" ADD CONSTRAINT "demo_attempt_sub_prompt_states_snapshot_sub_prompt_id_fkey" FOREIGN KEY ("snapshot_sub_prompt_id") REFERENCES "demo_attempt_snapshot_sub_prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_idempotency_records" ADD CONSTRAINT "demo_idempotency_records_owner_attempt_id_fkey" FOREIGN KEY ("owner_attempt_id") REFERENCES "demo_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_idempotency_records" ADD CONSTRAINT "demo_idempotency_records_resulting_attempt_id_fkey" FOREIGN KEY ("resulting_attempt_id") REFERENCES "demo_attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Prisma cannot express the partial uniqueness, cross-row lifecycle validation,
-- or immutable-history guards required by the approved contract. The following
-- database protections are deliberately local to the demo exercise aggregate.

CREATE FUNCTION "array_values_are_unique"(values_array ANYARRAY)
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT cardinality(values_array) = (
    SELECT COUNT(DISTINCT value)
    FROM unnest(values_array) AS value
  );
$$;

CREATE FUNCTION "jsonb_contains_demo_secret_key"(document JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  object_key TEXT;
  child JSONB;
BEGIN
  IF jsonb_typeof(document) = 'object' THEN
    FOR object_key, child IN SELECT key, value FROM jsonb_each(document)
    LOOP
      IF lower(object_key) = ANY (ARRAY[
        'correctanswer', 'correctanswers', 'correctchoiceid', 'correctpair',
        'correctpairs', 'correctorder', 'correctness', 'gradingdefinition',
        'privategradingdefinition', 'weight',
        'normalizationrules', 'randomizationseed', 'acceptedalternatives',
        'answerkey', 'attempttoken', 'tokendigest', 'tokennonce', 'storagepath'
      ]) THEN
        RETURN TRUE;
      END IF;
      IF "jsonb_contains_demo_secret_key"(child) THEN
        RETURN TRUE;
      END IF;
    END LOOP;
  ELSIF jsonb_typeof(document) = 'array' THEN
    FOR child IN SELECT value FROM jsonb_array_elements(document)
    LOOP
      IF "jsonb_contains_demo_secret_key"(child) THEN
        RETURN TRUE;
      END IF;
    END LOOP;
  END IF;
  RETURN FALSE;
END;
$$;

CREATE FUNCTION "jsonb_contains_external_media_key"(document JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  object_key TEXT;
  child JSONB;
BEGIN
  IF jsonb_typeof(document) = 'object' THEN
    FOR object_key, child IN SELECT key, value FROM jsonb_each(document)
    LOOP
      IF lower(object_key) = ANY (ARRAY[
        'url', 'fileurl', 'sourceurl', 'externalurl', 'providerurl',
        'storagepath', 'storagekey', 'providerkey'
      ]) THEN
        RETURN TRUE;
      END IF;
      IF "jsonb_contains_external_media_key"(child) THEN
        RETURN TRUE;
      END IF;
    END LOOP;
  ELSIF jsonb_typeof(document) = 'array' THEN
    FOR child IN SELECT value FROM jsonb_array_elements(document)
    LOOP
      IF "jsonb_contains_external_media_key"(child) THEN
        RETURN TRUE;
      END IF;
    END LOOP;
  END IF;
  RETURN FALSE;
END;
$$;

ALTER TABLE "lessons"
ADD CONSTRAINT "lessons_exercise_curriculum_revision_positive_check"
CHECK ("exercise_curriculum_revision" > 0);

ALTER TABLE "demo_lesson_mappings"
ADD CONSTRAINT "demo_lesson_mappings_slug_shape_check"
CHECK (
  "slug"::TEXT = lower("slug"::TEXT)
  AND "slug"::TEXT ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  AND length("slug"::TEXT) <= 180
),
ADD CONSTRAINT "demo_lesson_mappings_lifecycle_check"
CHECK (
  ("status" = 'DRAFT' AND "enabled_at" IS NULL AND "disabled_at" IS NULL)
  OR ("status" = 'ENABLED' AND "enabled_at" IS NOT NULL AND "disabled_at" IS NULL)
  OR ("status" = 'DISABLED' AND "enabled_at" IS NOT NULL AND "disabled_at" IS NOT NULL
      AND "disabled_at" >= "enabled_at")
);

CREATE UNIQUE INDEX "demo_lesson_mappings_enabled_lesson_key"
ON "demo_lesson_mappings" ("lesson_id")
WHERE "status" = 'ENABLED';

ALTER TABLE "exercises"
ADD CONSTRAINT "exercises_lifecycle_check"
CHECK (
  ("status" = 'ACTIVE' AND "archived_at" IS NULL)
  OR ("status" = 'ARCHIVED' AND "archived_at" IS NOT NULL)
);

ALTER TABLE "exercise_revisions"
ADD CONSTRAINT "exercise_revisions_revision_number_positive_check"
CHECK ("revision_number" > 0),
ADD CONSTRAINT "exercise_revisions_definition_shape_check"
CHECK (
  jsonb_typeof("public_definition") = 'object'
  AND jsonb_typeof("private_grading_definition") = 'object'
  AND "public_definition" ->> 'type' = "type"::TEXT
  AND "private_grading_definition" ->> 'type' = "type"::TEXT
  AND NOT "jsonb_contains_demo_secret_key"("public_definition")
  AND NOT "jsonb_contains_external_media_key"("public_definition")
  AND NOT "jsonb_contains_external_media_key"("private_grading_definition")
),
ADD CONSTRAINT "exercise_revisions_scoring_check"
CHECK (
  "max_points" BETWEEN 1 AND 100
  AND cardinality("skill_tags") BETWEEN 1 AND 4
  AND "array_values_are_unique"("skill_tags")
  AND (
    ("type" = 'QUICK_ROUND' AND "max_submissions" = 1)
    OR ("type" <> 'QUICK_ROUND' AND "max_submissions" = 2)
  )
),
ADD CONSTRAINT "exercise_revisions_variant_check"
CHECK (
  ("type" IN ('AUDIO_TO_LETTER', 'AUDIO_TO_WORD')
    AND "delivery_variant" IN ('AUDIO_ENABLED', 'TEXT_ALTERNATIVE'))
  OR ("type" NOT IN ('AUDIO_TO_LETTER', 'AUDIO_TO_WORD')
    AND "delivery_variant" = 'STANDARD')
),
ADD CONSTRAINT "exercise_revisions_lifecycle_check"
CHECK (
  ("status" = 'DRAFT' AND "submitted_for_review_at" IS NULL
    AND "published_at" IS NULL AND "archived_at" IS NULL)
  OR ("status" = 'IN_REVIEW' AND "submitted_for_review_at" IS NOT NULL
    AND "published_at" IS NULL AND "archived_at" IS NULL)
  OR ("status" = 'PUBLISHED' AND "submitted_for_review_at" IS NOT NULL
    AND "published_at" IS NOT NULL AND "archived_at" IS NULL)
  OR ("status" = 'ARCHIVED' AND "submitted_for_review_at" IS NOT NULL
    AND "published_at" IS NOT NULL AND "archived_at" IS NOT NULL)
),
ADD CONSTRAINT "exercise_revisions_security_withdrawal_check"
CHECK (
  ("security_withdrawn_at" IS NULL AND "security_withdrawal_reason" IS NULL)
  OR ("security_withdrawn_at" IS NOT NULL
    AND length(btrim("security_withdrawal_reason")) BETWEEN 1 AND 500)
);

ALTER TABLE "exercise_revision_sub_prompts"
ADD CONSTRAINT "exercise_revision_sub_prompts_shape_check"
CHECK (
  "position" > 0
  AND "max_points" > 0
  AND "type" IN (
    'LETTER_CHOICE', 'AUDIO_TO_LETTER', 'AUDIO_TO_WORD',
    'MISSING_LETTER', 'MULTIPLE_CHOICE'
  )
  AND jsonb_typeof("public_definition") = 'object'
  AND jsonb_typeof("private_grading_definition") = 'object'
  AND "public_definition" ->> 'kind' = "type"::TEXT
  AND "private_grading_definition" ->> 'kind' = "type"::TEXT
  AND NOT "jsonb_contains_demo_secret_key"("public_definition")
  AND NOT "jsonb_contains_external_media_key"("public_definition")
  AND NOT "jsonb_contains_external_media_key"("private_grading_definition")
);

ALTER TABLE "lesson_exercise_placements"
ADD CONSTRAINT "lesson_exercise_placements_shape_check"
CHECK (
  "stage_key" ~ '^[a-z][a-z0-9-]{0,63}$'
  AND "position" > 0
  AND "primary_revision_id" IS DISTINCT FROM "text_alternative_revision_id"
),
ADD CONSTRAINT "lesson_exercise_placements_lifecycle_check"
CHECK (
  ("status" = 'DRAFT' AND "activated_at" IS NULL AND "archived_at" IS NULL)
  OR ("status" = 'ACTIVE' AND "activated_at" IS NOT NULL AND "archived_at" IS NULL)
  OR ("status" = 'ARCHIVED' AND "activated_at" IS NOT NULL
    AND "archived_at" IS NOT NULL AND "archived_at" >= "activated_at")
);

CREATE UNIQUE INDEX "lesson_exercise_placements_active_stage_position_key"
ON "lesson_exercise_placements" ("lesson_id", "stage_key", "position")
WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX "lesson_exercise_placements_active_exercise_key"
ON "lesson_exercise_placements" ("lesson_id", "exercise_id")
WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX "exercise_revision_media_usages_root_context_key"
ON "exercise_revision_media_usages" ("revision_id", "media_file_id", "role")
WHERE "sub_prompt_id" IS NULL;

ALTER TABLE "demo_attempt_lineages"
ADD CONSTRAINT "demo_attempt_lineages_retention_check"
CHECK (
  ("last_terminal_at" IS NULL AND "delete_by" IS NULL)
  OR ("last_terminal_at" IS NOT NULL AND "delete_by" >= "last_terminal_at"
    AND "delete_by" <= "last_terminal_at" + INTERVAL '24 hours')
);

ALTER TABLE "demo_attempts"
ADD CONSTRAINT "demo_attempts_capability_shape_check"
CHECK (
  "token_nonce" ~ '^[A-Za-z0-9_-]{43}$'
  AND "token_key_version" > 0
  AND "token_digest" ~ '^[0-9a-f]{64}$'
),
ADD CONSTRAINT "demo_attempts_version_locale_check"
CHECK (
  "version" > 0 AND "lesson_curriculum_revision" > 0
  AND "requested_locale" ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'
  AND "resolved_locale" ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'
),
ADD CONSTRAINT "demo_attempts_expiry_check"
CHECK (
  "absolute_expires_at" = "created_at" + INTERVAL '2 hours'
  AND "last_accepted_mutation_at" >= "created_at"
  AND "last_accepted_mutation_at" <= "absolute_expires_at"
  AND "idle_expires_at" = LEAST(
    "last_accepted_mutation_at" + INTERVAL '30 minutes',
    "absolute_expires_at"
  )
),
ADD CONSTRAINT "demo_attempts_lineage_shape_check"
CHECK (
  ("creation_kind" = 'STANDARD' AND "source_attempt_id" IS NULL AND "retry_mode" IS NULL)
  OR ("creation_kind" = 'RETRY' AND "source_attempt_id" IS NOT NULL AND "retry_mode" IS NOT NULL)
  OR ("creation_kind" = 'RESET' AND "source_attempt_id" IS NOT NULL AND "retry_mode" IS NULL)
),
ADD CONSTRAINT "demo_attempts_lifecycle_check"
CHECK (
  ("status" = 'IN_PROGRESS' AND "completed_at" IS NULL AND "expired_at" IS NULL
    AND "abandoned_at" IS NULL AND "revoked_at" IS NULL AND "evidence_delete_by" IS NULL)
  OR ("status" = 'COMPLETED' AND "completed_at" IS NOT NULL AND "expired_at" IS NULL
    AND "abandoned_at" IS NULL AND "revoked_at" IS NULL AND "evidence_delete_by" IS NOT NULL)
  OR ("status" = 'EXPIRED' AND "expired_at" = LEAST("idle_expires_at", "absolute_expires_at")
    AND "abandoned_at" IS NULL AND "revoked_at" IS NULL AND "evidence_delete_by" IS NOT NULL)
  OR ("status" = 'ABANDONED' AND "completed_at" IS NULL AND "expired_at" IS NULL
    AND "abandoned_at" IS NOT NULL AND "revoked_at" IS NULL AND "evidence_delete_by" IS NOT NULL)
  OR ("status" = 'REVOKED' AND "expired_at" IS NULL AND "abandoned_at" IS NULL
    AND "revoked_at" IS NOT NULL AND "evidence_delete_by" IS NOT NULL)
),
ADD CONSTRAINT "demo_attempts_retention_check"
CHECK (
  "evidence_delete_by" IS NULL
  OR (
    "evidence_delete_by" >= COALESCE("completed_at", "expired_at", "abandoned_at", "revoked_at")
    AND "evidence_delete_by" <= LEAST(
      COALESCE("completed_at", 'infinity'::TIMESTAMPTZ),
      COALESCE("expired_at", 'infinity'::TIMESTAMPTZ),
      COALESCE("abandoned_at", 'infinity'::TIMESTAMPTZ),
      COALESCE("revoked_at", 'infinity'::TIMESTAMPTZ)
    ) + INTERVAL '24 hours'
  )
);

ALTER TABLE "demo_attempt_snapshot_items"
ADD CONSTRAINT "demo_attempt_snapshot_items_shape_check"
CHECK (
  "revision_number" > 0 AND "position" > 0
  AND "max_points" BETWEEN 1 AND 100
  AND "max_submissions" IN (1, 2)
  AND cardinality("skill_tags") BETWEEN 1 AND 4
  AND "array_values_are_unique"("skill_tags")
  AND jsonb_typeof("public_definition") = 'object'
  AND jsonb_typeof("private_grading_definition") = 'object'
  AND "public_definition" ->> 'type' = "type"::TEXT
  AND "private_grading_definition" ->> 'type' = "type"::TEXT
  AND NOT "jsonb_contains_demo_secret_key"("public_definition")
  AND NOT "jsonb_contains_external_media_key"("public_definition")
  AND NOT "jsonb_contains_external_media_key"("private_grading_definition")
);

ALTER TABLE "demo_attempt_snapshot_sub_prompts"
ADD CONSTRAINT "demo_attempt_snapshot_sub_prompts_shape_check"
CHECK (
  "position" > 0 AND "max_points" > 0
  AND "type" IN (
    'LETTER_CHOICE', 'AUDIO_TO_LETTER', 'AUDIO_TO_WORD',
    'MISSING_LETTER', 'MULTIPLE_CHOICE'
  )
  AND jsonb_typeof("public_definition") = 'object'
  AND jsonb_typeof("private_grading_definition") = 'object'
  AND "public_definition" ->> 'kind' = "type"::TEXT
  AND "private_grading_definition" ->> 'kind' = "type"::TEXT
  AND NOT "jsonb_contains_demo_secret_key"("public_definition")
  AND NOT "jsonb_contains_external_media_key"("public_definition")
  AND NOT "jsonb_contains_external_media_key"("private_grading_definition")
);

CREATE UNIQUE INDEX "demo_snapshot_media_usages_root_context_key"
ON "demo_attempt_snapshot_media_usages" ("snapshot_item_id", "media_file_id", "role")
WHERE "sub_prompt_id" IS NULL;

ALTER TABLE "demo_attempt_exercise_states"
ADD CONSTRAINT "demo_attempt_exercise_states_shape_check"
CHECK (
  "submissions_used" BETWEEN 0 AND 2 AND "earned_points" >= 0
  AND (
    ("outcome" = 'UNANSWERED' AND "terminal_at" IS NULL)
    OR ("outcome" = 'INCORRECT_RETRY_ALLOWED' AND "submissions_used" = 1 AND "terminal_at" IS NULL)
    OR ("outcome" IN ('CORRECT', 'INCORRECT_FINAL') AND "submissions_used" > 0
      AND "terminal_at" IS NOT NULL)
  )
);

ALTER TABLE "demo_attempt_sub_prompt_states"
ADD CONSTRAINT "demo_attempt_sub_prompt_states_shape_check"
CHECK (
  "earned_points" >= 0
  AND (("outcome" = 'UNANSWERED' AND "earned_points" = 0)
    OR "outcome" IN ('CORRECT', 'INCORRECT'))
);

ALTER TABLE "demo_idempotency_records"
ADD CONSTRAINT "demo_idempotency_records_digest_check"
CHECK (
  "scope_digest" ~ '^[0-9a-f]{64}$'
  AND "request_fingerprint" ~ '^[0-9a-f]{64}$'
  AND ("reset_replay_token_digest" IS NULL
    OR "reset_replay_token_digest" ~ '^[0-9a-f]{64}$')
),
ADD CONSTRAINT "demo_idempotency_records_key_check"
CHECK ("key"::TEXT ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
ADD CONSTRAINT "demo_idempotency_records_response_check"
CHECK (
  "response_status" BETWEEN 200 AND 299
  AND jsonb_typeof("response_envelope") = 'object'
  AND NOT "jsonb_contains_demo_secret_key"("response_envelope")
),
ADD CONSTRAINT "demo_idempotency_records_reset_replay_check"
CHECK (
  ("operation" = 'RESET_ATTEMPT' AND "reset_replay_token_digest" IS NOT NULL)
  OR ("operation" <> 'RESET_ATTEMPT' AND "reset_replay_token_digest" IS NULL)
),
ADD CONSTRAINT "demo_idempotency_records_expiry_check"
CHECK ("expires_at" = "created_at" + INTERVAL '15 minutes');

CREATE FUNCTION "assign_exercise_revision_number"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  expected_revision INTEGER;
  aggregate_status "exercise_aggregate_status";
BEGIN
  SELECT "status" INTO aggregate_status
  FROM "exercises"
  WHERE "id" = NEW."exercise_id"
  FOR UPDATE;

  IF aggregate_status IS NULL THEN
    RAISE EXCEPTION 'exercise aggregate does not exist'
      USING ERRCODE = '23503', CONSTRAINT = 'exercise_revisions_exercise_id_fkey';
  END IF;
  IF aggregate_status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'archived exercise cannot receive a revision'
      USING ERRCODE = '23514', CONSTRAINT = 'exercise_revisions_active_aggregate_check';
  END IF;
  IF NEW."status" <> 'DRAFT' THEN
    RAISE EXCEPTION 'new exercise revision must start in DRAFT'
      USING ERRCODE = '23514', CONSTRAINT = 'exercise_revisions_initial_status_check';
  END IF;

  SELECT COALESCE(MAX("revision_number"), 0) + 1 INTO expected_revision
  FROM "exercise_revisions"
  WHERE "exercise_id" = NEW."exercise_id";

  IF NEW."revision_number" <> expected_revision THEN
    RAISE EXCEPTION 'exercise revision number must be the next monotonic value'
      USING ERRCODE = '23514', CONSTRAINT = 'exercise_revisions_monotonic_number_check';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "exercise_revisions_number_guard"
BEFORE INSERT ON "exercise_revisions"
FOR EACH ROW EXECUTE FUNCTION "assign_exercise_revision_number"();

CREATE FUNCTION "validate_exercise_revision_publication"(target_revision_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  revision_record "exercise_revisions"%ROWTYPE;
  sub_prompt_count INTEGER;
  sub_prompt_points INTEGER;
  sub_prompt_skills "exercise_skill_tag"[];
  prompt_media_count INTEGER;
BEGIN
  SELECT * INTO revision_record FROM "exercise_revisions" WHERE "id" = target_revision_id;
  SELECT COUNT(*), COALESCE(SUM("max_points"), 0),
         COALESCE(array_agg(DISTINCT "skill_tag" ORDER BY "skill_tag"), ARRAY[]::"exercise_skill_tag"[])
  INTO sub_prompt_count, sub_prompt_points, sub_prompt_skills
  FROM "exercise_revision_sub_prompts"
  WHERE "revision_id" = target_revision_id;

  IF revision_record."type" = 'QUICK_ROUND' THEN
    IF sub_prompt_count NOT BETWEEN 2 AND 8
      OR sub_prompt_points <> revision_record."max_points"
      OR NOT (revision_record."skill_tags" @> sub_prompt_skills
        AND revision_record."skill_tags" <@ sub_prompt_skills) THEN
      RAISE EXCEPTION 'quick round sub-prompts do not match parent scoring and skills'
        USING ERRCODE = '23514', CONSTRAINT = 'exercise_revisions_quick_round_shape_check';
    END IF;
  ELSIF sub_prompt_count <> 0 THEN
    RAISE EXCEPTION 'only quick rounds may own sub-prompts'
      USING ERRCODE = '23514', CONSTRAINT = 'exercise_revisions_sub_prompt_type_check';
  END IF;

  SELECT COUNT(*) INTO prompt_media_count
  FROM "exercise_revision_media_usages"
  WHERE "revision_id" = target_revision_id AND "role" = 'PROMPT_AUDIO';

  IF revision_record."delivery_variant" = 'AUDIO_ENABLED' AND prompt_media_count = 0 THEN
    RAISE EXCEPTION 'audio revision requires managed prompt media'
      USING ERRCODE = '23514', CONSTRAINT = 'exercise_revisions_audio_media_check';
  END IF;
END;
$$;

CREATE FUNCTION "protect_exercise_revision"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  old_content JSONB;
  new_content JSONB;
BEGIN
  old_content := to_jsonb(OLD) - ARRAY[
    'status', 'submitted_for_review_at', 'published_at', 'archived_at',
    'security_withdrawn_at', 'security_withdrawal_reason', 'updated_at'
  ];
  new_content := to_jsonb(NEW) - ARRAY[
    'status', 'submitted_for_review_at', 'published_at', 'archived_at',
    'security_withdrawn_at', 'security_withdrawal_reason', 'updated_at'
  ];

  IF OLD."status" <> 'DRAFT' AND old_content IS DISTINCT FROM new_content THEN
    RAISE EXCEPTION 'reviewed exercise revision content is immutable'
      USING ERRCODE = '23514', CONSTRAINT = 'exercise_revisions_immutable_content_check';
  END IF;
  IF OLD."security_withdrawn_at" IS NOT NULL
    AND (NEW."security_withdrawn_at", NEW."security_withdrawal_reason")
      IS DISTINCT FROM (OLD."security_withdrawn_at", OLD."security_withdrawal_reason") THEN
    RAISE EXCEPTION 'security withdrawal cannot be cleared or rewritten'
      USING ERRCODE = '23514', CONSTRAINT = 'exercise_revisions_withdrawal_immutable_check';
  END IF;

  IF NOT (
    (OLD."status" = 'DRAFT' AND NEW."status" IN ('DRAFT', 'IN_REVIEW'))
    OR (OLD."status" = 'IN_REVIEW' AND NEW."status" IN ('IN_REVIEW', 'DRAFT', 'PUBLISHED'))
    OR (OLD."status" = 'PUBLISHED' AND NEW."status" IN ('PUBLISHED', 'ARCHIVED'))
    OR (OLD."status" = 'ARCHIVED' AND NEW."status" = 'ARCHIVED')
  ) THEN
    RAISE EXCEPTION 'invalid exercise revision lifecycle transition'
      USING ERRCODE = '23514', CONSTRAINT = 'exercise_revisions_transition_check';
  END IF;

  IF OLD."status" <> 'PUBLISHED' AND NEW."status" = 'PUBLISHED' THEN
    PERFORM "validate_exercise_revision_publication"(NEW."id");
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "exercise_revisions_immutable_guard"
BEFORE UPDATE ON "exercise_revisions"
FOR EACH ROW EXECUTE FUNCTION "protect_exercise_revision"();

CREATE FUNCTION "protect_exercise_revision_child"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parent_status "exercise_revision_status";
BEGIN
  SELECT "status" INTO parent_status FROM "exercise_revisions"
  WHERE "id" = CASE WHEN TG_OP = 'DELETE' THEN OLD."revision_id" ELSE NEW."revision_id" END;
  IF parent_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'reviewed exercise revision children are immutable'
      USING ERRCODE = '23514', CONSTRAINT = 'exercise_revision_children_immutable_check';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "exercise_revision_sub_prompts_immutable_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "exercise_revision_sub_prompts"
FOR EACH ROW EXECUTE FUNCTION "protect_exercise_revision_child"();

CREATE TRIGGER "exercise_revision_media_usages_immutable_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "exercise_revision_media_usages"
FOR EACH ROW EXECUTE FUNCTION "protect_exercise_revision_child"();

CREATE FUNCTION "validate_exercise_media_context"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  actual_revision UUID;
BEGIN
  IF NEW."sub_prompt_id" IS NOT NULL THEN
    SELECT "revision_id" INTO actual_revision
    FROM "exercise_revision_sub_prompts" WHERE "id" = NEW."sub_prompt_id";
    IF actual_revision IS DISTINCT FROM NEW."revision_id" THEN
      RAISE EXCEPTION 'media sub-prompt belongs to another revision'
        USING ERRCODE = '23514', CONSTRAINT = 'exercise_revision_media_usages_context_check';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "exercise_revision_media_usages_context_guard"
BEFORE INSERT OR UPDATE ON "exercise_revision_media_usages"
FOR EACH ROW EXECUTE FUNCTION "validate_exercise_media_context"();

CREATE FUNCTION "protect_exercise_aggregate"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."status" = 'ARCHIVED' AND NEW."status" <> 'ARCHIVED' THEN
    IF NEW."status" <> 'ACTIVE' THEN
      RAISE EXCEPTION 'archived exercise can reopen only to ACTIVE'
        USING ERRCODE = '23514', CONSTRAINT = 'exercises_reopen_check';
    END IF;
  END IF;
  IF OLD."status" = 'ACTIVE' AND NEW."status" = 'ARCHIVED' THEN
    IF EXISTS (SELECT 1 FROM "lesson_exercise_placements" WHERE "exercise_id" = OLD."id" AND "status" = 'ACTIVE')
      OR EXISTS (SELECT 1 FROM "exercise_revisions" WHERE "exercise_id" = OLD."id" AND "status" <> 'ARCHIVED') THEN
      RAISE EXCEPTION 'exercise with active placement or unarchived revision cannot be archived'
        USING ERRCODE = '23514', CONSTRAINT = 'exercises_archive_dependencies_check';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "exercises_lifecycle_guard"
BEFORE UPDATE ON "exercises"
FOR EACH ROW EXECUTE FUNCTION "protect_exercise_aggregate"();

CREATE FUNCTION "validate_lesson_exercise_placement"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  primary_revision "exercise_revisions"%ROWTYPE;
  alternative_revision "exercise_revisions"%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' AND NEW."status" <> 'DRAFT' THEN
    RAISE EXCEPTION 'new placement must start in DRAFT'
      USING ERRCODE = '23514', CONSTRAINT = 'lesson_exercise_placements_initial_status_check';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD."status" = 'ARCHIVED' THEN
      RAISE EXCEPTION 'archived placement is immutable; restore by cloning a draft'
        USING ERRCODE = '23514', CONSTRAINT = 'lesson_exercise_placements_archived_immutable_check';
    END IF;
    IF OLD."status" = 'ACTIVE' AND (
      NEW."lesson_id", NEW."exercise_id", NEW."primary_revision_id", NEW."text_alternative_revision_id"
    ) IS DISTINCT FROM (
      OLD."lesson_id", OLD."exercise_id", OLD."primary_revision_id", OLD."text_alternative_revision_id"
    ) THEN
      RAISE EXCEPTION 'active placement target is immutable'
        USING ERRCODE = '23514', CONSTRAINT = 'lesson_exercise_placements_active_target_check';
    END IF;
    IF NOT (
      (OLD."status" = 'DRAFT' AND NEW."status" IN ('DRAFT', 'ACTIVE'))
      OR (OLD."status" = 'ACTIVE' AND NEW."status" IN ('ACTIVE', 'ARCHIVED'))
    ) THEN
      RAISE EXCEPTION 'invalid lesson exercise placement transition'
        USING ERRCODE = '23514', CONSTRAINT = 'lesson_exercise_placements_transition_check';
    END IF;
  END IF;

  IF NEW."status" = 'ACTIVE' THEN
    SELECT * INTO primary_revision FROM "exercise_revisions"
    WHERE "id" = NEW."primary_revision_id";
    IF primary_revision."status" <> 'PUBLISHED'
      OR primary_revision."security_withdrawn_at" IS NOT NULL
      OR primary_revision."delivery_variant" = 'TEXT_ALTERNATIVE' THEN
      RAISE EXCEPTION 'active placement requires a reachable published primary revision'
        USING ERRCODE = '23514', CONSTRAINT = 'lesson_exercise_placements_primary_revision_check';
    END IF;
    IF primary_revision."delivery_variant" = 'AUDIO_ENABLED' THEN
      IF NEW."text_alternative_revision_id" IS NULL THEN
        RAISE EXCEPTION 'audio placement requires a text alternative revision'
          USING ERRCODE = '23514', CONSTRAINT = 'lesson_exercise_placements_audio_pair_check';
      END IF;
      SELECT * INTO alternative_revision FROM "exercise_revisions"
      WHERE "id" = NEW."text_alternative_revision_id";
      IF alternative_revision."status" <> 'PUBLISHED'
        OR alternative_revision."security_withdrawn_at" IS NOT NULL
        OR alternative_revision."delivery_variant" <> 'TEXT_ALTERNATIVE'
        OR alternative_revision."type" <> primary_revision."type"
        OR alternative_revision."max_points" <> primary_revision."max_points"
        OR NOT (alternative_revision."skill_tags" @> primary_revision."skill_tags"
          AND alternative_revision."skill_tags" <@ primary_revision."skill_tags") THEN
        RAISE EXCEPTION 'audio and text alternative revisions are incompatible'
          USING ERRCODE = '23514', CONSTRAINT = 'lesson_exercise_placements_audio_pair_check';
      END IF;
    ELSIF NEW."text_alternative_revision_id" IS NOT NULL THEN
      RAISE EXCEPTION 'standard placement cannot bind a text alternative'
        USING ERRCODE = '23514', CONSTRAINT = 'lesson_exercise_placements_standard_variant_check';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "lesson_exercise_placements_lifecycle_guard"
BEFORE INSERT OR UPDATE ON "lesson_exercise_placements"
FOR EACH ROW EXECUTE FUNCTION "validate_lesson_exercise_placement"();

CREATE FUNCTION "bump_lesson_exercise_curriculum_for_placement"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    (OLD."status" = 'ACTIVE' OR NEW."status" = 'ACTIVE')
    AND (OLD."status", OLD."stage_key", OLD."position", OLD."primary_revision_id",
      OLD."text_alternative_revision_id") IS DISTINCT FROM
      (NEW."status", NEW."stage_key", NEW."position", NEW."primary_revision_id",
      NEW."text_alternative_revision_id")
  ) THEN
    UPDATE "lessons"
    SET "exercise_curriculum_revision" = "exercise_curriculum_revision" + 1,
        "updated_at" = CURRENT_TIMESTAMP
    WHERE "id" = NEW."lesson_id";
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "lesson_exercise_placements_curriculum_revision_guard"
AFTER UPDATE ON "lesson_exercise_placements"
FOR EACH ROW EXECUTE FUNCTION "bump_lesson_exercise_curriculum_for_placement"();

CREATE FUNCTION "protect_demo_mapping"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  public_chain_is_valid BOOLEAN;
  active_count INTEGER;
BEGIN
  IF TG_OP = 'INSERT' AND NEW."status" <> 'DRAFT' THEN
    RAISE EXCEPTION 'new demo mapping must start in DRAFT'
      USING ERRCODE = '23514', CONSTRAINT = 'demo_lesson_mappings_initial_status_check';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD."status" = 'ENABLED' AND (NEW."slug", NEW."lesson_id") IS DISTINCT FROM (OLD."slug", OLD."lesson_id") THEN
      RAISE EXCEPTION 'enabled demo mapping identity is immutable'
        USING ERRCODE = '23514', CONSTRAINT = 'demo_lesson_mappings_enabled_identity_check';
    END IF;
    IF NOT (
      (OLD."status" = 'DRAFT' AND NEW."status" IN ('DRAFT', 'ENABLED'))
      OR (OLD."status" = 'ENABLED' AND NEW."status" IN ('ENABLED', 'DISABLED'))
      OR (OLD."status" = 'DISABLED' AND NEW."status" IN ('DISABLED', 'DRAFT'))
    ) THEN
      RAISE EXCEPTION 'invalid demo mapping lifecycle transition'
        USING ERRCODE = '23514', CONSTRAINT = 'demo_lesson_mappings_transition_check';
    END IF;
  END IF;

  IF NEW."status" = 'ENABLED' AND (TG_OP = 'INSERT' OR OLD."status" <> 'ENABLED') THEN
    SELECT (
      lesson."is_preview" AND lesson."status" = 'PUBLISHED' AND lesson."deleted_at" IS NULL
      AND section."is_published" AND section."deleted_at" IS NULL
      AND course."status" = 'PUBLISHED' AND course."deleted_at" IS NULL
    ) INTO public_chain_is_valid
    FROM "lessons" lesson
    JOIN "course_sections" section
      ON section."id" = lesson."section_id" AND section."course_id" = lesson."course_id"
    JOIN "courses" course ON course."id" = lesson."course_id"
    WHERE lesson."id" = NEW."lesson_id";

    SELECT COUNT(*) INTO active_count FROM "lesson_exercise_placements"
    WHERE "lesson_id" = NEW."lesson_id" AND "status" = 'ACTIVE';

    IF public_chain_is_valid IS DISTINCT FROM TRUE OR active_count <> 12 THEN
      RAISE EXCEPTION 'enabled demo requires a public preview chain and exactly 12 active placements'
        USING ERRCODE = '23514', CONSTRAINT = 'demo_lesson_mappings_enable_readiness_check';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "demo_lesson_mappings_lifecycle_guard"
BEFORE INSERT OR UPDATE ON "demo_lesson_mappings"
FOR EACH ROW EXECUTE FUNCTION "protect_demo_mapping"();

CREATE FUNCTION "bump_lesson_exercise_curriculum_for_mapping"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND
    (OLD."status", OLD."slug", OLD."lesson_id") IS DISTINCT FROM
    (NEW."status", NEW."slug", NEW."lesson_id") THEN
    UPDATE "lessons"
    SET "exercise_curriculum_revision" = "exercise_curriculum_revision" + 1,
        "updated_at" = CURRENT_TIMESTAMP
    WHERE "id" = NEW."lesson_id";
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "demo_lesson_mappings_curriculum_revision_guard"
AFTER UPDATE ON "demo_lesson_mappings"
FOR EACH ROW EXECUTE FUNCTION "bump_lesson_exercise_curriculum_for_mapping"();

CREATE FUNCTION "validate_demo_attempt_binding"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  mapping_lesson UUID;
  current_curriculum_revision INTEGER;
  source_lineage UUID;
  source_status "demo_attempt_status";
  source_mapping UUID;
  source_lesson UUID;
BEGIN
  SELECT mapping."lesson_id", lesson."exercise_curriculum_revision"
  INTO mapping_lesson, current_curriculum_revision
  FROM "demo_lesson_mappings" mapping
  JOIN "lessons" lesson ON lesson."id" = mapping."lesson_id"
  WHERE mapping."id" = NEW."demo_mapping_id";
  IF mapping_lesson IS DISTINCT FROM NEW."lesson_id" THEN
    RAISE EXCEPTION 'attempt lesson does not match demo mapping'
      USING ERRCODE = '23514', CONSTRAINT = 'demo_attempts_mapping_lesson_check';
  END IF;
  IF TG_OP = 'INSERT' AND NEW."creation_kind" IN ('STANDARD', 'RESET')
    AND NEW."lesson_curriculum_revision" <> current_curriculum_revision THEN
    RAISE EXCEPTION 'standard or reset attempt must snapshot the current lesson curriculum revision'
      USING ERRCODE = '23514', CONSTRAINT = 'demo_attempts_current_curriculum_revision_check';
  END IF;
  IF NEW."source_attempt_id" IS NOT NULL THEN
    SELECT "lineage_id", "status", "demo_mapping_id", "lesson_id"
    INTO source_lineage, source_status, source_mapping, source_lesson
    FROM "demo_attempts"
    WHERE "id" = NEW."source_attempt_id";
    IF source_mapping IS DISTINCT FROM NEW."demo_mapping_id"
      OR source_lesson IS DISTINCT FROM NEW."lesson_id" THEN
      RAISE EXCEPTION 'derived attempt must retain the source demo mapping and lesson'
        USING ERRCODE = '23514', CONSTRAINT = 'demo_attempts_source_scope_check';
    END IF;
    IF NEW."creation_kind" = 'RETRY' AND NEW."lineage_id" IS DISTINCT FROM source_lineage THEN
      RAISE EXCEPTION 'retry must share source lineage'
        USING ERRCODE = '23514', CONSTRAINT = 'demo_attempts_retry_lineage_check';
    END IF;
    IF NEW."creation_kind" = 'RETRY' AND source_status <> 'COMPLETED' THEN
      RAISE EXCEPTION 'retry source must be completed'
        USING ERRCODE = '23514', CONSTRAINT = 'demo_attempts_retry_source_status_check';
    END IF;
    IF NEW."creation_kind" = 'RESET' AND NEW."lineage_id" IS NOT DISTINCT FROM source_lineage THEN
      RAISE EXCEPTION 'reset must create an unrelated lineage'
        USING ERRCODE = '23514', CONSTRAINT = 'demo_attempts_reset_lineage_check';
    END IF;
    IF NEW."creation_kind" = 'RESET' AND source_status <> 'IN_PROGRESS' THEN
      RAISE EXCEPTION 'reset source must be in progress'
        USING ERRCODE = '23514', CONSTRAINT = 'demo_attempts_reset_source_status_check';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF (NEW."id", NEW."demo_mapping_id", NEW."lesson_id", NEW."lineage_id",
      NEW."creation_kind", NEW."retry_mode", NEW."token_nonce", NEW."token_key_version",
      NEW."token_digest", NEW."requested_locale", NEW."resolved_locale", NEW."audio_mode",
      NEW."lesson_curriculum_revision", NEW."created_at")
      IS DISTINCT FROM
      (OLD."id", OLD."demo_mapping_id", OLD."lesson_id", OLD."lineage_id",
      OLD."creation_kind", OLD."retry_mode", OLD."token_nonce", OLD."token_key_version",
      OLD."token_digest", OLD."requested_locale", OLD."resolved_locale", OLD."audio_mode",
      OLD."lesson_curriculum_revision", OLD."created_at") THEN
      RAISE EXCEPTION 'attempt capability and snapshot bindings are immutable'
        USING ERRCODE = '23514', CONSTRAINT = 'demo_attempts_identity_immutable_check';
    END IF;
    IF NOT (
      (OLD."status" = 'IN_PROGRESS' AND NEW."status" IN ('IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'ABANDONED', 'REVOKED'))
      OR (OLD."status" = 'COMPLETED' AND NEW."status" IN ('COMPLETED', 'EXPIRED', 'REVOKED'))
      OR (OLD."status" IN ('EXPIRED', 'ABANDONED', 'REVOKED') AND NEW."status" = OLD."status")
    ) THEN
      RAISE EXCEPTION 'invalid demo attempt lifecycle transition'
        USING ERRCODE = '23514', CONSTRAINT = 'demo_attempts_transition_check';
    END IF;
    IF NEW."version" < OLD."version" OR NEW."version" > OLD."version" + 1 THEN
      RAISE EXCEPTION 'attempt version must be stable or increment exactly once'
        USING ERRCODE = '23514', CONSTRAINT = 'demo_attempts_version_transition_check';
    END IF;
    IF NEW."status" IS DISTINCT FROM OLD."status"
      AND NEW."version" <> OLD."version" + 1 THEN
      RAISE EXCEPTION 'attempt state transition must increment version'
        USING ERRCODE = '23514', CONSTRAINT = 'demo_attempts_state_version_check';
    END IF;
    IF NEW."last_accepted_mutation_at" > OLD."last_accepted_mutation_at"
      AND NEW."version" <> OLD."version" + 1 THEN
      RAISE EXCEPTION 'accepted mutation must increment attempt version'
        USING ERRCODE = '23514', CONSTRAINT = 'demo_attempts_mutation_version_check';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "demo_attempts_binding_guard"
BEFORE INSERT OR UPDATE ON "demo_attempts"
FOR EACH ROW EXECUTE FUNCTION "validate_demo_attempt_binding"();

CREATE FUNCTION "protect_demo_snapshot"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'demo attempt snapshot is immutable'
    USING ERRCODE = '23514', CONSTRAINT = 'demo_attempt_snapshots_immutable_check';
END;
$$;

CREATE TRIGGER "demo_attempt_snapshot_items_immutable_guard"
BEFORE UPDATE ON "demo_attempt_snapshot_items"
FOR EACH ROW EXECUTE FUNCTION "protect_demo_snapshot"();

CREATE TRIGGER "demo_attempt_snapshot_sub_prompts_immutable_guard"
BEFORE UPDATE ON "demo_attempt_snapshot_sub_prompts"
FOR EACH ROW EXECUTE FUNCTION "protect_demo_snapshot"();

CREATE TRIGGER "demo_attempt_snapshot_media_usages_immutable_guard"
BEFORE UPDATE ON "demo_attempt_snapshot_media_usages"
FOR EACH ROW EXECUTE FUNCTION "protect_demo_snapshot"();

CREATE FUNCTION "validate_demo_snapshot_media_context"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  actual_item UUID;
BEGIN
  IF NEW."sub_prompt_id" IS NOT NULL THEN
    SELECT "snapshot_item_id" INTO actual_item
    FROM "demo_attempt_snapshot_sub_prompts" WHERE "id" = NEW."sub_prompt_id";
    IF actual_item IS DISTINCT FROM NEW."snapshot_item_id" THEN
      RAISE EXCEPTION 'snapshot media sub-prompt belongs to another item'
        USING ERRCODE = '23514', CONSTRAINT = 'demo_snapshot_media_usages_context_check';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "demo_snapshot_media_usages_context_guard"
BEFORE INSERT OR UPDATE ON "demo_attempt_snapshot_media_usages"
FOR EACH ROW EXECUTE FUNCTION "validate_demo_snapshot_media_context"();

CREATE FUNCTION "validate_demo_attempt_exercise_state"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  allowed_submissions INTEGER;
  allowed_points INTEGER;
BEGIN
  SELECT "max_submissions", "max_points" INTO allowed_submissions, allowed_points
  FROM "demo_attempt_snapshot_items" WHERE "id" = NEW."snapshot_item_id";
  IF NEW."submissions_used" > allowed_submissions OR NEW."earned_points" > allowed_points THEN
    RAISE EXCEPTION 'attempt exercise state exceeds snapshot scoring limits'
      USING ERRCODE = '23514', CONSTRAINT = 'demo_attempt_exercise_states_snapshot_limits_check';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "demo_attempt_exercise_states_limits_guard"
BEFORE INSERT OR UPDATE ON "demo_attempt_exercise_states"
FOR EACH ROW EXECUTE FUNCTION "validate_demo_attempt_exercise_state"();

CREATE FUNCTION "validate_demo_sub_prompt_state"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  expected_state UUID;
  allowed_points INTEGER;
BEGIN
  SELECT state."id", prompt."max_points" INTO expected_state, allowed_points
  FROM "demo_attempt_snapshot_sub_prompts" prompt
  JOIN "demo_attempt_snapshot_items" item ON item."id" = prompt."snapshot_item_id"
  JOIN "demo_attempt_exercise_states" state ON state."snapshot_item_id" = item."id"
  WHERE prompt."id" = NEW."snapshot_sub_prompt_id";
  IF expected_state IS DISTINCT FROM NEW."exercise_state_id" OR NEW."earned_points" > allowed_points THEN
    RAISE EXCEPTION 'sub-prompt state belongs to another exercise or exceeds points'
      USING ERRCODE = '23514', CONSTRAINT = 'demo_attempt_sub_prompt_states_context_check';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "demo_attempt_sub_prompt_states_context_guard"
BEFORE INSERT OR UPDATE ON "demo_attempt_sub_prompt_states"
FOR EACH ROW EXECUTE FUNCTION "validate_demo_sub_prompt_state"();

CREATE FUNCTION "protect_demo_idempotency_record"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."resulting_attempt_id" IS NOT NULL
    AND NEW."resulting_attempt_id" IS NULL
    AND (to_jsonb(OLD) - 'resulting_attempt_id') = (to_jsonb(NEW) - 'resulting_attempt_id') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'demo idempotency receipt is immutable'
    USING ERRCODE = '23514', CONSTRAINT = 'demo_idempotency_records_immutable_check';
END;
$$;

CREATE TRIGGER "demo_idempotency_records_immutable_guard"
BEFORE UPDATE ON "demo_idempotency_records"
FOR EACH ROW EXECUTE FUNCTION "protect_demo_idempotency_record"();

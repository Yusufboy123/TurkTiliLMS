-- Module 8.1B is additive. It introduces the approved enrollment-scoped
-- progress storage contract without creating progress rows or fabricating
-- historical completion.

-- CreateEnum
CREATE TYPE "block_progress_state" AS ENUM ('INCOMPLETE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "lesson_progress_state" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "progress_event_type" AS ENUM ('BLOCK_COMPLETED', 'BLOCK_REOPENED', 'LESSON_COMPLETED', 'LESSON_REOPENED', 'COURSE_COMPLETED');

-- CreateEnum
CREATE TYPE "progress_event_state" AS ENUM ('NOT_STARTED', 'INCOMPLETE', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "idempotency_operation" AS ENUM ('COMPLETE_BLOCK', 'REOPEN_BLOCK', 'COMPLETE_LESSON', 'REOPEN_LESSON', 'RECORD_LAST_VISITED_LESSON');

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "curriculum_version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "courses"
ADD CONSTRAINT "courses_curriculum_version_positive_check"
CHECK ("curriculum_version" > 0);

-- CreateTable
CREATE TABLE "enrollment_progress_roots" (
    "id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "last_visited_lesson_id" UUID,
    "last_visited_at" TIMESTAMPTZ(3),
    "first_activity_at" TIMESTAMPTZ(3),
    "completion_version" INTEGER NOT NULL DEFAULT 0,
    "activity_version" INTEGER NOT NULL DEFAULT 0,
    "curriculum_version" INTEGER NOT NULL DEFAULT 1,
    "completed_eligible_blocks" INTEGER NOT NULL DEFAULT 0,
    "total_eligible_blocks" INTEGER NOT NULL DEFAULT 0,
    "completed_lessons" INTEGER NOT NULL DEFAULT 0,
    "total_eligible_lessons" INTEGER NOT NULL DEFAULT 0,
    "course_percentage" INTEGER NOT NULL DEFAULT 0,
    "frozen_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "enrollment_progress_roots_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "enrollment_progress_roots_versions_check" CHECK (
        "completion_version" >= 0
        AND "activity_version" >= 0
        AND "curriculum_version" > 0
    ),
    CONSTRAINT "enrollment_progress_roots_counts_check" CHECK (
        "completed_eligible_blocks" >= 0
        AND "total_eligible_blocks" >= 0
        AND "completed_eligible_blocks" <= "total_eligible_blocks"
        AND "completed_lessons" >= 0
        AND "total_eligible_lessons" >= 0
        AND "completed_lessons" <= "total_eligible_lessons"
    ),
    CONSTRAINT "enrollment_progress_roots_percentage_check" CHECK (
        "course_percentage" BETWEEN 0 AND 100
        AND "course_percentage" = CASE
            WHEN "total_eligible_lessons" = 0 THEN 0
            ELSE (
                ("completed_lessons"::BIGINT * 100)
                / "total_eligible_lessons"::BIGINT
            )::INTEGER
        END
    ),
    CONSTRAINT "enrollment_progress_roots_last_visited_pair_check" CHECK (
        ("last_visited_lesson_id" IS NULL) = ("last_visited_at" IS NULL)
    ),
    CONSTRAINT "enrollment_progress_roots_activity_timestamps_check" CHECK (
        "last_visited_at" IS NULL
        OR (
            "first_activity_at" IS NOT NULL
            AND "first_activity_at" <= "last_visited_at"
        )
    )
);

-- CreateTable
CREATE TABLE "lesson_progress" (
    "id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "state" "lesson_progress_state" NOT NULL DEFAULT 'IN_PROGRESS',
    "curriculum_version" INTEGER NOT NULL,
    "first_activity_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lesson_progress_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "lesson_progress_curriculum_version_positive_check" CHECK (
        "curriculum_version" > 0
    ),
    CONSTRAINT "lesson_progress_state_completion_check" CHECK (
        ("state" = 'IN_PROGRESS' AND "completed_at" IS NULL)
        OR ("state" = 'COMPLETED' AND "completed_at" IS NOT NULL)
    ),
    CONSTRAINT "lesson_progress_timestamps_check" CHECK (
        "first_activity_at" <= "last_activity_at"
        AND (
            "completed_at" IS NULL
            OR (
                "completed_at" >= "first_activity_at"
                AND "completed_at" <= "last_activity_at"
            )
        )
    )
);

-- CreateTable
CREATE TABLE "block_progress" (
    "id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "block_id" UUID NOT NULL,
    "state" "block_progress_state" NOT NULL,
    "curriculum_version" INTEGER NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "block_progress_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "block_progress_curriculum_version_positive_check" CHECK (
        "curriculum_version" > 0
    ),
    CONSTRAINT "block_progress_state_completion_check" CHECK (
        ("state" = 'INCOMPLETE' AND "completed_at" IS NULL)
        OR ("state" = 'COMPLETED' AND "completed_at" IS NOT NULL)
    )
);

-- CreateTable
CREATE TABLE "progress_events" (
    "id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "event_type" "progress_event_type" NOT NULL,
    "lesson_id" UUID,
    "block_id" UUID,
    "previous_state" "progress_event_state" NOT NULL,
    "new_state" "progress_event_state" NOT NULL,
    "curriculum_version" INTEGER NOT NULL,
    "resulting_completion_version" INTEGER NOT NULL,
    "idempotency_record_id" UUID,
    "request_correlation_id" UUID,
    "snapshot_completed_eligible_blocks" INTEGER,
    "snapshot_total_eligible_blocks" INTEGER,
    "snapshot_completed_lessons" INTEGER,
    "snapshot_total_eligible_lessons" INTEGER,
    "snapshot_course_percentage" INTEGER,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progress_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "progress_events_versions_check" CHECK (
        "curriculum_version" > 0
        AND "resulting_completion_version" > 0
    ),
    CONSTRAINT "progress_events_shape_check" CHECK (
        (
            "event_type" IN ('BLOCK_COMPLETED', 'BLOCK_REOPENED')
            AND "lesson_id" IS NOT NULL
            AND "block_id" IS NOT NULL
        )
        OR (
            "event_type" IN ('LESSON_COMPLETED', 'LESSON_REOPENED')
            AND "lesson_id" IS NOT NULL
            AND "block_id" IS NULL
        )
        OR (
            "event_type" = 'COURSE_COMPLETED'
            AND "lesson_id" IS NULL
            AND "block_id" IS NULL
        )
    ),
    CONSTRAINT "progress_events_transition_check" CHECK (
        (
            "event_type" = 'BLOCK_COMPLETED'
            AND "previous_state" IN ('NOT_STARTED', 'INCOMPLETE')
            AND "new_state" = 'COMPLETED'
        )
        OR (
            "event_type" = 'BLOCK_REOPENED'
            AND "previous_state" = 'COMPLETED'
            AND "new_state" = 'INCOMPLETE'
        )
        OR (
            "event_type" = 'LESSON_COMPLETED'
            AND "previous_state" IN ('NOT_STARTED', 'IN_PROGRESS')
            AND "new_state" = 'COMPLETED'
        )
        OR (
            "event_type" = 'LESSON_REOPENED'
            AND "previous_state" = 'COMPLETED'
            AND "new_state" = 'IN_PROGRESS'
        )
        OR (
            "event_type" = 'COURSE_COMPLETED'
            AND "previous_state" IN ('NOT_STARTED', 'IN_PROGRESS')
            AND "new_state" = 'COMPLETED'
        )
    ),
    CONSTRAINT "progress_events_snapshot_check" CHECK (
        (
            "event_type" = 'COURSE_COMPLETED'
            AND "snapshot_completed_eligible_blocks" IS NOT NULL
            AND "snapshot_total_eligible_blocks" IS NOT NULL
            AND "snapshot_completed_lessons" IS NOT NULL
            AND "snapshot_total_eligible_lessons" IS NOT NULL
            AND "snapshot_course_percentage" = 100
            AND "snapshot_completed_eligible_blocks" >= 0
            AND "snapshot_total_eligible_blocks" >= 0
            AND "snapshot_completed_eligible_blocks" <= "snapshot_total_eligible_blocks"
            AND "snapshot_total_eligible_lessons" > 0
            AND "snapshot_completed_lessons" = "snapshot_total_eligible_lessons"
        )
        OR (
            "event_type" <> 'COURSE_COMPLETED'
            AND "snapshot_completed_eligible_blocks" IS NULL
            AND "snapshot_total_eligible_blocks" IS NULL
            AND "snapshot_completed_lessons" IS NULL
            AND "snapshot_total_eligible_lessons" IS NULL
            AND "snapshot_course_percentage" IS NULL
        )
    )
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "operation" "idempotency_operation" NOT NULL,
    "request_fingerprint" CHAR(64) NOT NULL,
    "response_status" SMALLINT NOT NULL,
    "response_envelope" JSONB NOT NULL,
    "resulting_completion_version" INTEGER,
    "resulting_activity_version" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "idempotency_records_key_check" CHECK (
        char_length("key") BETWEEN 16 AND 128
        AND "key" ~ '^[A-Za-z0-9._:-]+$'
    ),
    CONSTRAINT "idempotency_records_fingerprint_check" CHECK (
        "request_fingerprint" ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT "idempotency_records_response_status_check" CHECK (
        "response_status" BETWEEN 200 AND 299
    ),
    CONSTRAINT "idempotency_records_result_versions_check" CHECK (
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
    ),
    CONSTRAINT "idempotency_records_expiry_check" CHECK (
        "expires_at" > "created_at"
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "enrollment_progress_roots_enrollment_id_key" ON "enrollment_progress_roots"("enrollment_id");

-- CreateIndex
CREATE INDEX "enrollment_progress_roots_last_visited_at_enrollment_id_idx" ON "enrollment_progress_roots"("last_visited_at", "enrollment_id");

-- CreateIndex
CREATE INDEX "enrollment_progress_roots_frozen_at_idx" ON "enrollment_progress_roots"("frozen_at");

-- CreateIndex
CREATE INDEX "lesson_progress_enrollment_id_state_lesson_id_idx" ON "lesson_progress"("enrollment_id", "state", "lesson_id");

-- CreateIndex
CREATE INDEX "lesson_progress_lesson_id_state_idx" ON "lesson_progress"("lesson_id", "state");

-- CreateIndex
CREATE INDEX "lesson_progress_enrollment_id_last_activity_at_idx" ON "lesson_progress"("enrollment_id", "last_activity_at");

-- CreateIndex
CREATE INDEX "lesson_progress_completed_at_idx" ON "lesson_progress"("completed_at");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_progress_enrollment_id_lesson_id_key" ON "lesson_progress"("enrollment_id", "lesson_id");

-- CreateIndex
CREATE INDEX "block_progress_enrollment_id_state_block_id_idx" ON "block_progress"("enrollment_id", "state", "block_id");

-- CreateIndex
CREATE INDEX "block_progress_block_id_state_idx" ON "block_progress"("block_id", "state");

-- CreateIndex
CREATE INDEX "block_progress_completed_at_idx" ON "block_progress"("completed_at");

-- CreateIndex
CREATE UNIQUE INDEX "block_progress_enrollment_id_block_id_key" ON "block_progress"("enrollment_id", "block_id");

-- CreateIndex
CREATE INDEX "progress_events_enrollment_id_occurred_at_idx" ON "progress_events"("enrollment_id", "occurred_at");

-- CreateIndex
CREATE INDEX "progress_events_actor_user_id_occurred_at_idx" ON "progress_events"("actor_user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "progress_events_lesson_id_occurred_at_idx" ON "progress_events"("lesson_id", "occurred_at");

-- CreateIndex
CREATE INDEX "progress_events_block_id_occurred_at_idx" ON "progress_events"("block_id", "occurred_at");

-- CreateIndex
CREATE INDEX "progress_events_event_type_occurred_at_idx" ON "progress_events"("event_type", "occurred_at");

-- CreateIndex
CREATE INDEX "progress_events_idempotency_record_id_idx" ON "progress_events"("idempotency_record_id");

-- CreateIndex
CREATE INDEX "idempotency_records_enrollment_id_created_at_idx" ON "idempotency_records"("enrollment_id", "created_at");

-- CreateIndex
CREATE INDEX "idempotency_records_expires_at_idx" ON "idempotency_records"("expires_at");

-- CreateIndex
CREATE INDEX "idempotency_records_operation_created_at_idx" ON "idempotency_records"("operation", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_actor_user_id_key_key" ON "idempotency_records"("actor_user_id", "key");

-- AddForeignKey
ALTER TABLE "enrollment_progress_roots" ADD CONSTRAINT "enrollment_progress_roots_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "course_enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_progress_roots" ADD CONSTRAINT "enrollment_progress_roots_last_visited_lesson_id_fkey" FOREIGN KEY ("last_visited_lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollment_progress_roots"("enrollment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "block_progress" ADD CONSTRAINT "block_progress_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollment_progress_roots"("enrollment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "block_progress" ADD CONSTRAINT "block_progress_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "lesson_content_blocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_events" ADD CONSTRAINT "progress_events_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollment_progress_roots"("enrollment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_events" ADD CONSTRAINT "progress_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_events" ADD CONSTRAINT "progress_events_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_events" ADD CONSTRAINT "progress_events_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "lesson_content_blocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_events" ADD CONSTRAINT "progress_events_idempotency_record_id_fkey" FOREIGN KEY ("idempotency_record_id") REFERENCES "idempotency_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollment_progress_roots"("enrollment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

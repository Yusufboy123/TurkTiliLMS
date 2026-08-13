CREATE TYPE "vocabulary_source_status" AS ENUM ('NEW', 'REVIEW', 'QUESTIONABLE');
CREATE TYPE "student_vocabulary_status" AS ENUM ('NEW', 'KNOWN', 'NEEDS_REVIEW');
CREATE TYPE "vocabulary_test_attempt_status" AS ENUM ('IN_PROGRESS', 'SUBMITTED');

ALTER TABLE "lesson_vocabulary"
  ADD COLUMN "source_id" VARCHAR(120),
  ADD COLUMN "source_status" "vocabulary_source_status" NOT NULL DEFAULT 'NEW';

CREATE INDEX "lesson_vocabulary_source_id_status_idx"
  ON "lesson_vocabulary"("source_id", "source_status");
CREATE UNIQUE INDEX "lesson_vocabulary_lesson_source_key"
  ON "lesson_vocabulary"("lesson_id", "source_id")
  WHERE "source_id" IS NOT NULL;

CREATE TABLE "student_vocabulary_progress" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "vocabulary_id" UUID NOT NULL,
  "status" "student_vocabulary_status" NOT NULL DEFAULT 'NEW',
  "first_seen_at" TIMESTAMPTZ(3),
  "last_reviewed_at" TIMESTAMPTZ(3),
  "review_count" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "student_vocabulary_progress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "student_vocabulary_progress_user_vocabulary_key"
  ON "student_vocabulary_progress"("user_id", "vocabulary_id");
CREATE INDEX "student_vocabulary_progress_user_status_reviewed_idx"
  ON "student_vocabulary_progress"("user_id", "status", "last_reviewed_at");
ALTER TABLE "student_vocabulary_progress"
  ADD CONSTRAINT "student_vocabulary_progress_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "student_vocabulary_progress_vocabulary_id_fkey"
  FOREIGN KEY ("vocabulary_id") REFERENCES "lesson_vocabulary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "vocabulary_test_attempts" (
  "id" UUID NOT NULL,
  "enrollment_id" UUID NOT NULL,
  "lesson_id" UUID NOT NULL,
  "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submitted_at" TIMESTAMPTZ(3),
  "score" INTEGER NOT NULL DEFAULT 0,
  "max_score" INTEGER NOT NULL,
  "percentage" INTEGER NOT NULL DEFAULT 0,
  "correct_count" INTEGER NOT NULL DEFAULT 0,
  "incorrect_count" INTEGER NOT NULL DEFAULT 0,
  "status" "vocabulary_test_attempt_status" NOT NULL DEFAULT 'IN_PROGRESS',
  CONSTRAINT "vocabulary_test_attempts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "vocabulary_test_attempts_enrollment_lesson_status_idx"
  ON "vocabulary_test_attempts"("enrollment_id", "lesson_id", "status", "started_at");
CREATE INDEX "vocabulary_test_attempts_lesson_status_submitted_idx"
  ON "vocabulary_test_attempts"("lesson_id", "status", "submitted_at");
ALTER TABLE "vocabulary_test_attempts"
  ADD CONSTRAINT "vocabulary_test_attempts_enrollment_id_fkey"
  FOREIGN KEY ("enrollment_id") REFERENCES "course_enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "vocabulary_test_attempts_lesson_id_fkey"
  FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "vocabulary_test_answers" (
  "id" UUID NOT NULL,
  "attempt_id" UUID NOT NULL,
  "vocabulary_id" UUID NOT NULL,
  "submitted_answer" TEXT NOT NULL,
  "is_correct" BOOLEAN NOT NULL DEFAULT false,
  "awarded_points" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "vocabulary_test_answers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "vocabulary_test_answers_attempt_vocabulary_key"
  ON "vocabulary_test_answers"("attempt_id", "vocabulary_id");
CREATE INDEX "vocabulary_test_answers_attempt_id_idx"
  ON "vocabulary_test_answers"("attempt_id");
ALTER TABLE "vocabulary_test_answers"
  ADD CONSTRAINT "vocabulary_test_answers_attempt_id_fkey"
  FOREIGN KEY ("attempt_id") REFERENCES "vocabulary_test_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "vocabulary_test_answers_vocabulary_id_fkey"
  FOREIGN KEY ("vocabulary_id") REFERENCES "lesson_vocabulary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

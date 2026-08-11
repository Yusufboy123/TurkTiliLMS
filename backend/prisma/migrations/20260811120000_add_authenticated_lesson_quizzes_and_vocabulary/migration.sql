-- CreateEnum
CREATE TYPE "lesson_quiz_question_type" AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'MISSING_WORD');

-- CreateEnum
CREATE TYPE "lesson_quiz_attempt_status" AS ENUM ('IN_PROGRESS', 'SUBMITTED');

-- CreateTable
CREATE TABLE "lesson_vocabulary" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "turkish_word" VARCHAR(200) NOT NULL,
    "uzbek_meaning" VARCHAR(500) NOT NULL,
    "example_sentence" TEXT,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "lesson_vocabulary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_quiz_questions" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "type" "lesson_quiz_question_type" NOT NULL,
    "prompt" TEXT NOT NULL,
    "explanation" TEXT,
    "points" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "lesson_quiz_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_quiz_options" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "lesson_quiz_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_quiz_attempts" (
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
    "status" "lesson_quiz_attempt_status" NOT NULL DEFAULT 'IN_PROGRESS',

    CONSTRAINT "lesson_quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_quiz_answers" (
    "id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "submitted_answer" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "awarded_points" INTEGER NOT NULL,

    CONSTRAINT "lesson_quiz_answers_pkey" PRIMARY KEY ("id")
);

-- Constraints and indexes
ALTER TABLE "lesson_vocabulary" ADD CONSTRAINT "lesson_vocabulary_position_check" CHECK ("position" > 0);
ALTER TABLE "lesson_quiz_questions" ADD CONSTRAINT "lesson_quiz_questions_points_check" CHECK ("points" > 0);
ALTER TABLE "lesson_quiz_questions" ADD CONSTRAINT "lesson_quiz_questions_position_check" CHECK ("position" > 0);
ALTER TABLE "lesson_quiz_options" ADD CONSTRAINT "lesson_quiz_options_position_check" CHECK ("position" > 0);
ALTER TABLE "lesson_quiz_attempts" ADD CONSTRAINT "lesson_quiz_attempts_score_check" CHECK ("score" >= 0 AND "max_score" > 0 AND "score" <= "max_score");
ALTER TABLE "lesson_quiz_attempts" ADD CONSTRAINT "lesson_quiz_attempts_percentage_check" CHECK ("percentage" BETWEEN 0 AND 100);
ALTER TABLE "lesson_quiz_attempts" ADD CONSTRAINT "lesson_quiz_attempts_counts_check" CHECK ("correct_count" >= 0 AND "incorrect_count" >= 0);
ALTER TABLE "lesson_quiz_answers" ADD CONSTRAINT "lesson_quiz_answers_awarded_points_check" CHECK ("awarded_points" >= 0);

CREATE INDEX "lesson_vocabulary_lesson_id_deleted_at_position_idx" ON "lesson_vocabulary"("lesson_id", "deleted_at", "position");
CREATE INDEX "lesson_quiz_questions_lesson_id_deleted_at_position_idx" ON "lesson_quiz_questions"("lesson_id", "deleted_at", "position");
CREATE INDEX "lesson_quiz_options_question_id_position_idx" ON "lesson_quiz_options"("question_id", "position");
CREATE INDEX "lesson_quiz_attempts_enrollment_lesson_status_started_idx" ON "lesson_quiz_attempts"("enrollment_id", "lesson_id", "status", "started_at");
CREATE INDEX "lesson_quiz_attempts_lesson_status_submitted_idx" ON "lesson_quiz_attempts"("lesson_id", "status", "submitted_at");
CREATE UNIQUE INDEX "lesson_quiz_attempts_one_in_progress_idx" ON "lesson_quiz_attempts"("enrollment_id", "lesson_id") WHERE "status" = 'IN_PROGRESS';
CREATE UNIQUE INDEX "lesson_quiz_answers_attempt_id_question_id_key" ON "lesson_quiz_answers"("attempt_id", "question_id");
CREATE INDEX "lesson_quiz_answers_question_id_idx" ON "lesson_quiz_answers"("question_id");

-- Foreign keys
ALTER TABLE "lesson_vocabulary" ADD CONSTRAINT "lesson_vocabulary_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lesson_quiz_questions" ADD CONSTRAINT "lesson_quiz_questions_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lesson_quiz_options" ADD CONSTRAINT "lesson_quiz_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "lesson_quiz_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lesson_quiz_attempts" ADD CONSTRAINT "lesson_quiz_attempts_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "course_enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lesson_quiz_attempts" ADD CONSTRAINT "lesson_quiz_attempts_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lesson_quiz_answers" ADD CONSTRAINT "lesson_quiz_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "lesson_quiz_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lesson_quiz_answers" ADD CONSTRAINT "lesson_quiz_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "lesson_quiz_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

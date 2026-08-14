CREATE TYPE "level_final_exam_attempt_status" AS ENUM ('IN_PROGRESS', 'SUBMITTED');

CREATE TABLE "level_final_exams" (
  "id" UUID NOT NULL,
  "level" "course_level" NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "passing_percentage" INTEGER NOT NULL DEFAULT 75,
  "question_count" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "level_final_exams_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "level_final_exams_level_key" ON "level_final_exams"("level");
ALTER TABLE "level_final_exams"
  ADD CONSTRAINT "level_final_exams_passing_percentage_check" CHECK ("passing_percentage" BETWEEN 50 AND 100),
  ADD CONSTRAINT "level_final_exams_question_count_check" CHECK ("question_count" > 0);

CREATE TABLE "level_final_exam_questions" (
  "id" UUID NOT NULL,
  "exam_id" UUID NOT NULL,
  "source_question_id" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "deleted_at" TIMESTAMPTZ(3),
  CONSTRAINT "level_final_exam_questions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "level_final_exam_questions_exam_deleted_position_idx" ON "level_final_exam_questions"("exam_id", "deleted_at", "position");
CREATE INDEX "level_final_exam_questions_exam_deleted_source_idx" ON "level_final_exam_questions"("exam_id", "deleted_at", "source_question_id");
CREATE UNIQUE INDEX "level_final_exam_questions_active_source_key" ON "level_final_exam_questions"("exam_id", "source_question_id") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "level_final_exam_questions_active_position_key" ON "level_final_exam_questions"("exam_id", "position") WHERE "deleted_at" IS NULL;
ALTER TABLE "level_final_exam_questions"
  ADD CONSTRAINT "level_final_exam_questions_exam_id_fkey"
    FOREIGN KEY ("exam_id") REFERENCES "level_final_exams"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "level_final_exam_questions_source_question_id_fkey"
    FOREIGN KEY ("source_question_id") REFERENCES "lesson_quiz_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "level_final_exam_attempts" (
  "id" UUID NOT NULL,
  "exam_id" UUID NOT NULL,
  "enrollment_id" UUID NOT NULL,
  "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submitted_at" TIMESTAMPTZ(3),
  "score" INTEGER NOT NULL DEFAULT 0,
  "max_score" INTEGER NOT NULL,
  "percentage" INTEGER NOT NULL DEFAULT 0,
  "correct_count" INTEGER NOT NULL DEFAULT 0,
  "incorrect_count" INTEGER NOT NULL DEFAULT 0,
  "status" "level_final_exam_attempt_status" NOT NULL DEFAULT 'IN_PROGRESS',
  CONSTRAINT "level_final_exam_attempts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "level_final_exam_attempts_exam_enrollment_status_idx" ON "level_final_exam_attempts"("exam_id", "enrollment_id", "status", "started_at");
CREATE INDEX "level_final_exam_attempts_enrollment_submitted_idx" ON "level_final_exam_attempts"("enrollment_id", "submitted_at");
ALTER TABLE "level_final_exam_attempts"
  ADD CONSTRAINT "level_final_exam_attempts_exam_id_fkey"
    FOREIGN KEY ("exam_id") REFERENCES "level_final_exams"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "level_final_exam_attempts_enrollment_id_fkey"
    FOREIGN KEY ("enrollment_id") REFERENCES "course_enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "level_final_exam_answers" (
  "id" UUID NOT NULL,
  "attempt_id" UUID NOT NULL,
  "question_id" UUID NOT NULL,
  "submitted_answer" TEXT NOT NULL,
  "is_correct" BOOLEAN NOT NULL,
  "awarded_points" INTEGER NOT NULL,
  CONSTRAINT "level_final_exam_answers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "level_final_exam_answers_attempt_question_key" ON "level_final_exam_answers"("attempt_id", "question_id");
CREATE INDEX "level_final_exam_answers_question_idx" ON "level_final_exam_answers"("question_id");
ALTER TABLE "level_final_exam_answers"
  ADD CONSTRAINT "level_final_exam_answers_attempt_id_fkey"
    FOREIGN KEY ("attempt_id") REFERENCES "level_final_exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "level_final_exam_answers_question_id_fkey"
    FOREIGN KEY ("question_id") REFERENCES "level_final_exam_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TYPE "question_thread_status" AS ENUM ('OPEN', 'ANSWERED', 'CLOSED');

CREATE TABLE "question_threads" (
  "id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "teacher_id" UUID NOT NULL,
  "course_id" UUID NOT NULL,
  "lesson_id" UUID,
  "subject" VARCHAR(200),
  "status" "question_thread_status" NOT NULL DEFAULT 'OPEN',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "question_threads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "question_messages" (
  "id" UUID NOT NULL,
  "thread_id" UUID NOT NULL,
  "sender_id" UUID NOT NULL,
  "body" VARCHAR(5000) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "question_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "question_threads_student_id_updated_at_idx" ON "question_threads"("student_id", "updated_at");
CREATE INDEX "question_threads_teacher_id_status_updated_at_idx" ON "question_threads"("teacher_id", "status", "updated_at");
CREATE INDEX "question_threads_course_id_status_updated_at_idx" ON "question_threads"("course_id", "status", "updated_at");
CREATE INDEX "question_messages_thread_id_created_at_idx" ON "question_messages"("thread_id", "created_at", "id");
CREATE INDEX "question_messages_sender_id_created_at_idx" ON "question_messages"("sender_id", "created_at");

ALTER TABLE "question_threads"
  ADD CONSTRAINT "question_threads_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "question_threads_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "question_threads_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "question_threads_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "question_messages"
  ADD CONSTRAINT "question_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "question_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "question_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

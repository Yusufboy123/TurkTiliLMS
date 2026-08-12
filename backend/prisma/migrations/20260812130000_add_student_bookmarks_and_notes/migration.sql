CREATE TABLE "student_bookmarks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "lesson_id" UUID,
    "vocabulary_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "student_bookmarks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "student_bookmarks_one_target_check" CHECK (("lesson_id" IS NOT NULL)::int + ("vocabulary_id" IS NOT NULL)::int = 1)
);

CREATE UNIQUE INDEX "student_bookmarks_user_lesson_key" ON "student_bookmarks"("user_id", "lesson_id") WHERE "lesson_id" IS NOT NULL;
CREATE UNIQUE INDEX "student_bookmarks_user_vocabulary_key" ON "student_bookmarks"("user_id", "vocabulary_id") WHERE "vocabulary_id" IS NOT NULL;
CREATE INDEX "student_bookmarks_user_id_lesson_id_idx" ON "student_bookmarks"("user_id", "lesson_id");
CREATE INDEX "student_bookmarks_user_id_vocabulary_id_idx" ON "student_bookmarks"("user_id", "vocabulary_id");
CREATE INDEX "student_bookmarks_user_id_created_at_idx" ON "student_bookmarks"("user_id", "created_at");

CREATE TABLE "student_lesson_notes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "student_lesson_notes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "student_lesson_notes_user_id_lesson_id_key" ON "student_lesson_notes"("user_id", "lesson_id");
CREATE INDEX "student_lesson_notes_user_id_updated_at_idx" ON "student_lesson_notes"("user_id", "updated_at");

ALTER TABLE "student_bookmarks" ADD CONSTRAINT "student_bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_bookmarks" ADD CONSTRAINT "student_bookmarks_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_bookmarks" ADD CONSTRAINT "student_bookmarks_vocabulary_id_fkey" FOREIGN KEY ("vocabulary_id") REFERENCES "lesson_vocabulary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_lesson_notes" ADD CONSTRAINT "student_lesson_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_lesson_notes" ADD CONSTRAINT "student_lesson_notes_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

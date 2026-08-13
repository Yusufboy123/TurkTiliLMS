DROP INDEX "lesson_vocabulary_lesson_source_key";
CREATE UNIQUE INDEX "lesson_vocabulary_lesson_source_key"
  ON "lesson_vocabulary"("lesson_id", "source_id");

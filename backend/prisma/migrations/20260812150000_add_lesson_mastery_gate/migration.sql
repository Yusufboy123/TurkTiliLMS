ALTER TABLE "lessons"
  ADD COLUMN "mastery_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "mastery_passing_percentage" INTEGER NOT NULL DEFAULT 75;

ALTER TABLE "lessons"
  ADD CONSTRAINT "lessons_mastery_passing_percentage_check"
  CHECK ("mastery_passing_percentage" BETWEEN 50 AND 100);

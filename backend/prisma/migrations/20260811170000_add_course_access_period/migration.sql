ALTER TABLE "course_enrollments"
  ADD COLUMN "access_starts_at" TIMESTAMPTZ(3),
  ADD COLUMN "access_expires_at" TIMESTAMPTZ(3);

-- Existing enrollments receive a conservative three-month window from
-- migration time so historical records are not silently made unusable.
UPDATE "course_enrollments"
SET
  "access_starts_at" = COALESCE("started_at", "enrolled_at", "created_at", CURRENT_TIMESTAMP),
  "access_expires_at" = CURRENT_TIMESTAMP + INTERVAL '3 months'
WHERE "access_starts_at" IS NULL OR "access_expires_at" IS NULL;

ALTER TABLE "course_enrollments"
  ALTER COLUMN "access_starts_at" SET NOT NULL,
  ALTER COLUMN "access_expires_at" SET NOT NULL,
  ALTER COLUMN "access_starts_at" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "access_expires_at" SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '3 months');

CREATE INDEX "course_enrollments_student_status_access_expires_at_idx"
  ON "course_enrollments" ("student_id", "status", "access_expires_at");

CREATE INDEX "course_enrollments_course_status_access_expires_at_idx"
  ON "course_enrollments" ("course_id", "status", "access_expires_at");

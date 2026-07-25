CREATE TYPE "course_enrollment_status" AS ENUM (
    'ACTIVE',
    'COMPLETED',
    'CANCELLED',
    'SUSPENDED'
);

CREATE TYPE "course_enrollment_source" AS ENUM ('SELF', 'ADMIN');

CREATE TABLE "course_enrollments" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "status" "course_enrollment_status" NOT NULL DEFAULT 'ACTIVE',
    "source" "course_enrollment_source" NOT NULL,
    "enrolled_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "suspended_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "course_enrollments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "course_enrollments_lifecycle_timestamps_check" CHECK (
        ("status" = 'ACTIVE' AND "cancelled_at" IS NULL AND "completed_at" IS NULL AND "suspended_at" IS NULL)
        OR ("status" = 'SUSPENDED' AND "suspended_at" IS NOT NULL AND "cancelled_at" IS NULL AND "completed_at" IS NULL)
        OR ("status" = 'CANCELLED' AND "cancelled_at" IS NOT NULL AND "completed_at" IS NULL AND "suspended_at" IS NULL)
        OR ("status" = 'COMPLETED' AND "completed_at" IS NOT NULL AND "cancelled_at" IS NULL AND "suspended_at" IS NULL)
    ),
    CONSTRAINT "course_enrollments_source_creator_check" CHECK (
        ("source" = 'SELF' AND "created_by_id" IS NULL)
        OR ("source" = 'ADMIN' AND "created_by_id" IS NOT NULL)
    )
);

-- ACTIVE and SUSPENDED both represent a current membership. This stronger
-- partial key prevents a concurrent new ACTIVE row beside a suspended one while
-- still allowing cancelled history and an explicit later re-enrollment.
CREATE UNIQUE INDEX "course_enrollments_current_course_id_student_id_key"
ON "course_enrollments" ("course_id", "student_id")
WHERE "status" IN ('ACTIVE', 'SUSPENDED');

CREATE INDEX "course_enrollments_student_id_status_enrolled_at_idx"
ON "course_enrollments" ("student_id", "status", "enrolled_at");

CREATE INDEX "course_enrollments_course_id_status_enrolled_at_idx"
ON "course_enrollments" ("course_id", "status", "enrolled_at");

CREATE INDEX "course_enrollments_course_id_student_id_enrolled_at_idx"
ON "course_enrollments" ("course_id", "student_id", "enrolled_at");

CREATE INDEX "course_enrollments_created_by_id_idx"
ON "course_enrollments" ("created_by_id");

CREATE INDEX "course_enrollments_completed_at_idx"
ON "course_enrollments" ("completed_at");

CREATE INDEX "course_enrollments_created_at_idx"
ON "course_enrollments" ("created_at");

ALTER TABLE "course_enrollments"
ADD CONSTRAINT "course_enrollments_course_id_fkey"
FOREIGN KEY ("course_id") REFERENCES "courses"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "course_enrollments"
ADD CONSTRAINT "course_enrollments_student_id_fkey"
FOREIGN KEY ("student_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "course_enrollments"
ADD CONSTRAINT "course_enrollments_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

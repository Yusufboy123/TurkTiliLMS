CREATE TABLE "groups" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "level" "course_level" NOT NULL,
    "teacher_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "group_students" (
    "group_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_students_pkey" PRIMARY KEY ("group_id", "student_id")
);

CREATE INDEX "groups_teacher_id_updated_at_idx" ON "groups"("teacher_id", "updated_at");
CREATE INDEX "groups_created_by_id_idx" ON "groups"("created_by_id");
CREATE INDEX "group_students_student_id_joined_at_idx" ON "group_students"("student_id", "joined_at");

ALTER TABLE "groups" ADD CONSTRAINT "groups_teacher_id_fkey"
  FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "groups" ADD CONSTRAINT "groups_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "group_students" ADD CONSTRAINT "group_students_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "group_students" ADD CONSTRAINT "group_students_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

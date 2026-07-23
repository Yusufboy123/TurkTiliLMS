-- CreateEnum
CREATE TYPE "lesson_type" AS ENUM ('TEXT', 'VIDEO', 'AUDIO', 'PDF', 'QUIZ', 'ASSIGNMENT', 'LIVE');

-- CreateEnum
CREATE TYPE "lesson_status" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "course_sections" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "course_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "summary" TEXT,
    "content" TEXT,
    "lesson_type" "lesson_type" NOT NULL,
    "position" INTEGER NOT NULL,
    "duration_minutes" INTEGER,
    "is_preview" BOOLEAN NOT NULL DEFAULT false,
    "status" "lesson_status" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" UUID NOT NULL,
    "teacher_id" UUID,
    "published_at" TIMESTAMPTZ(3),
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_sections_course_id_deleted_at_position_idx" ON "course_sections"("course_id", "deleted_at", "position");

-- CreateIndex
CREATE INDEX "course_sections_course_id_is_published_deleted_at_idx" ON "course_sections"("course_id", "is_published", "deleted_at");

-- CreateIndex
CREATE INDEX "course_sections_created_by_id_idx" ON "course_sections"("created_by_id");

-- CreateIndex
CREATE INDEX "course_sections_deleted_at_idx" ON "course_sections"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "course_sections_id_course_id_key" ON "course_sections"("id", "course_id");

-- Active rows must have a stable, gap-free sibling position. Deleted rows keep
-- their former position for audit/history without blocking active reordering.
CREATE UNIQUE INDEX "course_sections_course_id_position_active_key"
ON "course_sections"("course_id", "position")
WHERE "deleted_at" IS NULL;

-- CreateIndex
CREATE INDEX "lessons_course_id_status_deleted_at_idx" ON "lessons"("course_id", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "lessons_section_id_deleted_at_position_idx" ON "lessons"("section_id", "deleted_at", "position");

-- CreateIndex
CREATE INDEX "lessons_teacher_id_status_deleted_at_idx" ON "lessons"("teacher_id", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "lessons_lesson_type_status_deleted_at_idx" ON "lessons"("lesson_type", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "lessons_created_by_id_idx" ON "lessons"("created_by_id");

-- CreateIndex
CREATE INDEX "lessons_deleted_at_idx" ON "lessons"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_course_id_slug_key" ON "lessons"("course_id", "slug");

-- The partial index preserves per-section ordering while allowing soft-deleted
-- lessons to retain their historical position until restoration.
CREATE UNIQUE INDEX "lessons_section_id_position_active_key"
ON "lessons"("section_id", "position")
WHERE "deleted_at" IS NULL;

-- AddForeignKey
ALTER TABLE "course_sections" ADD CONSTRAINT "course_sections_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_sections" ADD CONSTRAINT "course_sections_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_section_id_course_id_fkey" FOREIGN KEY ("section_id", "course_id") REFERENCES "course_sections"("id", "course_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

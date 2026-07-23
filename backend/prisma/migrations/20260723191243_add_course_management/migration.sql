-- CreateEnum
CREATE TYPE "course_level" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');

-- CreateEnum
CREATE TYPE "course_status" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "short_description" VARCHAR(500),
    "description" TEXT,
    "cover_image_url" TEXT,
    "content_language" VARCHAR(35) NOT NULL DEFAULT 'tr',
    "level" "course_level",
    "status" "course_status" NOT NULL DEFAULT 'DRAFT',
    "created_by_user_id" UUID NOT NULL,
    "teacher_id" UUID,
    "estimated_duration_minutes" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ(3),
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "courses_slug_key" ON "courses"("slug");

-- CreateIndex
CREATE INDEX "courses_status_deleted_at_sort_order_idx" ON "courses"("status", "deleted_at", "sort_order");

-- CreateIndex
CREATE INDEX "courses_teacher_id_status_deleted_at_idx" ON "courses"("teacher_id", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "courses_created_by_user_id_idx" ON "courses"("created_by_user_id");

-- CreateIndex
CREATE INDEX "courses_level_status_deleted_at_idx" ON "courses"("level", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "courses_is_featured_status_deleted_at_idx" ON "courses"("is_featured", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "courses_content_language_status_deleted_at_idx" ON "courses"("content_language", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "courses_published_at_idx" ON "courses"("published_at");

-- CreateIndex
CREATE INDEX "courses_deleted_at_idx" ON "courses"("deleted_at");

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

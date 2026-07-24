-- CreateEnum
CREATE TYPE "lesson_content_block_type" AS ENUM ('TEXT', 'VIDEO', 'AUDIO', 'PDF', 'DOCUMENT', 'IMAGE', 'LINK', 'DOWNLOAD');

-- CreateTable
CREATE TABLE "lesson_content_blocks" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "block_type" "lesson_content_block_type" NOT NULL,
    "title" VARCHAR(200),
    "description" TEXT,
    "position" INTEGER NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "text_content" TEXT,
    "source_url" TEXT,
    "external_provider" VARCHAR(100),
    "file_name" VARCHAR(255),
    "original_file_name" VARCHAR(255),
    "file_url" TEXT,
    "mime_type" VARCHAR(160),
    "file_size_bytes" BIGINT,
    "duration_seconds" INTEGER,
    "thumbnail_url" TEXT,
    "metadata" JSONB,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "lesson_content_blocks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "lesson_content_blocks_position_positive_check" CHECK ("position" > 0),
    CONSTRAINT "lesson_content_blocks_file_size_positive_check" CHECK ("file_size_bytes" IS NULL OR "file_size_bytes" > 0),
    CONSTRAINT "lesson_content_blocks_duration_positive_check" CHECK ("duration_seconds" IS NULL OR "duration_seconds" > 0),
    CONSTRAINT "lesson_content_blocks_required_content_check" CHECK (
        ("block_type" = 'TEXT' AND "text_content" IS NOT NULL) OR
        ("block_type" IN ('VIDEO', 'AUDIO') AND ("file_url" IS NOT NULL OR "source_url" IS NOT NULL)) OR
        ("block_type" IN ('PDF', 'DOCUMENT', 'IMAGE', 'DOWNLOAD') AND "file_url" IS NOT NULL) OR
        ("block_type" = 'LINK' AND "source_url" IS NOT NULL)
    )
);

-- CreateIndex
CREATE INDEX "lesson_content_blocks_lesson_id_deleted_at_position_idx" ON "lesson_content_blocks"("lesson_id", "deleted_at", "position");

-- CreateIndex
CREATE INDEX "lesson_content_blocks_lesson_id_block_type_deleted_at_idx" ON "lesson_content_blocks"("lesson_id", "block_type", "deleted_at");

-- CreateIndex
CREATE INDEX "lesson_blocks_lesson_visibility_position_idx" ON "lesson_content_blocks"("lesson_id", "is_visible", "deleted_at", "position");

-- CreateIndex
CREATE INDEX "lesson_content_blocks_created_by_id_idx" ON "lesson_content_blocks"("created_by_id");

-- CreateIndex
CREATE INDEX "lesson_content_blocks_deleted_at_idx" ON "lesson_content_blocks"("deleted_at");

-- Soft-deleted blocks retain their historical position without blocking the
-- contiguous ordering of active lesson content.
CREATE UNIQUE INDEX "lesson_content_blocks_lesson_id_position_active_key"
ON "lesson_content_blocks"("lesson_id", "position")
WHERE "deleted_at" IS NULL;

-- AddForeignKey
ALTER TABLE "lesson_content_blocks" ADD CONSTRAINT "lesson_content_blocks_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_content_blocks" ADD CONSTRAINT "lesson_content_blocks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

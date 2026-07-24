-- AddColumn
ALTER TABLE "lesson_content_blocks"
ADD COLUMN "media_file_id" UUID;

-- CreateIndex
CREATE INDEX "lesson_content_blocks_media_file_id_idx"
ON "lesson_content_blocks"("media_file_id");

-- AddForeignKey
-- RESTRICT deliberately prevents a future hard delete from orphaning content.
ALTER TABLE "lesson_content_blocks"
ADD CONSTRAINT "lesson_content_blocks_media_file_id_fkey"
FOREIGN KEY ("media_file_id") REFERENCES "media_files"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

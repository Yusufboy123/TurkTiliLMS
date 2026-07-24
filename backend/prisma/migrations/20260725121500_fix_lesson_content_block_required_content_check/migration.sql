-- Module 6.2 moved binary lesson content ownership to MediaFile. The previous
-- constraint still required duplicated legacy URL fields and rejected valid
-- media-backed blocks.
ALTER TABLE "lesson_content_blocks"
DROP CONSTRAINT "lesson_content_blocks_required_content_check";

-- NOT VALID deliberately preserves pre-Module-6.2 binary rows that still use
-- legacy URL fields. PostgreSQL still enforces this exact rule for every new or
-- updated row. After legacy rows are linked to MediaFile, a later reviewed
-- migration can run VALIDATE CONSTRAINT without changing this definition.
ALTER TABLE "lesson_content_blocks"
ADD CONSTRAINT "lesson_content_blocks_required_content_check"
CHECK (
    (
        "block_type" = 'TEXT'
        AND "text_content" IS NOT NULL
        AND "media_file_id" IS NULL
    )
    OR (
        "block_type" = 'LINK'
        AND "source_url" IS NOT NULL
        AND "media_file_id" IS NULL
    )
    OR (
        "block_type" IN ('IMAGE', 'VIDEO', 'AUDIO', 'PDF', 'DOCUMENT', 'DOWNLOAD')
        AND "media_file_id" IS NOT NULL
    )
)
NOT VALID;

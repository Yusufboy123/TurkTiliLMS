-- CreateEnum
CREATE TYPE "media_category" AS ENUM ('IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO');

-- CreateEnum
CREATE TYPE "media_storage_provider" AS ENUM ('LOCAL');

-- CreateTable
CREATE TABLE "media_files" (
    "id" UUID NOT NULL,
    "original_file_name" VARCHAR(255) NOT NULL,
    "stored_file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(160) NOT NULL,
    "extension" VARCHAR(16) NOT NULL,
    "category" "media_category" NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "storage_path" VARCHAR(512) NOT NULL,
    "storage_provider" "media_storage_provider" NOT NULL DEFAULT 'LOCAL',
    "checksum" CHAR(64),
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "media_files_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "media_files_size_bytes_positive_check" CHECK ("size_bytes" > 0),
    CONSTRAINT "media_files_extension_lowercase_check" CHECK ("extension" = lower("extension")),
    CONSTRAINT "media_files_checksum_sha256_check" CHECK ("checksum" IS NULL OR "checksum" ~ '^[0-9a-f]{64}$')
);

-- CreateIndex
CREATE UNIQUE INDEX "media_files_stored_file_name_key" ON "media_files"("stored_file_name");

-- CreateIndex
CREATE UNIQUE INDEX "media_files_storage_path_key" ON "media_files"("storage_path");

-- CreateIndex
CREATE INDEX "media_files_uploaded_by_id_deleted_at_created_at_idx"
ON "media_files"("uploaded_by_id", "deleted_at", "created_at");

-- CreateIndex
CREATE INDEX "media_files_category_deleted_at_created_at_idx"
ON "media_files"("category", "deleted_at", "created_at");

-- CreateIndex
CREATE INDEX "media_files_checksum_idx" ON "media_files"("checksum");

-- CreateIndex
CREATE INDEX "media_files_deleted_at_idx" ON "media_files"("deleted_at");

-- AddForeignKey
ALTER TABLE "media_files"
ADD CONSTRAINT "media_files_uploaded_by_id_fkey"
FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

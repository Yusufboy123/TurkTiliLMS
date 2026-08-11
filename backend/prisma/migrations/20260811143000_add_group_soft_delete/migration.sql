ALTER TABLE "groups" ADD COLUMN "deleted_at" TIMESTAMPTZ(3);

CREATE INDEX "groups_deleted_at_idx" ON "groups"("deleted_at");

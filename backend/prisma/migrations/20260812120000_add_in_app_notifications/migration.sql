CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" VARCHAR(1000) NOT NULL,
    "target_url" VARCHAR(500),
    "read_at" TIMESTAMPTZ(3),
    "dedupe_key" VARCHAR(200),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notifications_user_id_dedupe_key_key" ON "notifications"("user_id", "dedupe_key");
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

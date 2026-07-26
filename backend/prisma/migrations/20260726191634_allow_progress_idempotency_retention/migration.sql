-- DropForeignKey
ALTER TABLE "progress_events" DROP CONSTRAINT "progress_events_idempotency_record_id_fkey";

-- AddForeignKey
ALTER TABLE "progress_events" ADD CONSTRAINT "progress_events_idempotency_record_id_fkey" FOREIGN KEY ("idempotency_record_id") REFERENCES "idempotency_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

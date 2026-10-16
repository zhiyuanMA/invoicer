-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID');

-- Add the new columns first, so existing rows can be filled in before "templateId" is dropped.
ALTER TABLE "invoices"
ADD COLUMN     "dueDate" TEXT,
ADD COLUMN     "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT';

-- Backfill: the due date is copied out of the snapshot into its own column (for filtering) ...
UPDATE "invoices" SET "dueDate" = "content" ->> 'dueDate';

-- ... and the template moves into the snapshot, which now holds the whole design.
UPDATE "invoices" SET "content" = jsonb_set("content", '{template}', to_jsonb("templateId"));

-- DropColumn
ALTER TABLE "invoices" DROP COLUMN "templateId";

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

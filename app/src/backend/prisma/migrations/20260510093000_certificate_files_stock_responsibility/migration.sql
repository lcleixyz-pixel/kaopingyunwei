-- Certificate file-flow and stock responsibility extension.

ALTER TABLE "certificates" ADD COLUMN "certDisplayIssueDate" DATETIME;

ALTER TABLE "certificate_supply_requests" ADD COLUMN "blankCertQuantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "certificate_supply_requests" ADD COLUMN "shellQuantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "certificate_supply_requests" ADD COLUMN "responsiblePerson" TEXT;
ALTER TABLE "certificate_supply_requests" ADD COLUMN "contactName" TEXT;
ALTER TABLE "certificate_supply_requests" ADD COLUMN "contactPhone" TEXT;
ALTER TABLE "certificate_supply_requests" ADD COLUMN "mailingAddress" TEXT;

UPDATE "certificate_supply_requests"
SET
  "blankCertQuantity" = CASE WHEN "itemType" = 'BLANK_CERT' THEN "quantity" ELSE 0 END,
  "shellQuantity" = CASE WHEN "itemType" = 'CERT_SHELL' THEN "quantity" ELSE 0 END
WHERE "blankCertQuantity" = 0 AND "shellQuantity" = 0;

ALTER TABLE "certificate_stock_ledgers" ADD COLUMN "availableBalanceAfter" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "certificate_stock_ledgers" ADD COLUMN "pendingDestroyBalanceAfter" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "certificate_stock_ledgers" ADD COLUMN "responsiblePerson" TEXT NOT NULL DEFAULT '历史记录';

UPDATE "certificate_stock_ledgers"
SET "availableBalanceAfter" = "balanceAfter"
WHERE "availableBalanceAfter" = 0;

ALTER TABLE "certificate_print_records" ADD COLUMN "actualPrintedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "certificate_print_records" ADD COLUMN "responsiblePerson" TEXT NOT NULL DEFAULT '历史记录';

UPDATE "certificate_print_records"
SET "actualPrintedCount" = "blankCertUsed" - "blankCertReturned" - "blankCertVoided"
WHERE "actualPrintedCount" = 0;

ALTER TABLE "certificate_void_records" ADD COLUMN "responsiblePerson" TEXT NOT NULL DEFAULT '历史记录';
ALTER TABLE "certificate_destroy_batches" ADD COLUMN "responsiblePerson" TEXT;
ALTER TABLE "certificate_reissue_requests" ADD COLUMN "responsiblePerson" TEXT;
ALTER TABLE "certificate_stocktakes" ADD COLUMN "responsiblePerson" TEXT NOT NULL DEFAULT '历史记录';

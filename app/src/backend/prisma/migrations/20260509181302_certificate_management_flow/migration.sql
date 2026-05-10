-- CreateTable
CREATE TABLE "certificate_supply_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedBy" TEXT,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "dispatchedBy" TEXT,
    "dispatchedAt" DATETIME,
    "receivedBy" TEXT,
    "receivedAt" DATETIME,
    "notes" TEXT,
    "rejectReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "certificate_supply_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "certificate_stock_ledgers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "movementType" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "certificate_stock_ledgers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "certificate_print_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "passedCount" INTEGER NOT NULL,
    "blankCertUsed" INTEGER NOT NULL DEFAULT 0,
    "shellUsed" INTEGER NOT NULL DEFAULT 0,
    "blankCertReturned" INTEGER NOT NULL DEFAULT 0,
    "shellReturned" INTEGER NOT NULL DEFAULT 0,
    "blankCertVoided" INTEGER NOT NULL DEFAULT 0,
    "shellVoided" INTEGER NOT NULL DEFAULT 0,
    "overrideReason" TEXT,
    "verificationJson" TEXT,
    "notes" TEXT,
    "handledBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "certificate_print_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "certificate_print_records_planId_fkey" FOREIGN KEY ("planId") REFERENCES "exam_plans" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "certificate_void_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT,
    "certificateId" TEXT,
    "itemType" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_DESTROY',
    "destroyBatchId" TEXT,
    "recordedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "certificate_void_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "certificate_void_records_planId_fkey" FOREIGN KEY ("planId") REFERENCES "exam_plans" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "certificate_void_records_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "certificates" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "certificate_void_records_destroyBatchId_fkey" FOREIGN KEY ("destroyBatchId") REFERENCES "certificate_destroy_batches" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "certificate_destroy_batches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdBy" TEXT,
    "closedBy" TEXT,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "certificate_destroy_batches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "certificate_reissue_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT,
    "candidateId" TEXT,
    "certificateId" TEXT,
    "applicantName" TEXT NOT NULL,
    "applicantPhone" TEXT,
    "applicantIdCard" TEXT,
    "certNo" TEXT,
    "reason" TEXT NOT NULL,
    "mailingAddress" TEXT,
    "feeCents" INTEGER NOT NULL DEFAULT 20000,
    "mailingFeeCents" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "reviewNotes" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "reviewDueAt" DATETIME NOT NULL,
    "remakeDueAt" DATETIME,
    "issuedAt" DATETIME,
    "issuedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "certificate_reissue_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "certificate_reissue_requests_planId_fkey" FOREIGN KEY ("planId") REFERENCES "exam_plans" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "certificate_reissue_requests_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "certificate_reissue_requests_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "certificates" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "certificate_stocktakes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "stocktakeType" TEXT NOT NULL,
    "bookBalance" INTEGER NOT NULL,
    "actualQuantity" INTEGER NOT NULL,
    "variance" INTEGER NOT NULL,
    "notes" TEXT,
    "handledBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "certificate_stocktakes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "certificate_attachments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER NOT NULL,
    "uploadedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "certificate_attachments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_certificates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT NOT NULL,
    "certNo" TEXT NOT NULL,
    "certNoSource" TEXT NOT NULL DEFAULT 'LEGACY_AUTO',
    "issueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "issuedBy" TEXT,
    "printedAt" DATETIME,
    "issuedAt" DATETIME,
    "deliveryMethod" TEXT,
    "receiverName" TEXT,
    "receiverPhone" TEXT,
    "mailingAddress" TEXT,
    "trackingNo" TEXT,
    "printBatchNo" TEXT,
    "verificationJson" TEXT,
    "issueNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "certificates_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_certificates" ("candidateId", "certNo", "createdAt", "id", "issueDate", "issuedBy", "status", "updatedAt") SELECT "candidateId", "certNo", "createdAt", "id", "issueDate", "issuedBy", "status", "updatedAt" FROM "certificates";
DROP TABLE "certificates";
ALTER TABLE "new_certificates" RENAME TO "certificates";
CREATE UNIQUE INDEX "certificates_candidateId_key" ON "certificates"("candidateId");
CREATE UNIQUE INDEX "certificates_certNo_key" ON "certificates"("certNo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "certificate_supply_requests_tenantId_status_idx" ON "certificate_supply_requests"("tenantId", "status");

-- CreateIndex
CREATE INDEX "certificate_stock_ledgers_tenantId_itemType_createdAt_idx" ON "certificate_stock_ledgers"("tenantId", "itemType", "createdAt");

-- CreateIndex
CREATE INDEX "certificate_print_records_tenantId_planId_createdAt_idx" ON "certificate_print_records"("tenantId", "planId", "createdAt");

-- CreateIndex
CREATE INDEX "certificate_void_records_tenantId_status_idx" ON "certificate_void_records"("tenantId", "status");

-- CreateIndex
CREATE INDEX "certificate_destroy_batches_tenantId_status_idx" ON "certificate_destroy_batches"("tenantId", "status");

-- CreateIndex
CREATE INDEX "certificate_reissue_requests_tenantId_status_idx" ON "certificate_reissue_requests"("tenantId", "status");

-- CreateIndex
CREATE INDEX "certificate_stocktakes_tenantId_stocktakeType_createdAt_idx" ON "certificate_stocktakes"("tenantId", "stocktakeType", "createdAt");

-- CreateIndex
CREATE INDEX "certificate_attachments_tenantId_entityType_entityId_idx" ON "certificate_attachments"("tenantId", "entityType", "entityId");

-- Archive certificate report batches for headquarters submission.

CREATE TABLE "archive_report_batches" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "batchNo" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "uploadDate" DATETIME NOT NULL,
  "dataType" TEXT NOT NULL DEFAULT '新增',
  "unitLeader" TEXT NOT NULL,
  "informationManager" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "recordCount" INTEGER NOT NULL DEFAULT 0,
  "summarySnapshotJson" TEXT,
  "signedFilePath" TEXT,
  "signedOriginalName" TEXT,
  "signedMimeType" TEXT,
  "signedFileSize" INTEGER,
  "dataSnapshotPath" TEXT,
  "dataSnapshotSize" INTEGER,
  "dataSnapshotHash" TEXT,
  "submittedBy" TEXT,
  "submittedAt" DATETIME,
  "reviewedBy" TEXT,
  "reviewedAt" DATETIME,
  "reviewNotes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "archive_report_batches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "archive_report_batch_plans" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "batchId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "archive_report_batch_plans_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "archive_report_batches" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "archive_report_batch_plans_planId_fkey" FOREIGN KEY ("planId") REFERENCES "exam_plans" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "archive_report_batches_tenantId_batchNo_key" ON "archive_report_batches" ("tenantId", "batchNo");
CREATE INDEX "archive_report_batches_tenantId_status_createdAt_idx" ON "archive_report_batches" ("tenantId", "status", "createdAt");
CREATE UNIQUE INDEX "archive_report_batch_plans_batchId_planId_key" ON "archive_report_batch_plans" ("batchId", "planId");
CREATE INDEX "archive_report_batch_plans_planId_idx" ON "archive_report_batch_plans" ("planId");

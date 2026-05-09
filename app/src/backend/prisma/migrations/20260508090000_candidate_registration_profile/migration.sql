-- CreateTable
CREATE TABLE "candidate_registration_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT NOT NULL,
    "fieldsJson" TEXT NOT NULL DEFAULT '{}',
    "materialsJson" TEXT NOT NULL DEFAULT '{}',
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "candidate_registration_profiles_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "local_upload_batches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "local_upload_batches_planId_fkey" FOREIGN KEY ("planId") REFERENCES "exam_plans" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "candidate_registration_profiles_candidateId_key" ON "candidate_registration_profiles"("candidateId");

-- CreateIndex
CREATE INDEX "local_upload_batches_planId_uploadedAt_idx" ON "local_upload_batches"("planId", "uploadedAt");

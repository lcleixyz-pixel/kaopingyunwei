-- Redefine the Phase 1 plan fields and add branch-internal prospective candidates.
-- Existing local/demo data is reset separately; defaults here keep migration safe on non-empty SQLite files.

ALTER TABLE "exam_plans" ADD COLUMN "occupation" TEXT NOT NULL DEFAULT '贵金属首饰与宝玉石检测员';
ALTER TABLE "exam_plans" ADD COLUMN "registrationDeadline" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00';

CREATE TABLE "prospective_candidates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "intendedOccupation" TEXT,
    "intendedProfession" TEXT,
    "intendedLevel" TEXT,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'FOLLOWING',
    "notes" TEXT,
    "convertedCandidateId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "prospective_candidates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "prospective_candidates_convertedCandidateId_fkey" FOREIGN KEY ("convertedCandidateId") REFERENCES "candidates" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "prospective_candidates_convertedCandidateId_key" ON "prospective_candidates"("convertedCandidateId");
CREATE INDEX "prospective_candidates_tenantId_status_idx" ON "prospective_candidates"("tenantId", "status");
CREATE INDEX "prospective_candidates_tenantId_phone_idx" ON "prospective_candidates"("tenantId", "phone");

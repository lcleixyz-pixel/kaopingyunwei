/*
  Warnings:

  - You are about to drop the column `examType` on the `exam_plans` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_exam_plans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "occupation" TEXT NOT NULL,
    "examDate" DATETIME NOT NULL,
    "registrationDeadline" DATETIME NOT NULL,
    "profession" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "maxCandidates" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "exam_plans_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_exam_plans" ("createdAt", "createdBy", "examDate", "id", "level", "location", "maxCandidates", "notes", "occupation", "profession", "registrationDeadline", "status", "tenantId", "title", "updatedAt") SELECT "createdAt", "createdBy", "examDate", "id", "level", "location", "maxCandidates", "notes", "occupation", "profession", "registrationDeadline", "status", "tenantId", "title", "updatedAt" FROM "exam_plans";
DROP TABLE "exam_plans";
ALTER TABLE "new_exam_plans" RENAME TO "exam_plans";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

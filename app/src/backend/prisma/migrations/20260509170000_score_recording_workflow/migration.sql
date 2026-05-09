ALTER TABLE "scores" ADD COLUMN "comprehensiveScore" REAL;
ALTER TABLE "scores" ADD COLUMN "workPerformanceScore" REAL;
ALTER TABLE "scores" ADD COLUMN "theoryAbsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "scores" ADD COLUMN "practiceAbsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "scores" ADD COLUMN "comprehensiveAbsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "scores" ADD COLUMN "workPerformanceAbsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "scores" ADD COLUMN "resultStatus" TEXT NOT NULL DEFAULT 'INCOMPLETE';
ALTER TABLE "scores" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "scores" ADD COLUMN "sourceFileName" TEXT;

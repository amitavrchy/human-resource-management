ALTER TABLE "Job" ADD COLUMN "hiringManagerId" TEXT;
CREATE INDEX "Job_organizationId_hiringManagerId_idx" ON "Job"("organizationId", "hiringManagerId");

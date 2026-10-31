ALTER TABLE "OnboardingTemplate" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;
UPDATE "OnboardingTemplate" SET "isDefault" = true WHERE "id" IN (
  SELECT DISTINCT ON ("organizationId") "id" FROM "OnboardingTemplate" ORDER BY "organizationId", "id"
);
CREATE UNIQUE INDEX "OnboardingTemplate_one_default_per_org" ON "OnboardingTemplate"("organizationId") WHERE "isDefault" = true;
ALTER TABLE "Employee" DROP CONSTRAINT "Employee_departmentId_fkey";
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Employee" DROP CONSTRAINT "Employee_locationId_fkey";
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

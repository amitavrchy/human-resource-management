CREATE TABLE "JobTemplate" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "department" TEXT NOT NULL,
  "descriptionMd" TEXT NOT NULL,
  CONSTRAINT "JobTemplate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JobTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "JobTemplate_organizationId_name_key" ON "JobTemplate"("organizationId", "name");

-- DropIndex
DROP INDEX "Facility_organizationId_idx";

-- CreateIndex
CREATE INDEX "Facility_organizationId_createdAt_idx" ON "Facility"("organizationId", "createdAt" DESC);

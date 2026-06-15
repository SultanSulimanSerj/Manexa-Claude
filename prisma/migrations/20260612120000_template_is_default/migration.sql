-- AlterTable
ALTER TABLE "DocumentTemplate" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "DocumentTemplate_companyId_category_isDefault_idx" ON "DocumentTemplate"("companyId", "category", "isDefault");

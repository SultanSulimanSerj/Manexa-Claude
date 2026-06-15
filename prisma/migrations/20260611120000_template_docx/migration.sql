-- CreateEnum
CREATE TYPE "TemplateCategory" AS ENUM ('CONTRACT', 'COMMERCIAL_OFFER');

-- CreateEnum
CREATE TYPE "TemplateFileType" AS ENUM ('DOCX', 'HTML');

-- AlterTable
ALTER TABLE "DocumentTemplate" ADD COLUMN "category" "TemplateCategory" NOT NULL DEFAULT 'CONTRACT';
ALTER TABLE "DocumentTemplate" ADD COLUMN "fileType" "TemplateFileType" NOT NULL DEFAULT 'DOCX';
ALTER TABLE "DocumentTemplate" ADD COLUMN "filePath" TEXT;
ALTER TABLE "DocumentTemplate" ADD COLUMN "creatorId" TEXT;
ALTER TABLE "DocumentTemplate" ALTER COLUMN "content" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "DocumentTemplate_companyId_category_idx" ON "DocumentTemplate"("companyId", "category");

-- Печать и подпись компании + флаги на документе
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "stampFilePath" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "stampMimeType" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "signatureFilePath" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "signatureMimeType" TEXT;

ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "includeStampOnExport" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "includeSignatureOnExport" BOOLEAN NOT NULL DEFAULT false;

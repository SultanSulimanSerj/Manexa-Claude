import { getFileBuffer } from '@/lib/storage'
import { applyBrandingToDocx } from './docx-branding'
import { applyBrandingToXlsx } from './xlsx-branding'
import { resolveXlsxBrandingCategory } from './anchors'

async function normalizeImageAsset(
  buffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (!mimeType.includes('webp')) {
    return { buffer, mimeType }
  }
  try {
    const sharp = (await import('sharp')).default
    const png = await sharp(buffer).png().toBuffer()
    return { buffer: png, mimeType: 'image/png' }
  } catch (err) {
    console.error('WebP conversion failed, using original buffer:', err)
    return { buffer, mimeType: 'image/png' }
  }
}

export interface CompanyBrandingAssets {
  stamp?: { buffer: Buffer; mimeType: string } | null
  signature?: { buffer: Buffer; mimeType: string } | null
}

export interface ApplyBrandingParams {
  buffer: Buffer
  mimeType: string
  documentCategory: string | null | undefined
  branding: CompanyBrandingAssets
  includeStamp: boolean
  includeSignature: boolean
}

export async function loadCompanyBrandingAssets(company: {
  stampFilePath?: string | null
  stampMimeType?: string | null
  signatureFilePath?: string | null
  signatureMimeType?: string | null
}): Promise<CompanyBrandingAssets> {
  const result: CompanyBrandingAssets = {}

  if (company.stampFilePath) {
    const raw = await getFileBuffer(company.stampFilePath)
    const mimeType = company.stampMimeType || 'image/png'
    result.stamp = await normalizeImageAsset(raw, mimeType)
  }
  if (company.signatureFilePath) {
    const raw = await getFileBuffer(company.signatureFilePath)
    const mimeType = company.signatureMimeType || 'image/png'
    result.signature = await normalizeImageAsset(raw, mimeType)
  }

  return result
}

export async function applyBrandingToDocumentBuffer(
  params: ApplyBrandingParams
): Promise<Buffer> {
  const { buffer, mimeType, documentCategory, branding, includeStamp, includeSignature } = params

  const stamp =
    includeStamp && branding.stamp?.buffer
      ? { buffer: branding.stamp.buffer, mimeType: branding.stamp.mimeType }
      : null
  const signature =
    includeSignature && branding.signature?.buffer
      ? { buffer: branding.signature.buffer, mimeType: branding.signature.mimeType }
      : null

  if (!stamp && !signature) return buffer

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType.includes('spreadsheet')
  ) {
    const category = resolveXlsxBrandingCategory(documentCategory)
    if (!category) return buffer
    return applyBrandingToXlsx(buffer, category, { stamp, signature })
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType.includes('wordprocessingml')
  ) {
    return applyBrandingToDocx(buffer, { stamp, signature, documentCategory })
  }

  return buffer
}

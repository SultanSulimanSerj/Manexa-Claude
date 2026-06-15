const DOCX_ZIP_MAGIC = [0x50, 0x4b] // PK

export function isValidDocxBuffer(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 4) return false
  return buffer[0] === DOCX_ZIP_MAGIC[0] && buffer[1] === DOCX_ZIP_MAGIC[1]
}

export function assertValidDocxBuffer(buffer: Buffer, context = 'DOCX'): void {
  if (!buffer || buffer.length === 0) {
    throw new Error(`${context}: файл пустой. Загрузите корректный .docx`)
  }
  if (!isValidDocxBuffer(buffer)) {
    throw new Error(
      `${context}: файл повреждён или не является DOCX (нужен формат Word .docx, не .doc)`
    )
  }
}

export const DOCX_CORRUPT_MESSAGE =
  'Файл шаблона повреждён или пустой. Загрузите документ заново через «Заменить файл».'

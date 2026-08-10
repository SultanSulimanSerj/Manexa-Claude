// Единая валидация загружаемых файлов (вложения задач/согласований/документов).

export const MAX_UPLOAD_BYTES = 40 * 1024 * 1024 // 40 МБ

/** MIME-типы, безопасные для отдачи с Content-Disposition: inline (не исполняют скрипты).
 *  SVG/HTML сюда НЕ входят намеренно — они отдаются только как attachment (защита от XSS). */
export const INLINE_SAFE_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/bmp',
])

export function isInlineSafeMime(mime: string | null | undefined): boolean {
  return !!mime && INLINE_SAFE_MIME.has(mime.toLowerCase())
}

/** Проверяет размер/наличие файла. Возвращает текст ошибки или null. */
export function validateUploadFile(file: File | null): string | null {
  if (!file) return 'Файл обязателен'
  if (file.size === 0) return 'Файл пустой'
  if (file.size > MAX_UPLOAD_BYTES) {
    return `Файл слишком большой. Максимум ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} МБ`
  }
  return null
}

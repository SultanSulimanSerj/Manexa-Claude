/**
 * Безопасная отдача пользовательских файлов.
 *
 * Защита от stored-XSS: только «безопасные» типы можно показывать inline
 * (картинки/PDF). Всё остальное (svg, html, js, xml, неизвестное) —
 * принудительно attachment (скачивание), чтобы браузер не исполнял контент
 * в origin приложения. Плюс X-Content-Type-Options: nosniff, чтобы браузер
 * не «доугадывал» тип вопреки заголовку.
 */

// SVG намеренно НЕ в списке — может содержать <script>.
const INLINE_SAFE_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/heic',
  'application/pdf',
])

export function buildFileHeaders(opts: {
  mimeType: string | null | undefined
  fileName: string
  /** Пользователь явно нажал «скачать». */
  forceDownload?: boolean
}): Record<string, string> {
  const mime = (opts.mimeType || 'application/octet-stream').toLowerCase()
  const canInline = !opts.forceDownload && INLINE_SAFE_MIME.has(mime)
  const disposition = canInline ? 'inline' : 'attachment'
  return {
    'Content-Type': mime,
    'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(opts.fileName)}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  }
}

/** Разрешённые к загрузке типы для чеков/вложений (denylist опасных — на всякий). */
const BLOCKED_UPLOAD_MIME = new Set([
  'image/svg+xml',
  'text/html',
  'application/xhtml+xml',
  'text/xml',
  'application/xml',
  'application/javascript',
  'text/javascript',
])

export function isUploadMimeBlocked(mimeType: string | null | undefined): boolean {
  return BLOCKED_UPLOAD_MIME.has((mimeType || '').toLowerCase())
}

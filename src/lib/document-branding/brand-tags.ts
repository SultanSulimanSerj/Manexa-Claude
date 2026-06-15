/** Теги в DOCX-шаблоне: при экспорте заменяются на изображение печати/подписи */
export const BRAND_TAG_SIGNATURE = '____"signature"_____'
export const BRAND_TAG_STAMP = '____"stamp"_____'

/** Линия подписи в DOCX — отдельный run, картинка накладывается поверх */
export const SIGNATURE_LINE = '___________________'

export const SIGNATURE_TAG_VARIANTS = [
  BRAND_TAG_SIGNATURE,
  '____signature____',
  '[[SIGNATURE]]',
  '(расшифровка подписи)',
  'расшифровка подписи',
] as const

export const STAMP_TAG_VARIANTS = [
  BRAND_TAG_STAMP,
  '____stamp____',
  '[[STAMP]]',
] as const

/** Варианты для поиска в XML (кавычки могут быть экранированы) */
export function expandXmlTagVariants(tags: readonly string[]): string[] {
  const out = new Set<string>()
  for (const tag of tags) {
    out.add(tag)
    out.add(tag.replace(/"/g, '&quot;'))
  }
  return Array.from(out)
}

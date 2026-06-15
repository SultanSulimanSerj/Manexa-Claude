import PizZip from 'pizzip'
import { assertValidDocxBuffer, DOCX_CORRUPT_MESSAGE } from './docx-buffer'
import { getKnownTagNames, getTagLabel } from './template-tags'

const DOCX_TAG_REGEX = /\{([#\/]?[a-zA-Z0-9_]+)\}/g

export interface ScannedTag {
  name: string
  label: string
  known: boolean
}

export function scanDocxTags(buffer: Buffer): ScannedTag[] {
  assertValidDocxBuffer(buffer, 'Шаблон')
  let zip: PizZip
  try {
    zip = new PizZip(buffer)
  } catch {
    throw new Error(DOCX_CORRUPT_MESSAGE)
  }
  const xmlParts: string[] = []

  const docXml = zip.file('word/document.xml')?.asText()
  if (docXml) xmlParts.push(docXml)

  const headers = zip.file(/word\/header\d+\.xml/)
  headers.forEach((f) => xmlParts.push(f.asText()))

  const footers = zip.file(/word\/footer\d+\.xml/)
  footers.forEach((f) => xmlParts.push(f.asText()))

  const combined = xmlParts.join('\n')
  const known = getKnownTagNames()
  const found = new Set<string>()

  let match: RegExpExecArray | null
  const regex = new RegExp(DOCX_TAG_REGEX.source, 'g')
  while ((match = regex.exec(combined)) !== null) {
    const name = match[1]
    if (name === '#items' || name === '/items') {
      found.add(name)
      continue
    }
    if (!name.startsWith('#') && !name.startsWith('/')) {
      found.add(name)
    }
  }

  return Array.from(found)
    .sort()
    .map((name) => ({
      name,
      label: getTagLabel(name),
      known: known.has(name) || name === '#items' || name === '/items',
    }))
}

export function buildTemplateStorageKey(companyId: string, templateId: string): string {
  return `templates/${companyId}/${templateId}.docx`
}

'use client'

import { useMemo, useState } from 'react'
import {
  getTagsForCategory,
  formatTagForDocx,
  type TemplateDocCategory,
} from '@/lib/template-tags'
import Link from 'next/link'

interface TagReferenceProps {
  category: TemplateDocCategory
}

export function TagReference({ category }: TagReferenceProps) {
  const [copied, setCopied] = useState<string | null>(null)
  const tags = useMemo(() => getTagsForCategory(category), [category])

  const copyTag = async (tag: string) => {
    try {
      await navigator.clipboard.writeText(formatTagForDocx(tag))
      setCopied(tag)
      window.setTimeout(() => setCopied(null), 1500)
    } catch {
      // clipboard may be unavailable
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Вставьте теги в Word на компьютере. Нажмите на тег — он скопируется в буфер.{' '}
        <Link href="/templates/guide" className="text-blue-600 hover:underline">
          Полный справочник
        </Link>
      </p>
      <div className="max-h-[50vh] space-y-2 overflow-y-auto">
        {tags.map((t) => (
          <button
            key={t.tag}
            type="button"
            onClick={() => copyTag(t.tag)}
            className="flex w-full items-start gap-2 rounded-lg border border-gray-200 px-3 py-2 text-left hover:bg-gray-50"
          >
            <code className="shrink-0 font-mono text-sm text-blue-700">
              {formatTagForDocx(t.tag)}
            </code>
            <span className="text-sm text-gray-600">{t.label}</span>
            {copied === t.tag && (
              <span className="ml-auto text-xs text-green-600">Скопировано</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

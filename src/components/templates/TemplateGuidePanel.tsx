'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Copy, Check, BookOpen, Upload } from 'lucide-react'
import {
  formatTagForDocx,
  getTagGroupsForCategory,
  type TemplateDocCategory,
} from '@/lib/template-tags'
import {
  DOCX_TAG_RULES,
  TEMPLATE_DOC_TYPES,
  TEMPLATE_PREP_STEPS,
} from '@/lib/template-guide'

type GuideTab = TemplateDocCategory | 'UPD'

const TAB_ORDER: GuideTab[] = ['CONTRACT', 'COMMERCIAL_OFFER', 'INVOICE', 'UPD']

export function TemplateGuidePanel({ compact = false }: { compact?: boolean }) {
  const [activeTab, setActiveTab] = useState<GuideTab>('CONTRACT')
  const [copied, setCopied] = useState<string | null>(null)

  const activeDoc = TEMPLATE_DOC_TYPES.find((d) => d.id === activeTab)
  const tagGroups = useMemo(() => {
    if (activeTab === 'UPD') return []
    return getTagGroupsForCategory(activeTab)
  }, [activeTab])

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
    <div className="space-y-6">
      {!compact && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">
          <div className="flex items-start gap-3">
            <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
            <div>
              <h2 className="font-semibold text-blue-900">Как подготовить шаблон</h2>
              <ol className="mt-3 space-y-2 text-sm text-blue-900/90">
                {TEMPLATE_PREP_STEPS.map((step, i) => (
                  <li key={step.title}>
                    <span className="font-medium">
                      {i + 1}. {step.title}.
                    </span>{' '}
                    {step.text}
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-sm">
                <Link href="/templates/new" className="inline-flex items-center gap-1 font-medium text-blue-700 underline">
                  <Upload className="h-4 w-4" />
                  Загрузить шаблон
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {TAB_ORDER.map((tab) => {
          const doc = TEMPLATE_DOC_TYPES.find((d) => d.id === tab)
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {doc?.label || tab}
            </button>
          )
        })}
      </div>

      {activeDoc && (
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">{activeDoc.label}</h3>
          <p className="mt-1 text-sm text-gray-600">{activeDoc.description}</p>
          {activeDoc.baseDownloadUrl && (
            <p className="mt-3">
              <a
                href={activeDoc.baseDownloadUrl}
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                {activeDoc.baseDownloadLabel}
              </a>
            </p>
          )}
        </div>
      )}

      {activeTab === 'UPD' ? (
        <div className="rounded-xl border bg-gray-50 p-5 text-sm text-gray-700">
          <p>
            УПД формируется по встроенной Excel-форме. Данные подставляются автоматически из
            счёта, договора и реквизитов компании при создании документа в проекте.
          </p>
          <p className="mt-3">
            Загрузка собственного шаблона УПД пока не поддерживается. Для договоров, КП и счетов
            используйте Word-шаблоны с тегами из вкладок выше.
          </p>
        </div>
      ) : (
        <>
          {!compact && (
            <div className="rounded-xl border bg-white p-5">
              <h3 className="mb-3 font-medium text-gray-900">Правила разметки в Word</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600">
                {DOCX_TAG_RULES.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-4">
            {tagGroups.map((group) => (
              <div key={`${activeTab}-${group.id}`} className="rounded-xl border bg-white p-4">
                <h4 className="mb-3 font-medium text-gray-900">{group.title}</h4>
                <div className="space-y-2">
                  {group.tags.map((t) => (
                    <button
                      key={t.tag}
                      type="button"
                      onClick={() => copyTag(t.tag)}
                      className="flex w-full items-start gap-3 rounded-lg border border-gray-200 px-3 py-2 text-left hover:bg-gray-50"
                    >
                      <code className="shrink-0 font-mono text-sm text-blue-700">
                        {formatTagForDocx(t.tag)}
                      </code>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-gray-800">{t.label}</span>
                        <span className="block text-xs text-gray-500">{t.description}</span>
                      </span>
                      {copied === t.tag ? (
                        <Check className="h-4 w-4 shrink-0 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4 shrink-0 text-gray-400" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

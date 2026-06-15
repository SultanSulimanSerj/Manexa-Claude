'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Layout from '@/components/layout'
import { ErrorBanner } from '@/components/ui/error-banner'
import { DocxPreview } from '@/components/templates/DocxPreview'
import { TagReference } from '@/components/templates/TagReference'
import { TEMPLATE_CATEGORY_LABELS, type TemplateDocCategory } from '@/lib/template-tags'
import { ArrowLeft, Download, Upload, AlertTriangle, Trash2, Star } from 'lucide-react'

interface TemplateInfo {
  id: string
  name: string
  description?: string
  category: TemplateDocCategory
  hasFile?: boolean
  isDefault?: boolean
  isActive?: boolean
  _count?: { documents: number }
}

interface ScannedTag {
  name: string
  label: string
  known: boolean
}

export default function TemplateEditPage() {
  const params = useParams()
  const router = useRouter()
  const templateId = Array.isArray(params?.id) ? params.id[0] : params?.id
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [template, setTemplate] = useState<TemplateInfo | null>(null)
  const [tags, setTags] = useState<ScannedTag[]>([])
  const [unknownTags, setUnknownTags] = useState<ScannedTag[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [settingDefault, setSettingDefault] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewKey, setPreviewKey] = useState(0)
  const [deleting, setDeleting] = useState(false)

  const loadTemplate = async () => {
    if (!templateId) return
    const [tplRes, tagsRes] = await Promise.all([
      fetch(`/api/templates/${templateId}`),
      fetch(`/api/templates/${templateId}/tags`),
    ])

    if (!tplRes.ok) {
      const data = await tplRes.json().catch(() => ({}))
      throw new Error(data.error || 'Шаблон не найден')
    }

    setTemplate(await tplRes.json())

    if (tagsRes.ok) {
      const tagsData = await tagsRes.json()
      setTags(tagsData.known || [])
      setUnknownTags(tagsData.unknown || [])
    } else {
      const tagsData = await tagsRes.json().catch(() => ({}))
      if (tagsData.error) setError(tagsData.error)
    }
  }

  useEffect(() => {
    if (!templateId) return
    loadTemplate()
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false))
  }, [templateId])

  const refreshPreview = () => {
    setPreviewKey((k) => k + 1)
    loadTemplate().catch(() => undefined)
  }

  const handleSetDefault = async () => {
    if (!template) return
    setSettingDefault(true)
    setError(null)
    try {
      const res = await fetch(`/api/templates/${template.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Не удалось назначить базовым')
      await loadTemplate()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setSettingDefault(false)
    }
  }

  const handleDelete = async () => {
    if (!template) return
    const used = template._count?.documents ?? 0
    if (used > 0) {
      setError(`Невозможно удалить: шаблон использован в ${used} документ(ах)`)
      return
    }
    if (!confirm(`Удалить шаблон «${template.name}»? Это действие нельзя отменить.`)) return

    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/templates/${template.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Не удалось удалить шаблон')
      router.push('/templates')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка удаления шаблона')
      setDeleting(false)
    }
  }

  const handleReplaceFile = async (file: File) => {
    if (!templateId) return
    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/templates/${templateId}`, {
        method: 'PUT',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Не удалось загрузить файл')
      }

      refreshPreview()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки файла')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex h-96 items-center justify-center text-gray-500">Загрузка...</div>
      </Layout>
    )
  }

  if (!template) {
    return (
      <Layout>
        <div className="mx-auto max-w-2xl py-12 text-center">
          <p className="mb-4 text-lg font-medium text-gray-900">{error || 'Шаблон не найден'}</p>
          <Link href="/templates" className="text-blue-600 hover:underline">
            Вернуться к шаблонам
          </Link>
        </div>
      </Layout>
    )
  }

  const docLabel = TEMPLATE_CATEGORY_LABELS[template.category].toLowerCase()

  return (
    <Layout>
      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      <div className="mb-4">
        <Link
          href="/templates"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад к шаблонам
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{template.name}</h1>
            {template.isDefault && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                <Star className="h-3 w-3" />
                Базовый {docLabel}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600">{TEMPLATE_CATEGORY_LABELS[template.category]}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/templates/${template.id}/download`}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Скачать DOCX
          </a>
          {!template.isDefault && (
            <button
              type="button"
              onClick={handleSetDefault}
              disabled={settingDefault || uploading}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 hover:bg-amber-100 disabled:opacity-50"
            >
              <Star className="h-4 w-4" />
              {settingDefault ? 'Сохранение...' : `Сделать базовым ${docLabel}`}
            </button>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'Загрузка...' : 'Заменить файл'}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || uploading}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? 'Удаление...' : 'Удалить'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleReplaceFile(f)
              e.target.value = ''
            }}
          />
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <strong>Как подготовить шаблон:</strong> скачайте{' '}
        <a href="/api/templates/base/contract" className="font-medium underline">
          базовый шаблон
        </a>{' '}
        или откройте свой договор в Word, вставьте теги из справочника справа (например{' '}
        {'{executorDirector}'}), сохраните и загрузите сюда. Нажмите «Сделать базовым {docLabel}» —
        он будет использоваться при создании новых документов.
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Предпросмотр</h2>
          <DocxPreview key={previewKey} url={`/api/templates/${template.id}/download`} />

          <div className="mt-4 rounded-xl border bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-gray-900">Теги в загруженном файле</h2>
            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {tags.map((t) => (
                  <span
                    key={t.name}
                    className="rounded bg-green-100 px-2 py-0.5 font-mono text-xs text-green-800"
                    title={t.label}
                  >
                    {'{' + t.name + '}'}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                В файле пока нет тегов. Расставьте их в Word и загрузите файл заново.
              </p>
            )}
            {unknownTags.length > 0 && (
              <div className="mt-3 border-t pt-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-800">
                  <AlertTriangle className="h-4 w-4" />
                  Неизвестные теги ({unknownTags.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {unknownTags.map((t) => (
                    <span
                      key={t.name}
                      className="rounded bg-amber-100 px-2 py-0.5 font-mono text-xs text-amber-900"
                    >
                      {'{' + t.name + '}'}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Справочник тегов</h2>
          <TagReference category={template.category} />
        </div>
      </div>
    </Layout>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Layout from '@/components/layout'
import { ErrorBanner } from '@/components/ui/error-banner'
import { ArrowLeft, Download, Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'

interface TemplateDetail {
  id: string
  name: string
  description?: string
  category: string
  type: string
  fileType: string
  autoFillSources?: {
    company?: string[]
    project?: string[]
    custom?: string[]
  }
  variables?: Record<string, unknown>
  isPublic?: boolean
  isActive?: boolean
  isSystem?: boolean
  hasFile?: boolean
  _count?: { documents: number }
}

const categoryLabels: Record<string, string> = {
  CONTRACT: 'Договор',
  COMMERCIAL_OFFER: 'Коммерческое предложение',
  COMMERCIAL: 'Коммерческие',
  FINANCIAL: 'Финансовые',
  REPORT: 'Отчетные',
  HR: 'Кадровые',
  TECHNICAL: 'Технические',
  LEGAL: 'Юридические',
  OTHER: 'Прочие',
}

export default function TemplateDetailPage() {
  const params = useParams()
  const router = useRouter()
  const templateId = Array.isArray(params?.id) ? params.id[0] : params?.id
  const [template, setTemplate] = useState<TemplateDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!templateId) return
    const fetchTemplate = async () => {
      try {
        const response = await fetch(`/api/templates/${templateId}`)
        if (response.ok) {
          setTemplate(await response.json())
          setError(null)
        } else {
          const data = await response.json().catch(() => ({}))
          setError(data.error || 'Шаблон не найден')
        }
      } catch {
        setError('Ошибка загрузки шаблона')
      } finally {
        setLoading(false)
      }
    }
    fetchTemplate()
  }, [templateId])

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления шаблона')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex h-96 items-center justify-center text-gray-500">Загрузка...</div>
      </Layout>
    )
  }

  if (error || !template) {
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

  const variableEntries = template.variables
    ? Object.entries(template.variables)
    : []

  return (
    <Layout>
      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          href="/templates"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад к шаблонам
        </Link>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{template.name}</h1>
              {template.description && (
                <p className="mt-2 text-gray-600">{template.description}</p>
              )}
            </div>
            <span
              className={`rounded px-2 py-1 text-xs font-medium ${
                template.isSystem
                  ? 'bg-gray-100 text-gray-700'
                  : template.isActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600'
              }`}
            >
              {template.isSystem ? 'Системный' : template.isActive ? 'Активен' : 'Неактивен'}
            </span>
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Категория</p>
              <p className="font-medium">{categoryLabels[template.category] || template.category}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Тип</p>
              <p className="font-medium">{template.type}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Формат</p>
              <p className="font-medium">{template.fileType}</p>
            </div>
          </div>

          {template.autoFillSources && (
            <div className="mb-6">
              <h2 className="mb-2 font-semibold text-gray-900">Автозаполнение</h2>
              <div className="space-y-1 text-sm text-gray-600">
                {template.autoFillSources.company && (
                  <p>Компания: {template.autoFillSources.company.length} полей</p>
                )}
                {template.autoFillSources.project && (
                  <p>Проект: {template.autoFillSources.project.length} полей</p>
                )}
                {template.autoFillSources.custom && (
                  <p>Ручной ввод: {template.autoFillSources.custom.length} полей</p>
                )}
              </div>
            </div>
          )}

          {variableEntries.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-2 font-semibold text-gray-900">Переменные ({variableEntries.length})</h2>
              <div className="max-h-64 overflow-y-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Поле</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Описание</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variableEntries.map(([key, val]) => (
                      <tr key={key} className="border-t">
                        <td className="px-3 py-2 font-mono text-xs">{key}</td>
                        <td className="px-3 py-2 text-gray-600">
                          {(val as { description?: string })?.description || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {!template.isSystem && (
              <Link
                href={`/templates/${template.id}/edit`}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Pencil className="h-4 w-4" />
                Редактировать шаблон
              </Link>
            )}
            {template.hasFile && (
              <a
                href={`/api/templates/${template.id}/download`}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Download className="h-4 w-4" />
                Скачать DOCX
              </a>
            )}
            {!template.isSystem && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? 'Удаление...' : 'Удалить шаблон'}
              </button>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}

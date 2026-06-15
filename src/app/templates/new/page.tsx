'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Layout from '@/components/layout'
import { ErrorBanner } from '@/components/ui/error-banner'
import { ArrowLeft, Upload } from 'lucide-react'
import { TEMPLATE_CATEGORY_LABELS, type TemplateDocCategory } from '@/lib/template-tags'

export default function NewTemplatePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<TemplateDocCategory>('CONTRACT')
  const [file, setFile] = useState<File | null>(null)
  const [setAsDefault, setSetAsDefault] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError('Выберите файл DOCX')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('name', name.trim())
      formData.append('description', description.trim())
      formData.append('category', category)
      formData.append('file', file)
      formData.append('setAsDefault', setAsDefault ? 'true' : 'false')

      const response = await fetch('/api/templates', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Не удалось создать шаблон')
      }

      router.push(`/templates/${data.id}/edit`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания шаблона')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      <div className="mx-auto max-w-2xl space-y-6">
        <Link
          href="/templates"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад к шаблонам
        </Link>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Новый шаблон</h1>
          <p className="mb-6 text-sm text-gray-600">
            Загрузите готовый Word-файл (.docx) с расставленными тегами.{' '}
            <Link href="/templates/guide" className="text-blue-600 hover:underline">
              Открыть справочник тегов
            </Link>
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Название</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Договор подряда"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Категория</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TemplateDocCategory)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="CONTRACT">{TEMPLATE_CATEGORY_LABELS.CONTRACT}</option>
                <option value="COMMERCIAL_OFFER">{TEMPLATE_CATEGORY_LABELS.COMMERCIAL_OFFER}</option>
                <option value="INVOICE">{TEMPLATE_CATEGORY_LABELS.INVOICE}</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Описание</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Необязательно"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Файл DOCX</label>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-8 hover:border-blue-400 hover:bg-blue-50">
                <Upload className="mb-2 h-8 w-8 text-gray-400" />
                <span className="text-sm text-gray-600">
                  {file ? file.name : 'Нажмите, чтобы выбрать .docx'}
                </span>
                <input
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={setAsDefault}
                onChange={(e) => setSetAsDefault(e.target.checked)}
                className="mt-1"
              />
              <span>
                <span className="font-medium">Использовать по умолчанию</span>
                <span className="mt-0.5 block text-gray-500">
                  Автоматически применять этот шаблон при создании новых документов этой категории
                </span>
              </span>
            </label>

            <button
              type="submit"
              disabled={loading || !name.trim() || !file}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Создание...' : 'Создать и перейти к редактору'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  )
}

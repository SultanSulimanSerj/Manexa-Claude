'use client'

import Link from 'next/link'
import Layout from '@/components/layout'
import { TemplateGuidePanel } from '@/components/templates/TemplateGuidePanel'
import { ArrowLeft } from 'lucide-react'

export default function TemplateGuidePage() {
  return (
    <Layout>
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <Link
          href="/templates"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад к шаблонам
        </Link>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Справочник тегов для шаблонов</h1>
          <p className="mt-2 text-gray-600">
            Скопируйте теги в Word, загрузите шаблон в Manexa — он будет автоматически применяться
            при создании документов в проектах.
          </p>
        </div>

        <TemplateGuidePanel />
      </div>
    </Layout>
  )
}

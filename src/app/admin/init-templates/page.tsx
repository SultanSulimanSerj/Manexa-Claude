'use client'


import { toast } from '@/components/ui/use-toast'
import { useState } from 'react'
import Layout from '@/components/layout'
import { FileText, CheckCircle } from 'lucide-react'

export default function InitTemplatesPage() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleInit = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/templates/seed-contract', {
        method: 'POST'
      })

      if (response.ok) {
        setSuccess(true)
        toast.success('Шаблон договора успешно создан!')
      } else {
        const error = await response.json()
        toast.error(`Ошибка: ${error.error}`)
      }
    } catch (error) {
      console.error('Error:', error)
      toast.success('Ошибка при создании шаблона')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg border p-8">
            <div className="text-center mb-6">
              <FileText className="h-16 w-16 text-blue-600 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Инициализация шаблонов
              </h1>
              <p className="text-gray-600">
                Создать шаблон договора подряда в базе данных
              </p>
            </div>

            {success ? (
              <div className="text-center py-8">
                <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                <p className="text-lg font-semibold text-green-600 mb-2">
                  Шаблон успешно создан!
                </p>
                <p className="text-gray-600 mb-6">
                  Теперь вы можете генерировать договоры из проектов
                </p>
                <a
                  href="/projects"
                  className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
                >
                  Перейти к проектам
                </a>
              </div>
            ) : (
              <button
                onClick={handleInit}
                disabled={loading}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Создание...' : 'Создать шаблон договора'}
              </button>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}


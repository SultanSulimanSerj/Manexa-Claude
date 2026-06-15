'use client'

import { useEffect, useRef, useState } from 'react'

interface DocxPreviewProps {
  url: string
}

export function DocxPreview({ url }: DocxPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function renderPreview() {
      if (!containerRef.current) return
      setLoading(true)
      setError(null)
      containerRef.current.innerHTML = ''

      try {
        const response = await fetch(url)
        if (!response.ok) throw new Error('Не удалось загрузить файл')
        const buffer = await response.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
          throw new Error(
            'Файл шаблона повреждён или пустой. Загрузите документ заново через «Заменить файл».'
          )
        }
        const { renderAsync } = await import('docx-preview')
        if (cancelled || !containerRef.current) return
        await renderAsync(buffer, containerRef.current, undefined, {
          className: 'docx-preview',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
        })
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Ошибка предпросмотра')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    renderPreview()
    return () => {
      cancelled = true
    }
  }, [url])

  return (
    <div className="relative min-h-[400px] rounded-lg border border-gray-200 bg-white">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500">
          Загрузка предпросмотра...
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-red-600">
          {error}
        </div>
      )}
      <div ref={containerRef} className="max-h-[70vh] overflow-auto p-4" />
    </div>
  )
}

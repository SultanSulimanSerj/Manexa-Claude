'use client'

import { useEffect, useState } from 'react'
import { Info, AlertTriangle, X } from 'lucide-react'

interface Announcement {
  id: string
  title: string
  body: string
  level: string
  createdAt: string
}

// Кэш на уровне модуля: не дёргаем API при каждой навигации внутри сессии SPA
let cache: { data: Announcement[]; ts: number } | null = null
const CACHE_TTL = 60_000

const LEVEL_STYLE: Record<string, { wrap: string; icon: string }> = {
  INFO: { wrap: 'border-gray-200 bg-gray-50 text-gray-800', icon: 'text-gray-500' },
  WARNING: { wrap: 'border-amber-200 bg-amber-50 text-amber-900', icon: 'text-amber-500' },
  CRITICAL: { wrap: 'border-red-200 bg-red-50 text-red-900', icon: 'text-red-500' },
}

export default function AnnouncementBanner() {
  const [items, setItems] = useState<Announcement[]>([])

  useEffect(() => {
    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      setItems(cache.data)
      return
    }
    fetch('/api/announcements')
      .then((res) => (res.ok ? res.json() : { announcements: [] }))
      .then((data) => {
        const list = data.announcements || []
        cache = { data: list, ts: Date.now() }
        setItems(list)
      })
      .catch(() => {})
  }, [])

  const dismiss = (id: string) => {
    setItems((prev) => prev.filter((a) => a.id !== id))
    if (cache) cache = { data: cache.data.filter((a) => a.id !== id), ts: cache.ts }
    fetch('/api/announcements/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {})
  }

  if (items.length === 0) return null

  return (
    <div className="mb-4 space-y-2">
      {items.map((a) => {
        const style = LEVEL_STYLE[a.level] || LEVEL_STYLE.INFO
        const Icon = a.level === 'INFO' ? Info : AlertTriangle
        return (
          <div key={a.id} className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${style.wrap}`}>
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.icon}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{a.title}</p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm">{a.body}</p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(a.id)}
              className="shrink-0 rounded p-1 opacity-60 hover:bg-black/5 hover:opacity-100"
              aria-label="Скрыть"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

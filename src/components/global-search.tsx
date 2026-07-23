'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Search, FolderOpen, Flag, FileText, Loader2 } from 'lucide-react'

interface ResultItem {
  id: string
  title: string
  subtitle?: string
  href: string
  type: 'project' | 'task' | 'document'
}

const TYPE_META = {
  project: { label: 'Проекты', icon: FolderOpen },
  task: { label: 'Задачи', icon: Flag },
  document: { label: 'Документы', icon: FileText },
} as const

interface GlobalSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Глобальный поиск (⌘K): проекты, задачи, документы — сгруппированные результаты. */
export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ResultItem[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestSeq = useRef(0)

  const runSearch = useCallback(async (q: string) => {
    const seq = ++requestSeq.current
    if (q.trim().length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const enc = encodeURIComponent(q.trim())
      const [pRes, tRes, dRes] = await Promise.all([
        fetch(`/api/projects?search=${enc}&limit=5`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch(`/api/tasks?search=${enc}&limit=5`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch(`/api/documents?search=${enc}&limit=5`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ])
      if (seq !== requestSeq.current) return // устаревший ответ

      const items: ResultItem[] = []
      for (const p of pRes?.projects || []) {
        items.push({ id: p.id, title: p.name, subtitle: p.clientName || undefined, href: `/projects/${p.id}`, type: 'project' })
      }
      for (const t of tRes?.tasks || []) {
        items.push({ id: t.id, title: t.title, subtitle: t.project?.name || undefined, href: `/tasks/${t.id}`, type: 'task' })
      }
      for (const d of dRes?.documents || []) {
        items.push({ id: d.id, title: d.title, subtitle: d.project?.name || undefined, href: `/documents/${d.id}/edit`, type: 'document' })
      }
      setResults(items)
      setActiveIndex(0)
    } finally {
      if (seq === requestSeq.current) setLoading(false)
    }
  }, [])

  // Debounce 250ms
  useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(query), 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, open, runSearch])

  // Сброс при закрытии
  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      setActiveIndex(0)
    }
  }, [open])

  const go = (item: ResultItem) => {
    onOpenChange(false)
    router.push(item.href)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault()
      go(results[activeIndex])
    }
  }

  // Группировка для рендера
  const grouped = (['project', 'task', 'document'] as const)
    .map((type) => ({ type, items: results.filter((r) => r.type === type) }))
    .filter((g) => g.items.length > 0)

  let flatIndex = -1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="top-[20%] max-w-xl translate-y-0 gap-0 p-0 overflow-hidden">
        <DialogTitle className="sr-only">Глобальный поиск</DialogTitle>
        <div className="flex items-center gap-2.5 border-b border-neutral-200 px-4">
          <Search className="h-4 w-4 shrink-0 text-neutral-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Поиск по проектам, задачам, документам…"
            className="h-12 w-full bg-transparent text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
            aria-label="Поиск"
          />
          {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-neutral-400" />}
        </div>

        <div className="max-h-[320px] overflow-y-auto p-2">
          {query.trim().length < 2 ? (
            <p className="px-3 py-8 text-center text-sm text-neutral-400">
              Введите минимум 2 символа
            </p>
          ) : !loading && results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-neutral-400">Ничего не найдено</p>
          ) : (
            grouped.map((group) => {
              const Meta = TYPE_META[group.type]
              return (
                <div key={group.type} className="mb-1">
                  <p className="px-3 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-wider text-neutral-400">
                    {Meta.label}
                  </p>
                  {group.items.map((item) => {
                    flatIndex++
                    const idx = flatIndex
                    const Icon = Meta.icon
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => go(item)}
                        onMouseEnter={() => setActiveIndex(idx)}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors ${
                          idx === activeIndex ? 'bg-neutral-100' : ''
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-neutral-400" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-neutral-900">{item.title}</span>
                          {item.subtitle && (
                            <span className="block truncate text-xs text-neutral-400">{item.subtitle}</span>
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

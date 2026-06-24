'use client'

import { useState, useMemo, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Клиентская пагинация для длинных списков.
 * Возвращает срез текущей страницы + готовый компонент управления.
 *
 * const { pageItems, Pagination } = usePagination(filteredItems, 20)
 * ...render pageItems...
 * <Pagination />
 */
export function usePagination<T>(items: T[], pageSize = 20) {
  const [page, setPage] = useState(1)
  const total = items.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  // Если фильтр сократил список — не зависаем на несуществующей странице.
  useEffect(() => {
    if (page > pageCount) setPage(1)
  }, [page, pageCount])

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, page, pageSize])

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const Pagination = () => {
    if (total <= pageSize) return null
    return (
      <div className="flex items-center justify-between gap-4 px-1 py-2">
        <p className="text-sm text-gray-500">
          {from}–{to} из {total}
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors',
              page === 1 ? 'cursor-not-allowed opacity-40' : 'hover:bg-gray-50'
            )}
            aria-label="Предыдущая страница"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2 text-sm text-gray-700">
            {page} / {pageCount}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={page === pageCount}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors',
              page === pageCount ? 'cursor-not-allowed opacity-40' : 'hover:bg-gray-50'
            )}
            aria-label="Следующая страница"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  return { page, setPage, pageItems, pageCount, from, to, total, Pagination }
}

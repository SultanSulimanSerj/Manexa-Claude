'use client'

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { Breadcrumbs, type Crumb } from "@/components/ui/breadcrumbs"

interface PageHeaderProps {
  title: React.ReactNode
  description?: React.ReactNode
  /** Кнопки действий справа (например «Создать»). */
  actions?: React.ReactNode
  /** Хлебные крошки над заголовком. */
  breadcrumbs?: Crumb[]
  /** Показать стрелку «назад». true → router.back(), строка → href. */
  back?: boolean | string
  className?: string
}

/**
 * Единый заголовок страницы: крошки + (опц.) назад + заголовок + действия.
 * Заменяет рукописные `<h1 className="text-2xl font-bold">` по всему приложению.
 */
export default function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  back,
  className,
}: PageHeaderProps) {
  const router = useRouter()

  return (
    <div className={cn("space-y-3", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          {back && (
            <button
              type="button"
              onClick={() => (typeof back === "string" ? router.push(back) : router.back())}
              className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              aria-label="Назад"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 truncate">{title}</h1>
            {description && (
              <p className="mt-1 text-sm text-gray-600">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

import * as React from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export interface Crumb {
  label: string
  href?: string
}

/**
 * Хлебные крошки для ориентации в глубоких разделах
 * (например Проекты → Дом на Ленина → Смета).
 */
export function Breadcrumbs({
  items,
  className,
}: {
  items: Crumb[]
  className?: string
}) {
  return (
    <nav aria-label="breadcrumb" className={cn("flex items-center text-sm text-gray-500", className)}>
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, i) => {
          const isLast = i === items.length - 1
          return (
            <li key={i} className="flex items-center gap-1 min-w-0">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="truncate hover:text-gray-900 transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <span className={cn("truncate", isLast && "font-medium text-gray-900")}>
                  {item.label}
                </span>
              )}
              {!isLast && <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

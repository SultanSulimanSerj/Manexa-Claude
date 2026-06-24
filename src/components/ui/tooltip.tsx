'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface TooltipProps {
  /** Полный текст во всплывающем окошке. Если пусто — тултип не показывается. */
  content?: React.ReactNode
  children: React.ReactNode
  /** Класс на обёртке (например max-w + truncate-контекст). */
  className?: string
}

/**
 * Лёгкий тултип через портал — не обрезается контейнерами/таблицами.
 * Тёмное окошко появляется над элементом при наведении.
 */
export function Tooltip({ content, children, className }: TooltipProps) {
  const [show, setShow] = React.useState(false)
  const [pos, setPos] = React.useState({ top: 0, left: 0 })
  const ref = React.useRef<HTMLSpanElement>(null)
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => setMounted(true), [])

  const handleEnter = () => {
    const r = ref.current?.getBoundingClientRect()
    if (r) setPos({ top: r.top, left: r.left + r.width / 2 })
    setShow(true)
  }

  return (
    <span
      ref={ref}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setShow(false)}
      className={cn('inline-block align-bottom', className)}
    >
      {children}
      {mounted &&
        show &&
        content &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: pos.top - 8,
              left: pos.left,
              transform: 'translate(-50%, -100%)',
            }}
            className="pointer-events-none z-[200] max-w-xs rounded-lg bg-neutral-900 px-3 py-2 text-xs leading-snug text-white shadow-lg"
          >
            {content}
          </div>,
          document.body
        )}
    </span>
  )
}

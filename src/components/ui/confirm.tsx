'use client'

import * as React from 'react'
import { AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

export interface ConfirmOptions {
  title?: string
  description?: React.ReactNode
  confirmText?: string
  cancelText?: string
  /** Опасное действие — красная кнопка подтверждения */
  destructive?: boolean
}

interface ConfirmState {
  open: boolean
  options: ConfirmOptions
}

let state: ConfirmState = { open: false, options: {} }
let resolver: ((value: boolean) => void) | null = null
const listeners = new Set<(s: ConfirmState) => void>()

function emit() {
  listeners.forEach((l) => l(state))
}

/**
 * Промис-подтверждение вместо нативного window.confirm().
 * Можно передать строку (станет заголовком) либо объект опций.
 */
export function confirm(options: string | ConfirmOptions = {}): Promise<boolean> {
  const opts = typeof options === 'string' ? { title: options } : options
  // отклоняем предыдущий незакрытый запрос
  resolver?.(false)
  state = { open: true, options: opts }
  emit()
  return new Promise<boolean>((resolve) => {
    resolver = resolve
  })
}

function settle(result: boolean) {
  resolver?.(result)
  resolver = null
  state = { open: false, options: state.options }
  emit()
}

/** Рендерится один раз в Providers — отображает текущий запрос подтверждения. */
export function ConfirmRoot() {
  const [s, setS] = React.useState<ConfirmState>(state)

  React.useEffect(() => {
    const listener = (next: ConfirmState) => setS({ ...next })
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  const { options } = s

  return (
    <Dialog open={s.open} onOpenChange={(next) => !next && settle(false)}>
      <DialogContent className="max-w-md" hideClose>
        <DialogHeader>
          <div className="flex items-start gap-3">
            {options.destructive && (
              <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            )}
            <div className="space-y-1.5">
              <DialogTitle>{options.title ?? 'Подтвердите действие'}</DialogTitle>
              {options.description && (
                <DialogDescription>{options.description}</DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => settle(false)}>
            {options.cancelText ?? 'Отмена'}
          </Button>
          <Button
            variant={options.destructive ? 'destructive' : 'default'}
            onClick={() => settle(true)}
          >
            {options.confirmText ?? 'Подтвердить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

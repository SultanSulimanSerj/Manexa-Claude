'use client'

// Адаптировано из shadcn/ui (Radix Toast). Глобальный стор тостов + хук.
import * as React from 'react'

import type { ToastProps } from '@/components/ui/toast'

const TOAST_LIMIT = 4
const TOAST_REMOVE_DELAY = 5000

type ToasterToast = Omit<ToastProps, 'title'> & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
}

let count = 0
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType =
  | { type: 'ADD'; toast: ToasterToast }
  | { type: 'UPDATE'; toast: Partial<ToasterToast> & { id: string } }
  | { type: 'DISMISS'; toastId?: string }
  | { type: 'REMOVE'; toastId?: string }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

function addToRemoveQueue(toastId: string) {
  if (toastTimeouts.has(toastId)) return
  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({ type: 'REMOVE', toastId })
  }, TOAST_REMOVE_DELAY)
  toastTimeouts.set(toastId, timeout)
}

function reducer(state: State, action: ActionType): State {
  switch (action.type) {
    case 'ADD':
      return { toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT) }
    case 'UPDATE':
      return {
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }
    case 'DISMISS': {
      const { toastId } = action
      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((t) => addToRemoveQueue(t.id))
      }
      return {
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined ? { ...t, open: false } : t
        ),
      }
    }
    case 'REMOVE':
      if (action.toastId === undefined) return { toasts: [] }
      return { toasts: state.toasts.filter((t) => t.id !== action.toastId) }
  }
}

const listeners: Array<(state: State) => void> = []
let memoryState: State = { toasts: [] }

function dispatch(action: ActionType) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => listener(memoryState))
}

type ToastInput = Omit<ToasterToast, 'id'>

function toast(props: ToastInput) {
  const id = genId()
  const update = (next: Partial<ToasterToast>) =>
    dispatch({ type: 'UPDATE', toast: { ...next, id } })
  const dismiss = () => dispatch({ type: 'DISMISS', toastId: id })

  dispatch({
    type: 'ADD',
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  return { id, dismiss, update }
}

/** Удобные шорткаты */
toast.success = (title: React.ReactNode, description?: React.ReactNode) =>
  toast({ title, description, variant: 'success' })
toast.error = (title: React.ReactNode, description?: React.ReactNode) =>
  toast({ title, description, variant: 'destructive' })
toast.info = (title: React.ReactNode, description?: React.ReactNode) =>
  toast({ title, description })

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) listeners.splice(index, 1)
    }
  }, [])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: 'DISMISS', toastId }),
  }
}

export { useToast, toast }
export type { ToasterToast }

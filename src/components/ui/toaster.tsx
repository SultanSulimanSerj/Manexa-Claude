'use client'

import { CheckCircle2, AlertCircle, Info } from 'lucide-react'

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast'
import { useToast } from '@/components/ui/use-toast'

const icons = {
  default: Info,
  success: CheckCircle2,
  destructive: AlertCircle,
}

const iconColors = {
  default: 'text-blue-500',
  success: 'text-green-600',
  destructive: 'text-red-600',
}

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider swipeDirection="right">
      {toasts.map(({ id, title, description, variant, ...props }) => {
        const key = (variant ?? 'default') as keyof typeof icons
        const Icon = icons[key]
        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="flex items-start gap-3">
              <Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${iconColors[key]}`} />
              <div className="grid gap-0.5">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && <ToastDescription>{description}</ToastDescription>}
              </div>
            </div>
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}

'use client'

import { SessionProvider } from 'next-auth/react'
import { PermissionsProvider } from '@/components/permission-guard'
import { SocketProvider } from '@/contexts/SocketContext'
import { AccessGate } from '@/components/AccessGate'
import { ConfirmRoot } from '@/components/ui/confirm'
import { Toaster } from '@/components/ui/toaster'
import { IdleLogout } from '@/components/idle-logout'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <IdleLogout />
      <SocketProvider>
        <PermissionsProvider>
          <AccessGate>{children}</AccessGate>
        </PermissionsProvider>
      </SocketProvider>
      <Toaster />
      <ConfirmRoot />
    </SessionProvider>
  )
}

'use client'

import { SessionProvider } from 'next-auth/react'
import { PermissionsProvider } from '@/components/permission-guard'
import { SocketProvider } from '@/contexts/SocketContext'
import { AccessGate } from '@/components/AccessGate'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SocketProvider>
        <PermissionsProvider>
          <AccessGate>{children}</AccessGate>
        </PermissionsProvider>
      </SocketProvider>
    </SessionProvider>
  )
}

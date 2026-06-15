import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { Providers } from './providers'

// Локальные файлы вместо next/font/google: сборка на сервере без доступа к Google Fonts
const inter = localFont({
  src: [
    { path: './fonts/inter-latin.woff2', style: 'normal' },
    { path: './fonts/inter-cyrillic.woff2', style: 'normal' },
  ],
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
})

export const metadata: Metadata = {
  title: 'Manexa - Управление проектами',
  description: 'SaaS портал для управления проектами и объектами',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}

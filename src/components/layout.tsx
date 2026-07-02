'use client'

import Navigation from '@/components/navigation'
import AnnouncementBanner from '@/components/announcement-banner'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />

      {/* Main content */}
      <div className="lg:pl-64 pt-16">
        <main className="p-6">
          <div className="max-w-7xl mx-auto">
            <AnnouncementBanner />
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

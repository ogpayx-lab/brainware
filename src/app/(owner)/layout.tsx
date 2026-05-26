'use client'
import { OwnerSidebar } from '@/components/owner/Sidebar'
import { OwnerNotificationListener } from '@/components/owner/NotificationListener'
import { HelpTooltip } from '@/components/HelpTooltip'
import { DemoBanner } from '@/components/DemoBanner'
import { LanguageProvider } from '@/lib/i18n'
export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-surface)' }}>
        <DemoBanner />
        <OwnerSidebar />
        <OwnerNotificationListener />
        <HelpTooltip />
        <main className="owner-main">{children}</main>
      </div>
    </LanguageProvider>
  )
}


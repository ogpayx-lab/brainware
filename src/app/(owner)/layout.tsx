'use client'
import { OwnerSidebar } from '@/components/owner/Sidebar'
import { OwnerNotificationListener } from '@/components/owner/NotificationListener'
export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-surface)' }}>
      <OwnerSidebar />
      <OwnerNotificationListener />
      <main className="owner-main">{children}</main>
    </div>
  )
}

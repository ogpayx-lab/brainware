'use client'
import { OwnerSidebar } from '@/components/owner/Sidebar'
export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-surface)' }}>
      <OwnerSidebar />
      <main className="owner-main">{children}</main>
    </div>
  )
}

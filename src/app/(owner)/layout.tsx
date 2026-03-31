import { OwnerSidebar } from '@/components/owner/Sidebar'
export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-surface)' }}>
      <OwnerSidebar />
      <main style={{ marginLeft: 210, flex: 1, padding: 32, minHeight: '100vh' }}>{children}</main>
    </div>
  )
}

import { SuperAdminSidebar } from '@/components/superadmin/Sidebar'
export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0F172A' }}>
      <SuperAdminSidebar />
      <main style={{ marginLeft: 220, flex: 1, padding: 32, minHeight: '100vh' }}>{children}</main>
    </div>
  )
}

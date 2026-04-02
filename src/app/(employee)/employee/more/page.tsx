'use client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { BottomNav } from '@/components/employee/BottomNav'

const MORE_ACTIONS = [
  { href: '/employee/orders',       icon: '🛍️', label: 'Ordini Shopify', desc: 'Evadi ordini con tracking obbligatorio' },
  { href: '/employee/stock',        icon: '📦', label: 'Ricarica Stock', desc: 'Aggiungi quantita ai prodotti' },
  { href: '/employee/reorder',      icon: '🔄', label: 'Richiedi Ricarica', desc: 'Invia richiesta al magazzino' },
  { href: '/employee/transfers',    icon: '↔️', label: 'Trasferimenti', desc: 'Sposta prodotti tra store' },
  { href: '/employee/photos',       icon: '📷', label: 'Foto Registro', desc: 'Carica foto del registro' },
  { href: '/employee/maintenance',  icon: '🔧', label: 'Manutenzione', desc: 'Checklist giornaliera' },
  { href: '/employee/inventory',    icon: '📊', label: 'Conteggio', desc: 'Inventario prodotti' },
  { href: '/employee/vending',      icon: '🏧', label: 'Vending Machine', desc: 'Ricarica macchine H24' },
  { href: '/employee/ai',           icon: '🤖', label: 'Assistente AI', desc: 'Aiuto e procedure' },
]

export default function MorePage() {
  const router = useRouter()
  const supabase = createClient()

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="page" style={{ paddingBottom: 80 }}>
      <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)', padding: 'var(--space-lg)' }}>
        <h3>Altro</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>Funzioni aggiuntive e impostazioni</p>
      </div>
      <div style={{ padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
        {MORE_ACTIONS.map(a => (
          <Link key={a.href} href={a.href} style={{ textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: 'var(--space-md)', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}>
              <span style={{ fontSize: 24, width: 40, textAlign: 'center' }}>{a.icon}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{a.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{a.desc}</div>
              </div>
              <span style={{ marginLeft: 'auto', color: 'var(--text-tertiary)' }}></span>
            </div>
          </Link>
        ))}
        <div style={{ marginTop: 'var(--space-lg)' }}>
          <button onClick={logout} style={{ width: '100%', padding: 'var(--space-md)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--danger)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
            Logout
          </button>
        </div>
      </div>
      <BottomNav />
    </div>
  )
}

'use client'
import { useState } from 'react'
import { useT } from '@/lib/i18n'

const STORE_ACCOUNTS = [
  { email: 'cavour.mamamary@gmail.com', full_name: '[STORE] Cavour', store_match: 'cavour' },
  { email: 'mktg.mamamary@gmail.com', full_name: '[STORE] Prati', store_match: 'prati' },
  { email: 'sistina.mamamary@gmail.com', full_name: '[STORE] Sistina', store_match: 'sistina' },
  { email: 'brancaccio.dispensary@gmail.com', full_name: '[STORE] Brancaccio', store_match: 'brancaccio' },
  { email: 'malta.dispensary@gmail.com', full_name: '[STORE] Malta HS', store_match: 'high street' },
  { email: 'malta.vapeshop.mm@gmail.com', full_name: '[STORE] Vape Malta', store_match: 'vape' },
]

export default function SetupStoresPage() {
  const [results, setResults] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [stores, setStores] = useState<any[]>([])

  async function loadStores() {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
  const t = useT()
    const { data } = await supabase.from('stores').select('id, name')
    setStores(data ?? [])
    return data ?? []
  }

  async function createAll() {
    setRunning(true)
    setResults([])
    const storeList = stores.length ? stores : await loadStores()

    for (const acc of STORE_ACCOUNTS) {
      const store = storeList.find((s: any) => s.name.toLowerCase().includes(acc.store_match))
      if (!store) {
        setResults(prev => [...prev, `❌ ${acc.email}: store "${acc.store_match}" non trovato`])
        continue
      }
      try {
        const res = await fetch('/api/create-store-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: acc.email,
            password: 'MamaMary26!!!',
            full_name: acc.full_name,
            store_id: store.id,
            role: 'employee',
            pin: '0000',
          }),
        })
        const data = await res.json()
        if (data.error) {
          setResults(prev => [...prev, `❌ ${acc.email}: ${data.error}`])
        } else {
          setResults(prev => [...prev, `✅ ${acc.email} → ${store.name}`])
        }
      } catch (err: any) {
        setResults(prev => [...prev, `❌ ${acc.email}: ${err.message}`])
      }
    }
    setRunning(false)
  }

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: 24 }}>
      <h2>🔧 Setup Account Store</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
        Crea gli account tablet per tutti gli store usando l'Admin API di Supabase.
      </p>

      <button onClick={createAll} disabled={running} className="btn btn-primary btn-full" style={{ padding: 14, fontSize: 16, marginBottom: 24 }}>
        {running ? '⏳ Creazione in corso...' : '🚀 Crea tutti gli account store'}
      </button>

      {results.map((r, i) => (
        <div key={i} style={{ padding: '8px 12px', background: r.startsWith('✅') ? '#F0FDF4' : '#FEF2F2', borderRadius: 8, marginBottom: 6, fontSize: 14 }}>
          {r}
        </div>
      ))}
    </div>
  )
}

'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BottomNav } from '@/components/employee/BottomNav'

type Priority = 'alta' | 'media' | 'bassa'

export default function RichiediRicaricaPage() {
  const router = useRouter()
  const supabase = createClient()
  const [products, setProducts] = useState<any[]>([])
  const [requests, setRequests] = useState<Record<string, { qty: string; priority: Priority }>>({})
  const [storeName, setStoreName] = useState('')
  const [empName, setEmpName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('store_id, full_name, stores(name)').eq('id', user.id).single()
    if (!profile?.store_id) { router.push('/login'); return }
    setEmpName(profile.full_name)
    setStoreName((profile.stores as any)?.name ?? '')

    const { data: prods } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', profile.store_id)
      .eq('is_active', true)
      .order('stock', { ascending: true })

    const p = prods ?? []
    setProducts(p)

    // Pre-populate requests for low stock items
    const init: Record<string, { qty: string; priority: Priority }> = {}
    p.forEach((prod: any) => {
      const diff = prod.stock_alert - prod.stock
      if (diff > 0) {
        const priority: Priority = prod.stock <= 5 ? 'alta' : prod.stock <= prod.stock_alert ? 'media' : 'bassa'
        init[prod.id] = { qty: (prod.stock_alert * 2 - prod.stock).toString(), priority }
      }
    })
    setRequests(init)
    setLoading(false)
  }

  function setQty(id: string, qty: string) {
    setRequests(r => ({ ...r, [id]: { ...r[id], qty, priority: r[id]?.priority ?? 'media' } }))
  }
  function setPriority(id: string, priority: Priority) {
    setRequests(r => ({ ...r, [id]: { ...r[id], priority, qty: r[id]?.qty ?? '' } }))
  }

  async function sendRequest() {
    setSaving(true)
    const lines = Object.entries(requests).filter(([, v]) => v.qty && parseInt(v.qty) > 0)
    if (lines.length === 0) { setSaving(false); return }
    // In a real system this would create a restock_requests record
    // For now just simulate with a small delay
    await new Promise(r => setTimeout(r, 800))
    setSaving(false)
    setDone(true)
  }

  const priorityBadge = (p: Priority) => {
    const map = { alta: 'badge-danger', media: 'badge-warning', bassa: 'badge-gray' }
    return map[p]
  }
  const priorityLabel = (p: Priority) => ({ alta: 'Alta', media: 'Media', bassa: 'Bassa' }[p])

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>Caricamento...</div>

  if (done) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
      <div style={{ fontSize: 56 }}></div>
      <h3 style={{ textAlign: 'center' }}>Richiesta inviata!</h3>
      <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: 14 }}>L'amministratore ricevera la notifica di ricarica.</p>
      <button className="btn btn-primary" onClick={() => router.push('/employee/dashboard')}>Torna alla Dashboard</button>
    </div>
  )

  const lowItems = products.filter(p => p.stock <= p.stock_alert)
  const okItems = products.filter(p => p.stock > p.stock_alert)
  const requestCount = Object.values(requests).filter(v => v.qty && parseInt(v.qty) > 0).length

  return (
    <div className="page" style={{ paddingBottom: 80 }}>
      <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)', padding: 'var(--space-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3>Richiedi Ricarica</h3>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{storeName}  {empName}</div>
        </div>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}></button>
      </div>

      <div style={{ padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

        {/* Info banner */}
        <div style={{ background: 'var(--brand-primary-light)', border: '1px solid var(--brand-primary)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', fontSize: 13, color: 'var(--brand-primary-dark)', lineHeight: 1.5 }}>
          L'amministratore ricevera notifiche automatiche per i prodotti sotto la soglia minima. I prodotti piu venduti hanno soglie di riordino piu alte per garantire disponibilita continua.
        </div>

        {/* Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}>
                {['Prodotto', 'Giacenza Attuale', 'Soglia Minima', 'Qta Richiesta', 'Priorita'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Low stock items first */}
              {lowItems.map((prod, i) => (
                <tr key={prod.id} style={{ borderBottom: '1px solid var(--border-subtle)', background: prod.stock <= 5 ? 'rgba(239,68,68,0.04)' : undefined }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 14 }}>{prod.name}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontWeight: 700, color: prod.stock <= 5 ? 'var(--danger)' : 'var(--warning)' }}>{prod.stock}</span>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{prod.stock_alert}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <input
                      type="number" min="0"
                      value={requests[prod.id]?.qty ?? ''}
                      onChange={e => setQty(prod.id, e.target.value)}
                      style={{ width: 70, padding: '6px 10px', border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 14, fontWeight: 600, textAlign: 'center' }}
                      placeholder=""
                    />
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <select
                      value={requests[prod.id]?.priority ?? 'alta'}
                      onChange={e => setPriority(prod.id, e.target.value as Priority)}
                      style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border-default)', fontSize: 12, background: 'var(--bg-primary)' }}
                    >
                      <option value="alta">Alta</option>
                      <option value="media">Media</option>
                      <option value="bassa">Bassa</option>
                    </select>
                  </td>
                </tr>
              ))}
              {/* OK items */}
              {okItems.map(prod => (
                <tr key={prod.id} style={{ borderBottom: '1px solid var(--border-subtle)', opacity: 0.7 }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 14 }}>{prod.name}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--success)', fontWeight: 700 }}>{prod.stock}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{prod.stock_alert}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <input
                      type="number" min="0"
                      value={requests[prod.id]?.qty ?? ''}
                      onChange={e => setQty(prod.id, e.target.value)}
                      style={{ width: 70, padding: '6px 10px', border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 14, textAlign: 'center' }}
                      placeholder=""
                    />
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <select
                      value={requests[prod.id]?.priority ?? 'bassa'}
                      onChange={e => setPriority(prod.id, e.target.value as Priority)}
                      style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border-default)', fontSize: 12, background: 'var(--bg-primary)' }}
                    >
                      <option value="alta">Alta</option>
                      <option value="media">Media</option>
                      <option value="bassa">Bassa</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          onClick={sendRequest}
          disabled={saving || requestCount === 0}
          className="btn btn-primary btn-full btn-lg"
        >
          {saving ? 'Invio in corso...' : `Invia Richiesta${requestCount > 0 ? ` (${requestCount} prodotti)` : ''}`}
        </button>
      </div>
      <BottomNav />
    </div>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt } from '@/lib/utils'

interface Message { role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = [
  'Analisi vendite di oggi',
  'Prodotti sotto scorta',
  'Performance dipendenti',
  'Trend revenue settimana',
]

const DAILY_FREE_LIMIT = 50
const USAGE_KEY = 'bw_ai_usage'

export default function OwnerIntelligencePage() {
  const router = useRouter()
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [storeContext, setStoreContext] = useState('')
  const [contextLoading, setContextLoading] = useState(true)
  const [storeName, setStoreName] = useState('')
  const [usageCount, setUsageCount] = useState(0)
  const [showLimitWarning, setShowLimitWarning] = useState(false)
  const [serviceDown, setServiceDown] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Usage tracking
  function getUsageToday() {
    try {
      const stored = localStorage.getItem(USAGE_KEY)
      if (!stored) return { date: '', count: 0 }
      const parsed = JSON.parse(stored)
      const today = new Date().toISOString().split('T')[0]
      if (parsed.date !== today) return { date: today, count: 0 }
      return parsed
    } catch { return { date: '', count: 0 } }
  }

  function incrementUsage() {
    const today = new Date().toISOString().split('T')[0]
    const current = getUsageToday()
    const newCount = current.date === today ? current.count + 1 : 1
    localStorage.setItem(USAGE_KEY, JSON.stringify({ date: today, count: newCount }))
    setUsageCount(newCount)
    return newCount
  }

  useEffect(() => { loadContext(); setUsageCount(getUsageToday().count) }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function loadContext() {
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase
      .from('users').select('store_id, role, stores(name, organization_id)').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }

    const orgId = (profile.stores as any)?.organization_id
    setStoreName((profile.stores as any)?.name ?? 'Il tuo negozio')

    // Load ALL stores in the organization
    const { data: allStores } = await supabase.from('stores').select('id, name, city').eq('organization_id', orgId).eq('is_active', true)
    const stores = allStores ?? []

    const now = new Date()
    const today = new Date(now.setHours(0, 0, 0, 0)).toISOString()
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    let storeContextParts: string[] = []
    let totalTodayRevenue = 0
    let totalWeekRevenue = 0
    let totalTodayTxn = 0
    let allLowStock: string[] = []

    for (const store of stores) {
      const [{ data: todaySales }, { data: weekSales }, { data: lowStock }, { data: openShifts }] = await Promise.all([
        supabase.from('sales').select('total, payment_method, movement_type').eq('store_id', store.id).gte('created_at', today),
        supabase.from('sales').select('total, movement_type, created_at').eq('store_id', store.id).eq('movement_type', 'sale').gte('created_at', weekAgo),
        supabase.from('low_stock_products').select('name, stock, stock_alert').eq('store_id', store.id),
        supabase.from('shifts').select('period, users(full_name)').eq('store_id', store.id).eq('status', 'open'),
      ])

      const storeRevenue = (todaySales ?? []).filter(s => s.movement_type === 'sale').reduce((s, x) => s + x.total, 0)
      const storeTxn = (todaySales ?? []).filter(s => s.movement_type === 'sale').length
      const storeResi = (todaySales ?? []).filter(s => s.movement_type === 'reso').length
      const storeWeekRev = (weekSales ?? []).reduce((s, x) => s + x.total, 0)
      const staffOnDuty = (openShifts ?? []).map(s => (s.users as any)?.full_name).filter(Boolean).join(', ') || 'Nessuno'

      totalTodayRevenue += storeRevenue
      totalWeekRevenue += storeWeekRev
      totalTodayTxn += storeTxn

      // Revenue by day
      const byDay: Record<string, number> = {}
      for (const sale of (weekSales ?? [])) {
        const day = sale.created_at.split('T')[0]
        byDay[day] = (byDay[day] ?? 0) + sale.total
      }

      const lowStockList = (lowStock ?? []).map(p => `  - ${p.name}: ${p.stock} rimasti (soglia: ${p.stock_alert})`)
      if (lowStockList.length > 0) allLowStock.push(...lowStockList.map(l => `[${store.name}] ${l.trim()}`))

      storeContextParts.push(`
STORE "${store.name}"${store.city ? ` (${store.city})` : ''}:
- Revenue oggi: ${fmt(storeRevenue)} (${storeTxn} vendite, ${storeResi} resi)
- Revenue settimana: ${fmt(storeWeekRev)}
- Trend giornaliero: ${Object.entries(byDay).map(([d, v]) => `${d}: ${fmt(v)}`).join(', ') || 'Nessun dato'}
- Staff in turno: ${staffOnDuty}
- Alert stock: ${lowStockList.length === 0 ? 'Nessuno ✅' : lowStockList.length + ' prodotti sotto soglia'}${lowStockList.length > 0 ? '\n' + lowStockList.join('\n') : ''}`)
    }

    // Load warehouse data
    let warehouseCtx = ''
    const { data: warehouses } = await supabase.from('warehouses').select('id, name, type').eq('organization_id', orgId).eq('is_active', true)
    if (warehouses && warehouses.length > 0) {
      const whParts: string[] = []
      for (const wh of warehouses) {
        const { data: whStock } = await supabase.from('warehouse_stock').select('product_name, qty, stock_alert, cost_per_unit').eq('warehouse_id', wh.id)
        const totalItems = (whStock ?? []).reduce((s, i) => s + i.qty, 0)
        const totalValue = (whStock ?? []).reduce((s, i) => s + i.qty * (i.cost_per_unit || 0), 0)
        const lowWh = (whStock ?? []).filter(i => i.qty > 0 && i.qty <= i.stock_alert)
        const zeroWh = (whStock ?? []).filter(i => i.qty === 0)
        whParts.push(`${wh.type === 'central' ? '🏭' : '📦'} ${wh.name}: ${(whStock ?? []).length} SKU, ${totalItems} unità, valore ${fmt(totalValue)}${lowWh.length > 0 ? `, ${lowWh.length} bassi` : ''}${zeroWh.length > 0 ? `, ${zeroWh.length} esauriti` : ''}`)
      }
      warehouseCtx = `\n\nMAGAZZINI:\n${whParts.join('\n')}`
    }

    // Load vending data
    let vendingCtx = ''
    const { data: vendingSales } = await supabase.from('vending_sales').select('cash_in, dispenser_id, created_at').gte('created_at', today)
    if (vendingSales && vendingSales.length > 0) {
      const vendingRevenue = vendingSales.reduce((s, v) => s + (v.cash_in || 0), 0)
      vendingCtx = `\n\nH24 VENDING:\n- Vendite oggi: ${vendingSales.length} erogazioni, ${fmt(vendingRevenue)} incassato`
    }

    // All employees
    const { data: allEmployees } = await supabase.from('users').select('full_name, stores(name)').eq('role', 'employee').eq('is_active', true).in('store_id', stores.map(s => s.id))

    const ctx = `
Sei l'AI di BrainWare — il software gestionale che l'utente sta usando in questo momento.
TU SEI PARTE DEL SISTEMA. Quando l'utente chiede "dove trovo X" o "come faccio Y", rispondi indicando le pagine esatte di BrainWare.
Rispondi SEMPRE nella stessa lingua in cui l'utente scrive. Se scrive in italiano rispondi in italiano, se in inglese rispondi in inglese, ecc.
Sii diretto e professionale.
Hai accesso ai dati REALI di TUTTI gli store dell'organizzazione.

=== COME FUNZIONA BRAINWARE ===

PAGINE DISPONIBILI (sidebar sinistra):

📊 Dashboard — Panoramica KPI: vendite oggi, settimana, mese. Grafici trend. Filtrabile per store.
🧾 Registro Vendite — Tabella dettagliata di tutte le vendite con colonne: data, ora, negozio, pagamento, totale, cliente, nazionalità, how found, prodotti venduti. Filtrabile per store (tab in alto) e range date. Esportabile in Excel.
📸 Foto Registro — Foto scattate dai dipendenti durante i turni.
📦 Prodotti — Gestione catalogo prodotti: nome, prezzo, categoria, stock, barcode. Si può attivare/disattivare un prodotto.
📈 Prodotti Analytics — Analisi vendite per prodotto: best seller, trend, margini.
👥 Team Performance — Performance dipendenti: vendite per persona, ore lavorate, media vendita.
💳 Members — Gestione tessere fedeltà clienti: nome, telefono, email, punti.

MAGAZZINO:
🏭 Centrale — Stock del magazzino centrale.
📦 Secondari — Magazzini secondari.
🏪 Stock Store — Stock per ogni punto vendita.
📋 Movimenti Stock — Storico movimenti (ricariche, trasferimenti).
📤 Bulk Upload — Caricamento massivo prodotti via CSV/Excel.
📥 Inventario Iniziale — Setup iniziale stock.
🔍 Audit Inventario — Controllo discrepanze inventario.

GESTIONE:
🏪 Multistore — Gestione multi-negozio: aggiungere store, configurare.
📋 Task — Assegnare task ai dipendenti.
🎟️ Codici Promo — Creare e gestire codici promozionali.
👤 Dipendenti — Aggiungere/modificare dipendenti, PIN, ruoli.
🛍️ Shopify — Integrazione ordini Shopify.
🌐 E-commerce — Gestione e-commerce.
🏧 H24 Vending — Gestione distributori automatici.
🔧 Manutenzione — Log manutenzione negozi.
🧠 Intelligence AI — Questa chat! Analisi dati in linguaggio naturale.
🤖 Gestione AI — Configurare la knowledge base per l'AI dipendente (FAQ, procedure, documenti).
📊 Database — Tutte le tabelle del sistema in formato spreadsheet: Prodotti, Vendite, Prod. Venduti, Turni, Spese, Members, Ricarica, Store Maint., Person Counted, Inventario, Notifiche, Dipendenti, Task, Manutenzione, Day Off + tab calcolati (Cash/POS, Deposits, Avg Sales, Sold Items).
📖 Help Center — Guide e documentazione.
⚙️ Impostazioni — Configurazione account e brand.

FLUSSO OPERATIVO:
- I DIPENDENTI usano l'app tablet per: check-in turno, registrare vendite, contare inventario, segnalare manutenzione, registrare spese.
- L'OWNER usa il pannello desktop per: monitorare tutto, analizzare dati, gestire prodotti/dipendenti/stock.
- Ogni azione del dipendente genera una NOTIFICA per l'owner (🔔 nella sidebar).

=== DATI REALI ORGANIZZAZIONE ===

RIEPILOGO:
- Store totali: ${stores.length} (${stores.map(s => s.name).join(', ')})
- Revenue TOTALE oggi: ${fmt(totalTodayRevenue)} (${totalTodayTxn} transazioni)
- Revenue TOTALE settimana: ${fmt(totalWeekRevenue)}
- Dipendenti totali: ${(allEmployees ?? []).length}
- Alert inventario: ${allLowStock.length === 0 ? 'Nessuno ✅' : allLowStock.length + ' prodotti'}

--- DETTAGLIO PER STORE ---
${storeContextParts.join('\n')}
${warehouseCtx}
${vendingCtx}

${allLowStock.length > 0 ? `\nALERT INVENTARIO GLOBALE:\n${allLowStock.join('\n')}` : ''}

DIPENDENTI: ${(allEmployees ?? []).map(e => `${e.full_name} (${(e.stores as any)?.name})`).join(', ') || 'Nessuno'}

=== REGOLE DI RISPOSTA ===
- Quando l'utente chiede "dove trovo X", indica la pagina esatta di BrainWare con l'icona.
- Quando confronti store usa tabelle markdown.
- Sii conciso ma esauriente.
- Se l'utente chiede di uno store specifico, rispondi solo su quello.
- NON dire mai "contatta il reparto IT" — TU sei il sistema, aiuta direttamente.
- Se l'utente chiede come fare qualcosa, dai istruzioni step-by-step con i nomi delle pagine BrainWare.
    `.trim()

    setStoreContext(ctx)
    setContextLoading(false)
  }

  async function sendMessage(text?: string) {
    const msg = text ?? input.trim()
    if (!msg || loading) return

    // Check daily limit
    const currentUsage = getUsageToday().count
    if (currentUsage >= DAILY_FREE_LIMIT) {
      setShowLimitWarning(true)
      return
    }

    // Warn at 80% usage
    if (currentUsage >= DAILY_FREE_LIMIT * 0.8) {
      setShowLimitWarning(true)
    }

    setInput('')
    setLoading(true)
    incrementUsage()

    const newMessages: Message[] = [...messages, { role: 'user', content: msg }]
    setMessages(newMessages)

    try {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, context: storeContext }),
      })
      const data = await response.json()
      if (data.quotaExhausted) {
        setServiceDown(true)
        setMessages(prev => [...prev, { role: 'assistant', content: '⏳ Il servizio AI ha raggiunto il limite giornaliero di Google. Il servizio si resetta automaticamente (di solito entro qualche ora). Riprova più tardi!' }])
      } else if (data.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${data.error}` }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Errore di connessione al server AI.' }])
    }
    setLoading(false)
  }

  const remaining = Math.max(0, DAILY_FREE_LIMIT - usageCount)
  const usagePct = Math.min(100, (usageCount / DAILY_FREE_LIMIT) * 100)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <h2>Intelligence AI</h2>
          <span className="badge badge-brand" style={{ fontSize: 10 }}>BETA</span>
          <span className="badge badge-gray" style={{ fontSize: 11 }}>{contextLoading ? 'Caricamento...' : '✅ Dati caricati'}</span>
          <span className={`badge ${remaining <= 10 ? 'badge-warning' : 'badge-gray'}`} style={{ fontSize: 10, marginLeft: 'auto' }}>
            {remaining}/{DAILY_FREE_LIMIT} richieste gratuite
          </span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Analizza vendite, performance, inventario del tuo negozio in linguaggio naturale</p>

        {/* Usage bar */}
        <div style={{ marginTop: 8, background: 'var(--bg-surface)', borderRadius: 20, height: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 20, width: `${usagePct}%`, background: usagePct >= 80 ? 'var(--danger)' : usagePct >= 50 ? 'var(--warning)' : 'var(--brand-primary)', transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Service Quota Warning */}
      {serviceDown && (
        <div style={{ background: '#FEF2F2', border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--danger)' }}>⏳ Servizio AI temporaneamente non disponibile</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>La quota giornaliera del servizio Google Gemini è stata raggiunta. Si resetta automaticamente entro qualche ora.</div>
          </div>
          <button onClick={() => setServiceDown(false)} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}>✕</button>
        </div>
      )}

      {/* User Limit Warning */}
      {showLimitWarning && !serviceDown && (
        <div style={{ background: usageCount >= DAILY_FREE_LIMIT ? '#FEF2F2' : '#FFFBEB', border: `1px solid ${usageCount >= DAILY_FREE_LIMIT ? 'var(--danger)' : 'var(--warning)'}`, borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: usageCount >= DAILY_FREE_LIMIT ? 'var(--danger)' : '#92400E' }}>
              {usageCount >= DAILY_FREE_LIMIT ? '🚫 Limite giornaliero raggiunto' : '⚠️ Quasi al limite'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              {usageCount >= DAILY_FREE_LIMIT
                ? `Hai usato tutte le ${DAILY_FREE_LIMIT} richieste gratuite di oggi. Le richieste si azzerano alla mezzanotte.`
                : `Hai usato ${usageCount}/${DAILY_FREE_LIMIT} richieste gratuite oggi. Oltre questa soglia l'AI non sarà disponibile fino a domani.`
              }
            </div>
          </div>
          <button onClick={() => setShowLimitWarning(false)} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}>✕</button>
        </div>
      )}

      {/* Chat */}
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        {messages.length === 0 && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 'var(--space-xl)' }}>
            <div style={{ fontSize: 48 }}></div>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ marginBottom: 8 }}>Come posso aiutarti oggi?</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Analizza vendite, performance, inventario e molto altro</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', maxWidth: 480 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => sendMessage(s)} className="btn btn-secondary" style={{ textAlign: 'left', justifyContent: 'flex-start', fontSize: 13 }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '80%', padding: '12px 16px',
              borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
              background: msg.role === 'user' ? 'var(--brand-primary)' : 'var(--bg-surface)',
              color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
              fontSize: 14, lineHeight: 1.6,
              border: msg.role === 'assistant' ? '1px solid var(--border-subtle)' : 'none',
              whiteSpace: 'pre-wrap',
            }}>
              {msg.role === 'assistant' && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-primary)', marginBottom: 4, letterSpacing: '0.04em' }}>BrainWare AI</div>}
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: 6, padding: '12px 0' }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-primary)', opacity: 0.4, animation: `bounce 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="Chiedi qualcosa sui tuoi dati..." disabled={contextLoading}
          className="input" style={{ flex: 1, height: 48 }} />
        <button onClick={() => sendMessage()} disabled={!input.trim() || loading || contextLoading} className="btn btn-primary" style={{ height: 48, minWidth: 80 }}>
          Invia
        </button>
      </div>

      <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}`}</style>
    </div>
  )
}

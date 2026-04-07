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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase
      .from('users').select('store_id, role, stores(name)').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }

    setStoreName((profile.stores as any)?.name ?? 'Il tuo negozio')

    const now = new Date()
    const today = new Date(now.setHours(0, 0, 0, 0)).toISOString()
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [{ data: todaySales }, { data: weekSales }, { data: lowStock }, { data: employees }, { data: openShifts }] = await Promise.all([
      supabase.from('sales').select('total, payment_method, movement_type, customer_name, customer_nationality').eq('store_id', profile.store_id).gte('created_at', today),
      supabase.from('sales').select('total, movement_type, created_at').eq('store_id', profile.store_id).eq('movement_type', 'sale').gte('created_at', weekAgo),
      supabase.from('low_stock_products').select('name, stock, stock_alert').eq('store_id', profile.store_id),
      supabase.from('users').select('full_name').eq('store_id', profile.store_id).eq('role', 'employee').eq('is_active', true),
      supabase.from('shifts').select('period, opened_at, users(full_name)').eq('store_id', profile.store_id).eq('status', 'open'),
    ])

    const todayRevenue = (todaySales ?? []).filter(s => s.movement_type === 'sale').reduce((s, x) => s + x.total, 0)
    const todayTxn = (todaySales ?? []).filter(s => s.movement_type === 'sale').length
    const todayResi = (todaySales ?? []).filter(s => s.movement_type === 'reso').length
    const weekRevenue = (weekSales ?? []).reduce((s, x) => s + x.total, 0)

    // Revenue by day this week
    const byDay: Record<string, number> = {}
    for (const sale of (weekSales ?? [])) {
      const day = sale.created_at.split('T')[0]
      byDay[day] = (byDay[day] ?? 0) + sale.total
    }

    const ctx = `
Sei l'AI di BrainWare per il negozio "${(profile.stores as any)?.name}".
Rispondi in italiano, in modo diretto e professionale.
Hai accesso ai dati REALI di questo negozio.

DATI OGGI:
- Revenue: ${fmt(todayRevenue)} (${todayTxn} transazioni)
- Resi: ${todayResi}
- Dipendenti in turno: ${(openShifts ?? []).map(s => (s.users as any)?.full_name).join(', ') || 'Nessuno'}

DATI SETTIMANA (ultimi 7 giorni):
- Revenue totale: ${fmt(weekRevenue)}
- Andamento per giorno: ${Object.entries(byDay).map(([d, v]) => `${d}: ${fmt(v)}`).join(', ')}

ALERT INVENTARIO:
${(lowStock ?? []).length === 0 ? 'Nessun prodotto sotto scorta' : (lowStock ?? []).map(p => `- ${p.name}: ${p.stock} rimasti (alert: ${p.stock_alert})`).join('\n')}

DIPENDENTI ATTIVI: ${(employees ?? []).map(e => e.full_name).join(', ') || 'Nessuno'}

Quando mostri dati in tabella usa markdown. Sii conciso ma esauriente.
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
      if (data.error) {
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

      {/* Limit Warning */}
      {showLimitWarning && (
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

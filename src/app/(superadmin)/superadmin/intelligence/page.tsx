'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt } from '@/lib/utils'

interface Message { role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = [
  'Revenue per owner questo mese vs mese scorso',
  'Confronto negozi per margine medio',
  'Anomalie e alert su tutti gli store',
  'Top 5 prodotti venduti globalmente',
]

export default function SuperAdminIntelligencePage() {
  const router = useRouter()
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [contextLoading, setContextLoading] = useState(true)
  const [globalContext, setGlobalContext] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadContext() }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function loadContext() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/superadmin/login'); return }

    // Build context from all owners data
    const [{ data: sales }, { data: owners }, { data: stores }] = await Promise.all([
      supabase.from('sales').select('total, movement_type, payment_method, created_at, store_id').eq('movement_type', 'sale').gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from('users').select('full_name, store_id, is_active').eq('role', 'owner'),
      supabase.from('stores').select('id, name, city, is_active'),
    ])

    const totalRevenue = (sales ?? []).reduce((s, x) => s + x.total, 0)
    const totalTxn = (sales ?? []).length

    // Revenue by store
    const byStore: Record<string, number> = {}
    for (const sale of (sales ?? [])) {
      byStore[sale.store_id] = (byStore[sale.store_id] ?? 0) + sale.total
    }

    const storeRevenues = (stores ?? []).map(s => ({
      name: s.name, city: s.city, revenue: byStore[s.id] ?? 0
    })).sort((a, b) => b.revenue - a.revenue)

    const ctx = `
Sei l'AI del pannello Super Admin di BrainWare, una piattaforma di gestione retail.
Hai accesso ai dati aggregati di TUTTI gli owner e negozi della piattaforma.

DATI GLOBALI (ultimi 30 giorni):
- Revenue totale: ${fmt(totalRevenue)}
- Transazioni totali: ${totalTxn}
- Scontrino medio: ${fmt(totalTxn > 0 ? totalRevenue / totalTxn : 0)}
- Owners attivi: ${(owners ?? []).filter(o => o.is_active).length}
- Negozi attivi: ${(stores ?? []).filter(s => s.is_active).length}

REVENUE PER NEGOZIO:
${storeRevenues.map(s => `- ${s.name} (${s.city ?? 'N/A'}): ${fmt(s.revenue)}`).join('\n')}

OWNERS:
${(owners ?? []).map(o => `- ${o.full_name}`).join('\n')}

Rispondi in italiano, in modo diretto e professionale.
Quando mostri dati in tabella, usa formato markdown.
    `.trim()

    setGlobalContext(ctx)
    setContextLoading(false)
  }

  async function sendMessage(text?: string) {
    const msg = text ?? input.trim()
    if (!msg || loading) return
    setInput('')
    setLoading(true)

    const newMessages: Message[] = [...messages, { role: 'user', content: msg }]
    setMessages(newMessages)

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: globalContext,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      const data = await response.json()
      const reply = data.content?.[0]?.text ?? 'Errore nella risposta.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Errore di connessione. Riprova.' }])
    }

    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ color: 'white', fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700 }}>Intelligence AI</h2>
          <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, background: 'rgba(34,197,94,0.15)', color: '#22C55E', fontWeight: 700, letterSpacing: '0.05em' }}>BETA</span>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 }}>
          {contextLoading ? 'Caricamento dati...' : `Contesto: tutti gli owner  dati ultimi 30 giorni`}
        </p>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#0F172A', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {messages.length === 0 && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 24 }}>
            <div style={{ fontSize: 40 }}></div>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ color: 'white', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 20, marginBottom: 8 }}>Intelligence Super Admin</h3>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Analizza dati aggregati di tutti gli owner, negozi e performance globali</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', maxWidth: 560 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => sendMessage(s)} style={{ padding: '12px 16px', background: '#1E293B', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: 'rgba(255,255,255,0.7)', fontSize: 13, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '80%',
              padding: '12px 16px',
              borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
              background: msg.role === 'user' ? '#22C55E' : '#1E293B',
              color: msg.role === 'user' ? 'white' : 'rgba(255,255,255,0.85)',
              fontSize: 14, lineHeight: 1.6,
              border: msg.role === 'assistant' ? '1px solid rgba(255,255,255,0.06)' : 'none',
              whiteSpace: 'pre-wrap',
            }}>
              {msg.role === 'assistant' && (
                <div style={{ fontSize: 11, fontWeight: 700, color: '#22C55E', marginBottom: 6, letterSpacing: '0.05em' }}>BrainWare AI</div>
              )}
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ padding: '12px 16px', borderRadius: '12px 12px 12px 4px', background: '#1E293B', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="Chiedi qualcosa sui dati di tutti gli owner..."
          disabled={contextLoading}
          style={{ flex: 1, background: '#1E293B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '14px 16px', fontSize: 14, color: 'white', outline: 'none', fontFamily: 'var(--font-body)' }}
        />
        <button onClick={() => sendMessage()} disabled={!input.trim() || loading || contextLoading}
          style={{ padding: '14px 20px', background: '#22C55E', border: 'none', borderRadius: 10, color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: (!input.trim() || loading) ? 0.5 : 1, fontFamily: 'var(--font-body)' }}>
          Invia
        </button>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:.3;transform:scale(.8)} 50%{opacity:1;transform:scale(1)} }`}</style>
    </div>
  )
}

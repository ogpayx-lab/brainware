'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BottomNav } from '@/components/employee/BottomNav'

interface Message { role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = [
  '🔄 Come gestisco un reso?',
  '🏪 Checklist apertura negozio',
  '💳 Il POS non funziona',
  '📦 Come fare un inventario',
  '⚡ Problemi con la cassa',
  '📋 Procedure di chiusura',
]

const DAILY_LIMIT = 30
const USAGE_KEY = 'bw_emp_ai_usage'

export default function EmployeeAIPage() {
  const router = useRouter()
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [contextLoading, setContextLoading] = useState(true)
  const [usageCount, setUsageCount] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)

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
  }

  useEffect(() => { loadKnowledgeBase(); setUsageCount(getUsageToday().count) }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function loadKnowledgeBase() {
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase.from('users').select('store_id, full_name, stores(name)').eq('id', user.id).single()
    if (!profile?.store_id) return

    const { data: kb } = await supabase
      .from('ai_knowledge_base').select('*').eq('store_id', profile.store_id).eq('is_active', true).order('sort_order')

    const storeName = (profile.stores as any)?.name ?? 'il negozio'
    const employeeName = profile.full_name ?? 'Dipendente'

    const kbText = (kb ?? []).map(item => {
      if (item.type === 'faq') return `DOMANDA: ${item.question}\nRISPOSTA: ${item.answer}`
      if (item.type === 'document') return `DOCUMENTO "${item.title}": ${item.answer}`
      return `${item.title?.toUpperCase() ?? 'PROCEDURA'}: ${item.answer}`
    }).join('\n\n')

    const prompt = `
Sei l'assistente AI di BrainWare per i dipendenti di "${storeName}".
Il dipendente che ti sta parlando si chiama ${employeeName}.

MODALITÀ: SICURA — ACCESSO DATI LIMITATO

REGOLE FONDAMENTALI (NON VIOLARLE MAI):
1. NON fornire MAI dati su: vendite, ricavi, incassi, fatturato, margini, profitti, costi
2. NON fornire MAI dati su: performance dei dipendenti, classifiche, obiettivi di vendita
3. NON fornire MAI dati su: inventario dettagliato, quantità in stock, prezzi di acquisto
4. NON fornire MAI dati su: informazioni personali di altri dipendenti o clienti
5. Se qualcuno chiede dati sensibili rispondi: "Non ho accesso a queste informazioni. Chiedi al responsabile del negozio."
6. NON inventare numeri, statistiche o dati specifici del negozio

COSA PUOI FARE:
- Rispondere a domande operative (apertura, chiusura, procedure)
- Aiutare con problemi tecnici (POS, cassa, stampante, terminale)
- Spiegare procedure per resi, cambi, reclami
- Dare consigli sulla gestione del cliente
- Motivare e supportare il dipendente
- Rispondere usando la knowledge base del negozio (sotto)
- Dare consigli generali sulla vendita retail e cannabis light

Rispondi in italiano, in modo amichevole e pratico. Sii conciso.

${kbText ? `\nKNOWLEDGE BASE DEL NEGOZIO:\n${kbText}` : '\nNessuna FAQ configurata dal proprietario. Rispondi con le tue conoscenze generali sulla gestione retail.'}
    `.trim()

    setSystemPrompt(prompt)
    setContextLoading(false)
  }

  async function sendMessage(text?: string) {
    const msg = text ?? input.trim()
    if (!msg || loading) return

    const current = getUsageToday().count
    if (current >= DAILY_LIMIT) {
      setMessages(prev => [...prev,
        { role: 'user', content: msg },
        { role: 'assistant', content: '⏳ Hai raggiunto il limite di richieste giornaliere. Le richieste si azzerano alla mezzanotte. Per informazioni urgenti, chiedi al responsabile del negozio.' }
      ])
      return
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
        body: JSON.stringify({ messages: newMessages, context: systemPrompt }),
      })
      const data = await response.json()
      if (data.quotaExhausted) {
        setMessages(prev => [...prev, { role: 'assistant', content: '⏳ Il servizio AI è temporaneamente non disponibile. Riprova tra qualche ora.' }])
      } else if (data.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${data.error}` }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Errore di connessione. Riprova.' }])
    }
    setLoading(false)
  }

  const remaining = Math.max(0, DAILY_LIMIT - usageCount)

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', height: '100vh', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)', padding: 'var(--space-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3>🤖 Assistente AI</h3>
            <span className="badge badge-success" style={{ fontSize: 10 }}>🔒 Modalità Sicura</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>Aiuto operativo · Nessun accesso a dati aziendali</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: remaining <= 5 ? 'var(--danger)' : 'var(--text-tertiary)' }}>{remaining}/{DAILY_LIMIT}</span>
          <button onClick={() => setMessages([])} className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>+ Nuova</button>
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        {messages.length === 0 && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 'var(--space-xl)', textAlign: 'center' }}>
            <div style={{ fontSize: 48 }}>🤖</div>
            <div>
              <h3 style={{ marginBottom: 8 }}>Ciao! Come posso aiutarti?</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Procedure, problemi tecnici, gestione clienti e molto altro</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%', maxWidth: 360 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => sendMessage(s)} className="btn btn-secondary" style={{ textAlign: 'left', justifyContent: 'flex-start', fontSize: 12, padding: '10px 12px', lineHeight: 1.3 }}>
                  {s}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', maxWidth: 300, marginTop: 8 }}>
              🔒 Non ho accesso a vendite, incassi o dati aziendali. Posso aiutarti solo con procedure operative e problemi tecnici.
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {msg.role === 'assistant' && (
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--brand-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, marginRight: 8, alignSelf: 'flex-end' }}>🤖</div>
            )}
            <div style={{
              maxWidth: '80%', padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              background: msg.role === 'user' ? 'var(--brand-primary)' : 'var(--bg-primary)',
              color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
              fontSize: 14, lineHeight: 1.6,
              border: msg.role === 'assistant' ? '1px solid var(--border-subtle)' : 'none',
              whiteSpace: 'pre-wrap',
              boxShadow: 'var(--shadow-sm)',
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: 4, padding: '8px 0', alignItems: 'center' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--brand-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🤖</div>
            <div style={{ display: 'flex', gap: 4, padding: '10px 14px', background: 'var(--bg-primary)', borderRadius: '14px 14px 14px 4px', border: '1px solid var(--border-subtle)' }}>
              {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand-primary)', animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: 'var(--space-md)', background: 'var(--bg-primary)', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 8, flexShrink: 0 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder={remaining > 0 ? 'Chiedi qualcosa...' : 'Limite raggiunto per oggi'} disabled={contextLoading || remaining <= 0}
          className="input" style={{ flex: 1 }} />
        <button onClick={() => sendMessage()} disabled={!input.trim() || loading || contextLoading || remaining <= 0} className="btn btn-primary" style={{ minWidth: 68 }}>
          {loading ? '...' : 'Invia'}
        </button>
      </div>

      <BottomNav />
      <style>{`@keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}`}</style>
    </div>
  )
}

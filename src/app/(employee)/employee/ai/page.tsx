'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BottomNav } from '@/components/employee/BottomNav'

interface Message { role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = [
  'Come gestisco un reso?',
  'Motivami!',
  'FAQ sui prodotti',
  'Checklist apertura',
]

export default function EmployeeAIPage() {
  const router = useRouter()
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [contextLoading, setContextLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadKnowledgeBase() }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function loadKnowledgeBase() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase.from('users').select('store_id, stores(name)').eq('id', user.id).single()
    if (!profile?.store_id) return

    const { data: kb } = await supabase
      .from('ai_knowledge_base').select('*').eq('store_id', profile.store_id).eq('is_active', true).order('sort_order')

    const storeName = (profile.stores as any)?.name ?? 'il negozio'
    const kbText = (kb ?? []).map(item => {
      if (item.type === 'faq') return `DOMANDA: ${item.question}\nRISPOSTA: ${item.answer}`
      return `${item.title?.toUpperCase() ?? 'PROCEDURA'}: ${item.answer}`
    }).join('\n\n')

    const prompt = `
Sei l'assistente AI di BrainWare per i dipendenti di ${storeName}.
Modalita: SICURA  non hai accesso a dati aziendali sensibili, vendite, o storico.
Rispondi in italiano, in modo amichevole e pratico.
Il tuo ruolo e aiutare i dipendenti nella gestione quotidiana del negozio.

${kbText ? `KNOWLEDGE BASE DEL NEGOZIO:\n${kbText}` : 'Nessuna FAQ configurata dal proprietario. Rispondi con le tue conoscenze generali sulla gestione retail.'}

Regole:
- NON condividere dati su vendite, incassi, o performance specifici
- Puoi motivare, spiegare procedure e rispondere su prodotti
- Per domande fuori dalla tua competenza, suggerisci di parlare con il proprietario
    `.trim()

    setSystemPrompt(prompt)
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
          max_tokens: 600,
          system: systemPrompt,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await response.json()
      const reply = data.content?.[0]?.text ?? 'Non riesco a rispondere al momento.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Errore di connessione. Riprova.' }])
    }
    setLoading(false)
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', height: '100vh', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)', padding: 'var(--space-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3>Assistente AI</h3>
            <span className="badge badge-gray" style={{ fontSize: 10 }}>Modalita Sicura</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>Non ho accesso a dati aziendali sensibili</div>
        </div>
        <button onClick={() => setMessages([])} className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>+ Nuova Chat</button>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        {messages.length === 0 && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 'var(--space-xl)', textAlign: 'center' }}>
            <div style={{ fontSize: 48 }}></div>
            <div>
              <h3 style={{ marginBottom: 8 }}>Ciao! Come posso aiutarti?</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Sono il tuo assistente per la gestione quotidiana del negozio</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%', maxWidth: 340 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => sendMessage(s)} className="btn btn-secondary" style={{ textAlign: 'left', justifyContent: 'flex-start', fontSize: 12 }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {msg.role === 'assistant' && (
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--brand-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, marginRight: 8, alignSelf: 'flex-end' }}></div>
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
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--brand-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}></div>
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
          placeholder="Chiedi qualcosa sulla gestione del negozio..." disabled={contextLoading}
          className="input" style={{ flex: 1 }} />
        <button onClick={() => sendMessage()} disabled={!input.trim() || loading || contextLoading} className="btn btn-primary" style={{ minWidth: 68 }}>
          {loading ? '...' : 'Invia'}
        </button>
      </div>

      <BottomNav />
      <style>{`@keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}`}</style>
    </div>
  )
}

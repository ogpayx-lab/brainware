'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function DemoPage() {
  const [loading, setLoading] = useState<'owner' | 'employee' | null>(null)
  const [error, setError] = useState('')

  async function startDemo(view: 'owner' | 'employee') {
    setLoading(view)
    setError('')
    try {
      const res = await fetch('/api/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ view }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        setLoading(null)
        return
      }
      // Set session in browser
      const supabase = createClient()
      await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      })
      window.location.href = data.redirect
    } catch {
      setError('Errore di rete. Riprova.')
      setLoading(null)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0F0F23 0%, #1A1A3E 50%, #0F0F23 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{ maxWidth: 680, width: '100%', textAlign: 'center' }}>
        {/* Back */}
        <Link href="/" style={{
          color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: 13,
          display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 32,
        }}>
          ← Torna alla home
        </Link>

        {/* Logo */}
        <div style={{
          width: 56, height: 56, borderRadius: 14, margin: '0 auto 16px',
          background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, fontWeight: 800, color: 'white',
        }}>B</div>

        <h1 style={{ color: 'white', fontSize: 32, fontWeight: 800, marginBottom: 8 }}>
          Prova BrainWare
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16, marginBottom: 40, lineHeight: 1.6 }}>
          Esplora la piattaforma con dati di esempio.<br/>
          Nessuna registrazione richiesta.
        </p>

        {/* Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Owner */}
          <div style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16, padding: 28, cursor: 'pointer',
            transition: 'all 0.3s',
          }}
            onClick={() => !loading && startDemo('owner')}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366F1'; e.currentTarget.style.background = 'rgba(99,102,241,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>👑</div>
            <h3 style={{ color: 'white', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Vista Owner</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 1.5, marginBottom: 20 }}>
              Dashboard completa con KPI, vendite, team performance, inventario, System Log e tutte le funzionalità di gestione.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center', marginBottom: 16 }}>
              {['📊 Dashboard', '💰 Vendite', '👥 Team', '📦 Magazzino'].map(f => (
                <span key={f} style={{
                  padding: '3px 8px', borderRadius: 6, fontSize: 10,
                  background: 'rgba(99,102,241,0.15)', color: '#818CF8',
                }}>{f}</span>
              ))}
            </div>
            <button disabled={!!loading} style={{
              width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
              background: loading === 'owner' ? '#4F46E5' : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              color: 'white', fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer',
            }}>
              {loading === 'owner' ? '⏳ Caricamento...' : '🚀 Entra come Owner'}
            </button>
          </div>

          {/* Employee */}
          <div style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16, padding: 28, cursor: 'pointer',
            transition: 'all 0.3s',
          }}
            onClick={() => !loading && startDemo('employee')}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#22C55E'; e.currentTarget.style.background = 'rgba(34,197,94,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>👤</div>
            <h3 style={{ color: 'white', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Vista Dipendente</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 1.5, marginBottom: 20 }}>
              POS per le vendite, gestione turni, conteggio inventario, fidelity card e l'esperienza quotidiana del dipendente.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center', marginBottom: 16 }}>
              {['🛒 POS', '⏰ Turni', '📸 Foto', '💳 Fidelity'].map(f => (
                <span key={f} style={{
                  padding: '3px 8px', borderRadius: 6, fontSize: 10,
                  background: 'rgba(34,197,94,0.15)', color: '#4ADE80',
                }}>{f}</span>
              ))}
            </div>
            <button disabled={!!loading} style={{
              width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
              background: loading === 'employee' ? '#16A34A' : 'linear-gradient(135deg, #22C55E, #16A34A)',
              color: 'white', fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer',
            }}>
              {loading === 'employee' ? '⏳ Caricamento...' : '🚀 Entra come Dipendente'}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 20, padding: '10px 16px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#FCA5A5', fontSize: 13 }}>
            {error}
          </div>
        )}

        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 24 }}>
          I dati demo sono di esempio e si resettano periodicamente. Nessun dato reale è esposto.
        </p>
      </div>
    </div>
  )
}

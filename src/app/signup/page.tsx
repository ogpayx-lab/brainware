'use client'
import { useState, FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const supabase = createClient()
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  async function handleSignup(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (form.password !== form.confirm) { setError('Le password non coincidono.'); return }
    if (form.password.length < 8) { setError('La password deve essere di almeno 8 caratteri.'); return }
    if (!form.full_name.trim()) { setError('Inserisci il tuo nome completo.'); return }
    setLoading(true)

    const { data, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.full_name.trim() },
        // Dopo conferma email, torna all'onboarding
        emailRedirectTo: `${window.location.origin}/onboarding`,
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (!data.user) {
      setError('Errore durante la registrazione. Riprova.')
      setLoading(false)
      return
    }

    // data.session === null significa che Supabase richiede conferma email
    if (!data.session) {
      setEmailSent(true)
      setLoading(false)
      return
    }

    // Se la conferma email è disabilitata, la sessione è già attiva → onboarding
    window.location.href = '/onboarding'
  }

  // Schermata "Controlla la tua email"
  if (emailSent) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 440, background: 'var(--bg-primary)', borderRadius: 16, padding: '40px 32px 32px', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 20px' }}>✉️</div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Controlla la tua email</h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
            Abbiamo inviato un link di conferma a <br />
            <strong style={{ color: 'var(--text-primary)' }}>{form.email}</strong>
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 24 }}>
            Clicca sul link nell&apos;email per attivare il tuo account e completare la registrazione.
          </p>
          <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400E', marginBottom: 20 }}>
            Non trovi l&apos;email? Controlla anche la cartella <strong>Spam / Junk</strong>.
          </div>
          <a href="/login" style={{ color: 'var(--brand-primary)', fontWeight: 600, textDecoration: 'none', fontSize: 14 }}>
            Torna al login →
          </a>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 440, background: 'var(--bg-primary)', borderRadius: 16, padding: '40px 32px 32px', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border-subtle)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 26, color: 'white', margin: '0 auto 12px' }}>B</div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700 }}>Crea il tuo account</h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>Inizia la prova gratuita di BrainWare</p>
        </div>
        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="input-group">
            <label className="input-label">Nome completo</label>
            <input className="input" type="text" placeholder="Mario Rossi" required value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
          </div>
          <div className="input-group">
            <label className="input-label">Email</label>
            <input className="input" type="email" placeholder="mario@email.it" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="input-group">
            <label className="input-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input className="input" type={showPass ? 'text' : 'password'} placeholder="Min. 8 caratteri" required value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} style={{ paddingRight: 44 }} />
              <button type="button" onClick={() => setShowPass(p => !p)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-tertiary)', padding: 4 }} aria-label="Mostra password">
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Conferma password</label>
            <div style={{ position: 'relative' }}>
              <input className="input" type={showConfirm ? 'text' : 'password'} placeholder="Ripeti la password" required value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} style={{ paddingRight: 44 }} />
              <button type="button" onClick={() => setShowConfirm(p => !p)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-tertiary)', padding: 4 }} aria-label="Mostra conferma password">
                {showConfirm ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          {error && (
            <div style={{ background: 'var(--danger-light)', border: '1px solid var(--danger)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--danger)' }}>
              {error}
            </div>
          )}
          <button type="submit" disabled={loading} className="btn btn-primary btn-full btn-lg">
            {loading ? 'Creazione account...' : 'Crea Account Gratuito'}
          </button>
        </form>
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 14, color: 'var(--text-secondary)' }}>
          Hai già un account? <a href="/login" style={{ color: 'var(--brand-primary)', fontWeight: 600, textDecoration: 'none' }}>Accedi</a>
        </div>
        <p style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          Registrandoti accetti i Termini di Servizio e la Privacy Policy di BrainWare.
        </p>
      </div>
    </div>
  )
}

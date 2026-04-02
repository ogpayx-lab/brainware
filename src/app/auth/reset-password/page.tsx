'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Suspense } from 'react'

function ResetPasswordForm() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [ready, setReady] = useState(false)
  const [verifying, setVerifying] = useState(true)

  useEffect(() => {
    async function init() {
      // 0. Sessione già stabilita lato server dal callback route (PKCE cross-device)
      const sessionReady = searchParams.get('session_ready')
      if (sessionReady === '1') {
        // La sessione è già nei cookie — verifica che sia attiva
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          setReady(true)
          setVerifying(false)
          return
        }
        // Se la sessione non è nei cookie client (edge case), prova con getUser
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setReady(true)
          setVerifying(false)
          return
        }
      }

      // 1. Errori espliciti da Supabase nella URL
      const errorCode = searchParams.get('error_code')
      const errorParam = searchParams.get('error')
      if (errorParam || errorCode) {
        const desc = searchParams.get('error_description') ?? ''
        if (errorCode === 'otp_expired' || desc.includes('expired') || desc.includes('invalid')) {
          setError('Il link è scaduto o già utilizzato. Richiedine uno nuovo dalla pagina di login.')
        } else {
          setError('Errore: ' + (desc.replace(/\+/g, ' ') || errorParam || 'link non valido'))
        }
        setVerifying(false)
        return
      }

      // 2. PKCE flow con code param (?code=xxx)
      const code = searchParams.get('code')
      if (code) {
        const { error: err } = await supabase.auth.exchangeCodeForSession(code)
        if (err) {
          setError('Link non valido o scaduto. Richiedine uno nuovo.')
        } else {
          setReady(true)
        }
        setVerifying(false)
        return
      }

      // 3. token_hash nel query param (?token_hash=xxx&type=recovery)
      const tokenHash = searchParams.get('token_hash')
      const type = searchParams.get('type')
      if (tokenHash && (type === 'recovery' || type === 'invite')) {
        const { error: err } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as 'recovery' | 'invite' })
        if (err) {
          setError('Link non valido o scaduto. Richiedine uno nuovo.')
        } else {
          setReady(true)
        }
        setVerifying(false)
        return
      }

      // 4. Implicit flow: access_token nel hash URL (#access_token=xxx&type=recovery)
      const hash = typeof window !== 'undefined' ? window.location.hash : ''
      if (hash && hash.includes('access_token')) {
        const hashParams = new URLSearchParams(hash.slice(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const hashType = hashParams.get('type')
        if (accessToken && refreshToken && (hashType === 'recovery' || hashType === 'invite')) {
          const { error: err } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (err) {
            setError('Sessione non valida. Richiedine una nuova.')
          } else {
            setReady(true)
          }
          setVerifying(false)
          return
        }
      }

      // 5. Nessun parametro riconosciuto
      setVerifying(false)
    }

    init()
  }, [searchParams])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Le password non coincidono.'); return }
    if (password.length < 8) { setError('La password deve essere di almeno 8 caratteri.'); return }
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) {
      setError('Errore: ' + err.message)
      setLoading(false)
    } else {
      await supabase.auth.signOut()
      setSuccess(true)
      setTimeout(() => router.push('/login'), 3000)
    }
  }

  return (
    <div style={{minHeight:'100vh',background:'#F6F7F8',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
      <div style={{width:'100%',maxWidth:420,background:'white',borderRadius:16,padding:'40px 32px 32px',boxShadow:'0 4px 24px rgba(0,0,0,0.08)',border:'1px solid #F3F4F6'}}>
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{width:52,height:52,borderRadius:12,background:'#22C55E',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:26,color:'white',margin:'0 auto 12px'}}>B</div>
          <h2 style={{fontSize:24,fontWeight:700,margin:0}}>Imposta la tua Password</h2>
          <p style={{fontSize:13,color:'#6B7280',marginTop:4}}>BrainWare — Primo accesso</p>
        </div>

        {success ? (
          <div style={{textAlign:'center',padding:'20px 0'}}>
            <div style={{fontSize:40,marginBottom:12}}>✅</div>
            <h3 style={{fontWeight:700,marginBottom:8}}>Password aggiornata!</h3>
            <p style={{fontSize:14,color:'#6B7280'}}>Verrai reindirizzato al login tra pochi secondi...</p>
          </div>
        ) : verifying ? (
          <div style={{textAlign:'center',padding:'20px 0',color:'#6B7280',fontSize:14}}>
            <div style={{marginBottom:12,fontSize:28}}>⏳</div>
            Verifica del link in corso...
          </div>
        ) : error && !ready ? (
          <div style={{textAlign:'center',padding:'20px 0'}}>
            <div style={{fontSize:40,marginBottom:12}}>❌</div>
            <div style={{background:'#FEF2F2',border:'1px solid #EF4444',borderRadius:8,padding:'12px 16px',fontSize:14,color:'#EF4444',marginBottom:16}}>{error}</div>
            <a href="/login" style={{color:'#22C55E',fontWeight:600,textDecoration:'none',fontSize:14}}>← Torna al login</a>
          </div>
        ) : ready ? (
          <form onSubmit={handleReset} style={{display:'flex',flexDirection:'column',gap:14}}>
            <p style={{fontSize:14,color:'#6B7280',margin:0}}>Inserisci la tua nuova password. Deve essere di almeno 8 caratteri.</p>
            <div>
              <label style={{display:'block',fontSize:13,fontWeight:600,color:'#374151',marginBottom:6}}>Nuova password</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} placeholder="Minimo 8 caratteri" style={{width:'100%',padding:'11px 14px',border:'1px solid #E5E7EB',borderRadius:8,fontSize:14,outline:'none',boxSizing:'border-box'}}/>
            </div>
            <div>
              <label style={{display:'block',fontSize:13,fontWeight:600,color:'#374151',marginBottom:6}}>Conferma password</label>
              <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} required placeholder="Ripeti la password" style={{width:'100%',padding:'11px 14px',border:'1px solid #E5E7EB',borderRadius:8,fontSize:14,outline:'none',boxSizing:'border-box'}}/>
            </div>
            {error&&<div style={{background:'#FEF2F2',border:'1px solid #EF4444',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#EF4444'}}>{error}</div>}
            <button type="submit" disabled={loading} style={{background:'#22C55E',color:'white',border:'none',borderRadius:10,padding:'14px',fontSize:16,fontWeight:700,cursor:'pointer',opacity:loading?0.7:1}}>
              {loading ? 'Salvataggio...' : 'Salva nuova password'}
            </button>
          </form>
        ) : (
          <div style={{textAlign:'center',padding:'20px 0'}}>
            <div style={{fontSize:40,marginBottom:12}}>🔗</div>
            <p style={{fontSize:14,color:'#6B7280',marginBottom:16}}>Nessun link di reset rilevato.<br/>Assicurati di aver cliccato il link direttamente dall&apos;email.</p>
            <a href="/login" style={{color:'#22C55E',fontWeight:600,textDecoration:'none',fontSize:14}}>← Torna al login e richiedi un nuovo link</a>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div style={{minHeight:'100vh',background:'#F6F7F8',display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{color:'#6B7280'}}>Caricamento...</div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}

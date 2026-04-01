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
      const tokenHash = searchParams.get('token_hash')
      const type = searchParams.get('type')

      if (tokenHash && type === 'recovery') {
        // Scambia il token per una sessione recovery
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'recovery',
        })
        if (error) {
          setError('Link non valido o scaduto. Richiedine uno nuovo.')
          setVerifying(false)
          return
        }
        setReady(true)
        setVerifying(false)
        return
      }

      // Fallback: ascolta l'evento PASSWORD_RECOVERY (vecchi link)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setReady(true)
          setVerifying(false)
        }
      })

      // Check se c'è già una sessione recovery attiva
      await supabase.auth.getSession()
      setVerifying(false)

      return () => subscription.unsubscribe()
    }
    init()
  }, [searchParams])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Le password non coincidono.')
      return
    }
    if (password.length < 8) {
      setError('La password deve essere di almeno 8 caratteri.')
      return
    }
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
          <h2 style={{fontSize:24,fontWeight:700,margin:0}}>Nuova Password</h2>
          <p style={{fontSize:13,color:'#6B7280',marginTop:4}}>BrainWare</p>
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
            <p style={{fontSize:14,color:'#6B7280',marginBottom:16}}>Link non riconosciuto. Assicurati di aver cliccato il link direttamente dall&apos;email.</p>
            <a href="/login" style={{color:'#22C55E',fontWeight:600,textDecoration:'none',fontSize:14}}>← Torna al login</a>
          </div>
        )}

        {!success && !verifying && (
          <div style={{textAlign:'center',marginTop:16,fontSize:14}}>
            <a href="/login" style={{color:'#22C55E',fontWeight:600,textDecoration:'none'}}>← Torna al login</a>
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

'use client'
import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SALoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [tfa, setTfa] = useState('')
  const [error, setError] = useState<string|null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) { setError('Credenziali non valide.'); setLoading(false); return }
    const { data: user } = await supabase.from('users').select('role').eq('id', data.user.id).single()
    if (user?.role !== 'superadmin') { await supabase.auth.signOut(); setError('Accesso riservato al Super Admin.'); setLoading(false); return }
    router.push('/superadmin/dashboard')
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0F172A', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ width:'100%', maxWidth:880, display:'grid', gridTemplateColumns:'1fr 1fr', borderRadius:16, overflow:'hidden', boxShadow:'0 25px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ background:'linear-gradient(135deg,#1E293B 0%,#0F172A 100%)', padding:'48px 40px', display:'flex', flexDirection:'column', justifyContent:'space-between', borderRight:'1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:32 }}>
              <div style={{ width:44, height:44, borderRadius:10, background:'#22C55E', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:20, color:'white', fontFamily:'var(--font-heading)' }}>B</div>
              <span style={{ fontFamily:'var(--font-heading)', fontWeight:700, fontSize:20, color:'white' }}>BrainWare</span>
            </div>
            <div style={{ fontSize:11, fontWeight:700, color:'#22C55E', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:16 }}>Super Admin Console</div>
            <h2 style={{ color:'white', fontSize:26, fontFamily:'var(--font-heading)', fontWeight:700, lineHeight:1.3, marginBottom:12 }}>Gestione centralizzata di tutti gli owner, negozi e dati del sistema</h2>
            <p style={{ color:'rgba(255,255,255,0.5)', fontSize:14, lineHeight:1.6 }}>Accesso riservato agli amministratori della piattaforma BrainWare.</p>
          </div>
          <div style={{ fontSize:12, color:'rgba(255,255,255,0.3)' }}>/superadmin  Connessione protetta</div>
        </div>
        <div style={{ background:'#1E293B', padding:'48px 40px', display:'flex', flexDirection:'column', justifyContent:'center' }}>
          <h3 style={{ color:'white', fontFamily:'var(--font-heading)', fontSize:22, fontWeight:700, marginBottom:6 }}>Accesso Super Admin</h3>
          <p style={{ color:'rgba(255,255,255,0.4)', fontSize:14, marginBottom:28 }}>Inserisci le credenziali di accesso amministratore</p>
          <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {[{label:'Email',key:'email',type:'email',ph:'admin@brainware.io',val:email,set:setEmail},{label:'Password',key:'pw',type:'password',ph:'',val:password,set:setPassword}].map(f => (
              <div key={f.key} style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <label style={{ fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{f.label}</label>
                <input type={f.type} placeholder={f.ph} value={f.val} onChange={e => f.set(e.target.value)} required style={{ background:'#0F172A', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'12px 14px', fontSize:14, color:'white', outline:'none' }} />
              </div>
            ))}
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={{ fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Codice 2FA</label>
              <input type="text" placeholder="000 000" value={tfa} onChange={e => setTfa(e.target.value)} maxLength={7} style={{ background:'#0F172A', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'12px 14px', fontSize:14, color:'white', outline:'none', letterSpacing:'0.3em', textAlign:'center' }} />
              <span style={{ fontSize:11, color:'rgba(255,255,255,0.3)' }}>Il codice 2FA e opzionale in questa fase</span>
            </div>
            {error && <div style={{ background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.4)', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#FCA5A5' }}>{error}</div>}
            <button type="submit" disabled={loading} style={{ background:'#22C55E', color:'white', border:'none', borderRadius:8, padding:'14px', fontSize:15, fontWeight:700, cursor:'pointer', opacity:loading?0.7:1, fontFamily:'var(--font-body)' }}>{loading?'Accesso...':'Accedi al Pannello'}</button>
          </form>
          <p style={{ textAlign:'center', marginTop:20, fontSize:12, color:'rgba(255,255,255,0.2)' }}>Connessione protetta  Accesso riservato</p>
        </div>
      </div>
    </div>
  )
}

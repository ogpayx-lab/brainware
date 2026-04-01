'use client'
import { useState } from 'react'
import { loginAction } from './actions'

export default function LoginPage() {
  const [role, setRole] = useState('owner')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await loginAction(email, password)

    if (result?.error) {
      if (result.error.includes('Invalid login credentials') || result.error.includes('invalid_credentials')) {
        setError('Email o password non corretti. Controlla i dati inseriti.')
      } else if (result.error.includes('Email not confirmed')) {
        setError('Devi confermare la tua email prima di accedere. Controlla la casella di posta (anche Spam).')
      } else {
        setError('Errore di accesso: ' + result.error)
      }
      setLoading(false)
      return
    }

    if (result?.redirectTo) {
      // Hard redirect: ricarica completa la pagina così il middleware legge la sessione dai cookie
      window.location.href = result.redirectTo
    }
  }



  return (
    <div style={{minHeight:'100vh',background:'#F6F7F8',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
      <div style={{width:'100%',maxWidth:420,background:'white',borderRadius:16,padding:'40px 32px 32px',boxShadow:'0 4px 24px rgba(0,0,0,0.08)',border:'1px solid #F3F4F6'}}>
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{width:52,height:52,borderRadius:12,background:'#22C55E',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:26,color:'white',margin:'0 auto 12px'}}>B</div>
          <h2 style={{fontSize:24,fontWeight:700,margin:0}}>BrainWare</h2>
          <p style={{fontSize:13,color:'#6B7280',marginTop:4}}>Company Intelligence System</p>
        </div>
        <div style={{marginBottom:20}}>
          <div style={{fontSize:11,fontWeight:700,color:'#6B7280',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>ACCEDI COME</div>
          <div style={{display:'flex',background:'#F6F7F8',borderRadius:10,padding:3,gap:3}}>
            <button type="button" onClick={()=>setRole('employee')} style={{flex:1,padding:'8px',borderRadius:8,border:'none',background:role==='employee'?'white':'transparent',fontWeight:role==='employee'?600:400,color:role==='employee'?'#111827':'#6B7280',cursor:'pointer',fontSize:14}}>Dipendente</button>
            <button type="button" onClick={()=>setRole('owner')} style={{flex:1,padding:'8px',borderRadius:8,border:'none',background:role==='owner'?'#22C55E':'transparent',fontWeight:role==='owner'?600:400,color:role==='owner'?'white':'#6B7280',cursor:'pointer',fontSize:14}}>Proprietario</button>
          </div>
          <p style={{fontSize:12,color:'#9CA3AF',marginTop:6}}>{role==='owner'?'Proprietario: dashboard, report e gestione completa.':'Dipendente: funzioni operative del negozio.'}</p>
        </div>
        <form onSubmit={login} style={{display:'flex',flexDirection:'column',gap:14}}>
          <div>
            <label style={{display:'block',fontSize:13,fontWeight:600,color:'#374151',marginBottom:6}}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="nome@esempio.com" style={{width:'100%',padding:'11px 14px',border:'1px solid #E5E7EB',borderRadius:8,fontSize:14,outline:'none',boxSizing:'border-box'}}/>
          </div>
          <div>
            <label style={{display:'block',fontSize:13,fontWeight:600,color:'#374151',marginBottom:6}}>Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="" style={{width:'100%',padding:'11px 14px',border:'1px solid #E5E7EB',borderRadius:8,fontSize:14,outline:'none',boxSizing:'border-box'}}/>
          </div>
          <p style={{fontSize:12,color:'#9CA3AF',margin:0}}>I dipendenti devono essere abilitati dal proprietario per poter accedere.</p>
          {error&&<div style={{background:'#FEF2F2',border:'1px solid #EF4444',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#EF4444'}}>{error}</div>}
          <button type="submit" disabled={loading} style={{background:'#22C55E',color:'white',border:'none',borderRadius:10,padding:'14px',fontSize:16,fontWeight:700,cursor:'pointer',opacity:loading?0.7:1}}>
            {loading?'Accesso...':'Accedi'}
          </button>
        </form>
        <div style={{textAlign:'center',marginTop:16,fontSize:14,color:'#6B7280'}}>
          Non hai un account? <a href="/signup" style={{color:'#22C55E',fontWeight:600,textDecoration:'none'}}>Registrati gratis</a>
        </div>
        <div style={{textAlign:'center',marginTop:10,fontSize:12,color:'#9CA3AF'}}>2024 BrainWare</div>
      </div>
    </div>
  )
}

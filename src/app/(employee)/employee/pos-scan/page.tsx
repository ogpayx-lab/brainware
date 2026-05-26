'use client'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n'
export default function POSScanPage() {
  const router = useRouter()
  const t = useT()
  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-surface)', display:'flex', flexDirection:'column' }}>
      <div style={{ background:'var(--bg-primary)', borderBottom:'1px solid var(--border-subtle)', padding:'var(--space-md) var(--space-lg)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'0.05em' }}>MODALIT DIPENDENTE</div>
          <div style={{ display:'flex', gap:16, marginTop:6 }}>
            <button onClick={() => router.push('/employee/pos')} className="btn btn-ghost" style={{ fontSize:13 }}>Ricerca Prodotto</button>
            <button className="btn btn-primary" style={{ fontSize:13 }}> Scan QR Code</button>
          </div>
        </div>
        <button onClick={() => router.push('/employee/dashboard')} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer' }}></button>
      </div>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'var(--space-xl)', gap:'var(--space-lg)' }}>
        <div style={{ width:280, height:280, border:'3px solid var(--brand-primary)', borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(34,197,94,0.05)', position:'relative' }}>
          <div style={{ fontSize:64, opacity:0.3 }}></div>
          <div style={{ position:'absolute', bottom:16, fontSize:13, color:'var(--brand-primary)', fontWeight:600 }}>Fotocamera attiva  Scansione automatica</div>
        </div>
        <div style={{ textAlign:'center' }}>
          <h3 style={{ marginBottom:8 }}>Inquadra il QR Code del prodotto</h3>
          <p style={{ color:'var(--text-secondary)', fontSize:14 }}>Posiziona il codice QR o barcode dell'etichetta nel riquadro</p>
        </div>
        <div style={{ width:'100%', maxWidth:320 }}>
          <div style={{ fontSize:12, fontWeight:600, marginBottom:8 }}>Inserisci codice barcode manualmente...</div>
          <div style={{ display:'flex', gap:8 }}>
            <input className="input" placeholder="8901234567890" style={{ flex:1 }} />
            <button className="btn btn-primary">Aggiungi</button>
          </div>
        </div>
        <div style={{ display:'flex', gap:16, fontSize:13, color:'var(--text-secondary)' }}>
          <span> Fotocamera attiva</span>
          <span> Scansione automatica</span>
          <span> Flash disponibile</span>
        </div>
      </div>
    </div>
  )
}

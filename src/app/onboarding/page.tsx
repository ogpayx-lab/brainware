'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { setupOrganizationAndStore, updateStoreAndBrand } from './actions'

const PLANS = [
  { key: 'trial', label: 'Trial', desc: 'Gratuito per 14 giorni', price: '0' },
  { key: 'pro', label: 'Pro', desc: 'Fino a 3 negozi', price: '49/mese' },
  { key: 'enterprise', label: 'Enterprise', desc: 'Negozi illimitati', price: '149/mese' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [company, setCompany] = useState({ ragione_sociale: '', piva: '', indirizzo: '', telefono: '', plan: 'trial' })
  const [store, setStore] = useState({ name: '', city: '', address: '' })
  const [brand, setBrand] = useState({ brand_name: 'BrainWare', logo_letter: 'B', primary_color: '#22C55E' })

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/login')
      else setUserId(user.id)
    })
  }, [])


  async function saveStep1() {
    if (!company.ragione_sociale || !company.piva || !userId) return
    setSaving(true)
    setSaveError(null)

    const result = await setupOrganizationAndStore({
      ragione_sociale: company.ragione_sociale,
      piva: company.piva,
      indirizzo: company.indirizzo,
      telefono: company.telefono,
      plan: company.plan,
      userId,
    })

    if (result.error) {
      setSaveError(result.error)
      setSaving(false)
      return
    }

    setStoreId(result.storeId!)
    setBrand(b => ({ ...b, brand_name: company.ragione_sociale, logo_letter: company.ragione_sociale[0]?.toUpperCase() || 'B' }))
    setStore(s => ({ ...s, name: company.ragione_sociale }))
    setSaving(false)
    setStep(1)
  }

  async function saveStep2() {
    if (!store.name || !brand.brand_name || !userId || !storeId) return
    setSaving(true)
    setSaveError(null)

    const result = await updateStoreAndBrand({
      storeId,
      userId,
      storeName: store.name,
      storeCity: store.city,
      storeAddress: store.address,
      brandName: brand.brand_name,
      logoLetter: brand.logo_letter,
      primaryColor: brand.primary_color,
      piva: company.piva,
    })

    if (result.error) {
      setSaveError(result.error)
      setSaving(false)
      return
    }

    setSaving(false)
    router.push('/owner/dashboard')

  }

  const COLORS = ['#22C55E','#3B82F6','#8B5CF6','#F59E0B','#EF4444','#0F172A']
  const progress = step / 2 * 100

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-surface)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ width:'100%', maxWidth:540 }}>
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ width:46, height:46, borderRadius:10, background:brand.primary_color, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-heading)', fontWeight:700, fontSize:22, color:'white', margin:'0 auto 10px' }}>{brand.logo_letter}</div>
          <h2 style={{ fontFamily:'var(--font-heading)', fontWeight:700, fontSize:22, marginBottom:4 }}>Benvenuto in BrainWare!</h2>
          <p style={{ color:'var(--text-secondary)', fontSize:14 }}>Configuriamo il tuo account in 2 minuti</p>
        </div>

        <div style={{ marginBottom:24 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
            {['Dati Aziendali','Negozio & Brand'].map((s,i) => (
              <div key={s} style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:26, height:26, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, background:i<=step?'var(--brand-primary)':'var(--border-default)', color:i<=step?'white':'var(--text-tertiary)' }}>{i<step?'':i+1}</div>
                <span style={{ fontSize:13, fontWeight:i===step?600:400, color:i===step?'var(--text-primary)':'var(--text-tertiary)' }}>{s}</span>
              </div>
            ))}
          </div>
          <div style={{ height:4, background:'var(--border-subtle)', borderRadius:2 }}><div style={{ height:'100%', width:`${progress}%`, background:'var(--brand-primary)', borderRadius:2, transition:'width 0.4s' }} /></div>
        </div>

        <div style={{ background:'var(--bg-primary)', borderRadius:16, padding:32, boxShadow:'var(--shadow-md)', border:'1px solid var(--border-subtle)' }}>
          {step === 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div><h3 style={{ marginBottom:4 }}>Dati Aziendali</h3><p style={{ color:'var(--text-secondary)', fontSize:14 }}>Inserisci i dati della tua azienda per la fatturazione</p></div>
              <div className="input-group"><label className="input-label">Ragione Sociale *</label><input className="input" placeholder="Es. Rossi Retail S.r.l." value={company.ragione_sociale} onChange={e => setCompany(c=>({...c,ragione_sociale:e.target.value}))} /></div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <div className="input-group"><label className="input-label">P.IVA *</label><input className="input" placeholder="IT12345678901" value={company.piva} onChange={e => setCompany(c=>({...c,piva:e.target.value}))} /></div>
                <div className="input-group"><label className="input-label">Telefono</label><input className="input" type="tel" placeholder="+39 02 1234567" value={company.telefono} onChange={e => setCompany(c=>({...c,telefono:e.target.value}))} /></div>
              </div>
              <div className="input-group"><label className="input-label">Indirizzo Sede Legale</label><input className="input" placeholder="Via Roma 42, 20100 Milano MI" value={company.indirizzo} onChange={e => setCompany(c=>({...c,indirizzo:e.target.value}))} /></div>
              <div>
                <label className="input-label" style={{ display:'block', marginBottom:10 }}>Piano / Abbonamento</label>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {PLANS.map(plan => (
                    <div key={plan.key} onClick={() => setCompany(c=>({...c,plan:plan.key}))} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', borderRadius:10, cursor:'pointer', border:`2px solid ${company.plan===plan.key?'var(--brand-primary)':'var(--border-default)'}`, background:company.plan===plan.key?'var(--brand-primary-light)':'var(--bg-primary)' }}>
                      <div><div style={{ fontWeight:700, fontSize:14, color:company.plan===plan.key?'var(--brand-primary-dark)':'var(--text-primary)' }}>{plan.label}</div><div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:2 }}>{plan.desc}</div></div>
                      <div style={{ fontWeight:700, fontSize:14, color:company.plan===plan.key?'var(--brand-primary)':'var(--text-secondary)' }}>{plan.price}</div>
                    </div>
                  ))}
                </div>
              </div>
              {saveError && <div style={{ background:'#FEF2F2', border:'1px solid #EF4444', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#EF4444' }}>{saveError}</div>}
              <button onClick={saveStep1} disabled={saving||!company.ragione_sociale||!company.piva} className="btn btn-primary btn-full btn-lg">{saving?'Salvataggio...':'Continua →'}</button>
            </div>
          )}
          {step === 1 && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div><h3 style={{ marginBottom:4 }}>Negozio & Brand</h3><p style={{ color:'var(--text-secondary)', fontSize:14 }}>Come si chiama il tuo negozio e come vuoi che appaia ai dipendenti</p></div>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'0.06em' }}>NEGOZIO</div>
              <div className="input-group"><label className="input-label">Nome negozio *</label><input className="input" placeholder="Es. BrainWare Milano Centro" value={store.name} onChange={e => setStore(s=>({...s,name:e.target.value}))} /></div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <div className="input-group"><label className="input-label">Citta</label><input className="input" placeholder="Milano" value={store.city} onChange={e => setStore(s=>({...s,city:e.target.value}))} /></div>
                <div className="input-group"><label className="input-label">Indirizzo</label><input className="input" placeholder="Via Roma 42" value={store.address} onChange={e => setStore(s=>({...s,address:e.target.value}))} /></div>
              </div>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'0.06em', marginTop:4 }}>BRAND & STILE</div>
              <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:14 }}>
                <div className="input-group"><label className="input-label">Nome brand *</label><input className="input" placeholder="BrainWare" value={brand.brand_name} onChange={e => setBrand(b=>({...b,brand_name:e.target.value,logo_letter:b.logo_letter||e.target.value[0]?.toUpperCase()||'B'}))} /></div>
                <div className="input-group"><label className="input-label">Lettera logo</label><input className="input" maxLength={1} value={brand.logo_letter} onChange={e => setBrand(b=>({...b,logo_letter:e.target.value.toUpperCase()}))} style={{ fontSize:22, fontWeight:700, textAlign:'center' }} /></div>
              </div>
              <div className="input-group">
                <label className="input-label">Colore principale</label>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <input type="color" value={brand.primary_color} onChange={e => setBrand(b=>({...b,primary_color:e.target.value}))} style={{ width:44, height:44, border:'none', borderRadius:8, cursor:'pointer', padding:2 }} />
                  <input className="input" value={brand.primary_color} onChange={e => setBrand(b=>({...b,primary_color:e.target.value}))} style={{ flex:1 }} />
                  {COLORS.map(c => <div key={c} onClick={() => setBrand(b=>({...b,primary_color:c}))} style={{ width:28, height:28, borderRadius:'50%', background:c, cursor:'pointer', border:brand.primary_color===c?'2.5px solid var(--text-primary)':'2px solid transparent', flexShrink:0 }} />)}
                </div>
              </div>
              <div style={{ background:'var(--bg-surface)', borderRadius:10, padding:14, display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:40, height:40, borderRadius:8, background:brand.primary_color, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-heading)', fontWeight:700, fontSize:20, color:'white', flexShrink:0 }}>{brand.logo_letter||'B'}</div>
                <div><div style={{ fontFamily:'var(--font-heading)', fontWeight:700, fontSize:16, color:brand.primary_color }}>{brand.brand_name||'BrainWare'}</div><div style={{ fontSize:12, color:'var(--text-tertiary)' }}>{store.name||'Nome negozio'}{store.city?`  ${store.city}`:''}</div></div>
              </div>
              {saveError && <div style={{ background:'#FEF2F2', border:'1px solid #EF4444', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#EF4444' }}>{saveError}</div>}
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={() => setStep(0)} className="btn btn-secondary" style={{ flex:1 }}>← Indietro</button>
                <button onClick={saveStep2} disabled={saving||!store.name||!brand.brand_name} className="btn btn-primary" style={{ flex:2 }}>{saving?'Salvataggio...':'Entra nella Dashboard →'}</button>
              </div>
            </div>
          )}
        </div>
        <p style={{ textAlign:'center', marginTop:12, fontSize:12, color:'var(--text-tertiary)' }}>Puoi modificare tutto questo nelle Impostazioni del tuo account</p>
      </div>
    </div>
  )
}

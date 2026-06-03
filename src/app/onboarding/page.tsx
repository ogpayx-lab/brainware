'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { setupOrganizationAndStore, updateStoreAndBrand } from './actions'

const STORE_OPTIONS = [
  { stores: 1, plan: 'starter', label: '1 negozio', price: 49, desc: 'Perfetto per iniziare' },
  { stores: 3, plan: 'growth', label: '2-3 negozi', price: 99, desc: 'Per chi sta crescendo', popular: true },
  { stores: 5, plan: 'business', label: '4-5 negozi', price: 149, desc: 'Per catene in espansione' },
  { stores: 99, plan: 'enterprise', label: '6+ negozi', price: 0, desc: 'Su misura per te' },
]

const STEPS = ['Dati Aziendali', 'Numero Negozi', 'Pagamento', 'Negozio & Brand']

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [company, setCompany] = useState({ ragione_sociale: '', piva: '', indirizzo: '', telefono: '', plan: 'starter' })
  const [selectedStores, setSelectedStores] = useState(0) // index
  const [store, setStore] = useState({ name: '', city: '', address: '' })
  const [brand, setBrand] = useState({ brand_name: 'BrainWare', logo_letter: 'B', primary_color: '#22C55E' })
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [enterpriseEmail, setEnterpriseEmail] = useState('')
  const [enterpriseSent, setEnterpriseSent] = useState(false)
  const [enterpriseMsg, setEnterpriseMsg] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      // Check if returning from Stripe checkout
      const params = new URLSearchParams(window.location.search)
      if (params.get('step') === 'store') {
        // Load existing store data
        const { data: profile } = await supabase.from('users').select('store_id, full_name').eq('id', user.id).single()
        if (profile?.store_id) {
          setStoreId(profile.store_id)
          setStore(s => ({ ...s, name: profile.full_name || '' }))
          setBrand(b => ({ ...b, brand_name: profile.full_name || '', logo_letter: (profile.full_name || 'B')[0].toUpperCase() }))
          setStep(3) // Jump to store setup
        }
      }
    })
  }, [])

  async function saveStep1() {
    if (!company.ragione_sociale || !company.piva || !userId) return
    setSaving(true); setSaveError(null)
    // Just validate and move to step 2 — don't create org yet
    setSaving(false)
    setStep(1)
  }

  async function saveStep2() {
    const opt = STORE_OPTIONS[selectedStores]
    if (opt.plan === 'enterprise') return // handled separately
    setCompany(c => ({ ...c, plan: opt.plan }))
    setStep(2)
  }

  async function handlePayment() {
    if (!userId) return
    setCheckoutLoading(true); setSaveError(null)

    // First create the org + store in DB
    const opt = STORE_OPTIONS[selectedStores]
    const result = await setupOrganizationAndStore({
      ragione_sociale: company.ragione_sociale,
      piva: company.piva,
      indirizzo: company.indirizzo,
      telefono: company.telefono,
      plan: opt.plan,
      userId,
    })

    if (result.error) {
      setSaveError(result.error)
      setCheckoutLoading(false)
      return
    }

    setStoreId(result.storeId!)

    // Create Stripe checkout session
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: opt.plan, userId }),
      })
      const data = await res.json()

      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url
      } else {
        setSaveError(data.error || 'Errore nel creare la sessione di pagamento')
        setCheckoutLoading(false)
      }
    } catch (err: any) {
      setSaveError('Errore di connessione: ' + err.message)
      setCheckoutLoading(false)
    }
  }

  // Skip payment for now: go to step 4 (store setup) — fallback if Stripe not configured
  async function skipToStoreSetup() {
    if (!userId) return
    setSaving(true); setSaveError(null)
    const opt = STORE_OPTIONS[selectedStores]

    const result = await setupOrganizationAndStore({
      ragione_sociale: company.ragione_sociale,
      piva: company.piva,
      indirizzo: company.indirizzo,
      telefono: company.telefono,
      plan: opt.plan,
      userId,
    })

    if (result.error) { setSaveError(result.error); setSaving(false); return }
    setStoreId(result.storeId!)
    setBrand(b => ({ ...b, brand_name: company.ragione_sociale, logo_letter: company.ragione_sociale[0]?.toUpperCase() || 'B' }))
    setStore(s => ({ ...s, name: company.ragione_sociale }))
    setSaving(false)
    setStep(3)
  }

  async function saveStep4() {
    if (!store.name || !brand.brand_name || !userId || !storeId) return
    setSaving(true); setSaveError(null)
    const result = await updateStoreAndBrand({
      storeId, userId,
      storeName: store.name, storeCity: store.city, storeAddress: store.address,
      brandName: brand.brand_name, logoLetter: brand.logo_letter, primaryColor: brand.primary_color,
      piva: company.piva,
    })
    if (result.error) { setSaveError(result.error); setSaving(false); return }
    setSaving(false)
    window.location.href = '/owner/dashboard'
  }

  async function sendEnterprise() {
    if (!enterpriseEmail && !company.ragione_sociale) return
    setEnterpriseSent(true)
    // In production, send email via API
    try {
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'enterprise',
          company: company.ragione_sociale,
          email: enterpriseEmail,
          message: enterpriseMsg,
          piva: company.piva,
        }),
      }).catch(() => {}) // silent fail for now
    } catch {}
  }

  const COLORS = ['#22C55E','#3B82F6','#8B5CF6','#F59E0B','#EF4444','#0F172A']
  const progress = ((step + 1) / STEPS.length) * 100
  const selectedPlan = STORE_OPTIONS[selectedStores]

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-surface)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ width:'100%', maxWidth:540 }}>
        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ width:46, height:46, borderRadius:10, background:brand.primary_color, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-heading)', fontWeight:700, fontSize:22, color:'white', margin:'0 auto 10px' }}>{brand.logo_letter}</div>
          <h2 style={{ fontFamily:'var(--font-heading)', fontWeight:700, fontSize:22, marginBottom:4 }}>Benvenuto in BrainWare!</h2>
          <p style={{ color:'var(--text-secondary)', fontSize:14 }}>Configuriamo il tuo account in 2 minuti</p>
        </div>

        {/* Progress */}
        <div style={{ marginBottom:24 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
            {STEPS.map((s,i) => (
              <div key={s} style={{ display:'flex', alignItems:'center', gap:4 }}>
                <div style={{ width:22, height:22, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, background:i<=step?'var(--brand-primary)':'var(--border-default)', color:i<=step?'white':'var(--text-tertiary)', transition:'all 0.3s' }}>{i<step?'✓':i+1}</div>
                <span style={{ fontSize:11, fontWeight:i===step?600:400, color:i===step?'var(--text-primary)':'var(--text-tertiary)', display: i === 2 && step < 2 ? 'none' : undefined }}>{s}</span>
              </div>
            ))}
          </div>
          <div style={{ height:4, background:'var(--border-subtle)', borderRadius:2 }}><div style={{ height:'100%', width:`${progress}%`, background:'var(--brand-primary)', borderRadius:2, transition:'width 0.4s' }} /></div>
        </div>

        {/* Card */}
        <div style={{ background:'var(--bg-primary)', borderRadius:16, padding:32, boxShadow:'var(--shadow-md)', border:'1px solid var(--border-subtle)' }}>

          {/* ══════ STEP 1: DATI AZIENDALI ══════ */}
          {step === 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div><h3 style={{ marginBottom:4 }}>Dati Aziendali</h3><p style={{ color:'var(--text-secondary)', fontSize:14 }}>Inserisci i dati della tua azienda per la fatturazione</p></div>
              <div className="input-group"><label className="input-label">Ragione Sociale *</label><input className="input" placeholder="Es. Rossi Retail S.r.l." value={company.ragione_sociale} onChange={e => setCompany(c=>({...c,ragione_sociale:e.target.value}))} /></div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <div className="input-group"><label className="input-label">P.IVA *</label><input className="input" placeholder="IT12345678901" value={company.piva} onChange={e => setCompany(c=>({...c,piva:e.target.value}))} /></div>
                <div className="input-group"><label className="input-label">Telefono</label><input className="input" type="tel" placeholder="+39 02 1234567" value={company.telefono} onChange={e => setCompany(c=>({...c,telefono:e.target.value}))} /></div>
              </div>
              <div className="input-group"><label className="input-label">Indirizzo Sede Legale</label><input className="input" placeholder="Via Roma 42, 20100 Milano MI" value={company.indirizzo} onChange={e => setCompany(c=>({...c,indirizzo:e.target.value}))} /></div>
              {saveError && <div style={{ background:'#FEF2F2', border:'1px solid #EF4444', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#EF4444' }}>{saveError}</div>}
              <button onClick={saveStep1} disabled={saving||!company.ragione_sociale||!company.piva} className="btn btn-primary btn-full btn-lg">{saving?'Salvataggio...':'Continua →'}</button>
            </div>
          )}

          {/* ══════ STEP 2: QUANTI NEGOZI ══════ */}
          {step === 1 && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div><h3 style={{ marginBottom:4 }}>Quanti negozi gestisci?</h3><p style={{ color:'var(--text-secondary)', fontSize:14 }}>Seleziona in base alle tue esigenze. Potrai sempre cambiare piano.</p></div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {STORE_OPTIONS.map((opt, i) => (
                  <div key={opt.plan} onClick={() => setSelectedStores(i)} style={{
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                    padding:'14px 18px', borderRadius:12, cursor:'pointer', position:'relative',
                    border:`2px solid ${selectedStores===i?'var(--brand-primary)':'var(--border-default)'}`,
                    background:selectedStores===i?'var(--brand-primary-light)':'var(--bg-primary)',
                    transition:'all 0.2s',
                  }}>
                    {opt.popular && <span style={{ position:'absolute', top:-10, right:16, background:'var(--brand-primary)', color:'white', fontSize:10, fontWeight:700, padding:'2px 10px', borderRadius:10 }}>⭐ Consigliato</span>}
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ fontSize:24 }}>{opt.stores === 1 ? '🏪' : opt.stores === 3 ? '🏬' : opt.stores === 5 ? '🏢' : '🌐'}</div>
                      <div>
                        <div style={{ fontWeight:700, fontSize:15, color:selectedStores===i?'var(--brand-primary-dark)':'var(--text-primary)' }}>{opt.label}</div>
                        <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:1 }}>{opt.desc}</div>
                      </div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      {opt.price > 0 ? (
                        <>
                          <div style={{ fontWeight:800, fontSize:20, color:selectedStores===i?'var(--brand-primary)':'var(--text-primary)' }}>€{opt.price}</div>
                          <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>/mese</div>
                        </>
                      ) : (
                        <div style={{ fontWeight:700, fontSize:14, color:'var(--text-secondary)' }}>Su misura</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Dynamic plan summary */}
              {selectedPlan.price > 0 && (
                <div style={{ background:'#F0FDF4', border:'1px solid #86EFAC', borderRadius:10, padding:'14px 18px' }}>
                  <div style={{ fontWeight:700, fontSize:14, color:'#166534', marginBottom:6 }}>📋 Il tuo piano: {selectedPlan.plan.charAt(0).toUpperCase() + selectedPlan.plan.slice(1)} — €{selectedPlan.price}/mese</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {['✅ 30 giorni completamente gratis', '✅ Tutte le funzionalità incluse', '✅ Cancella quando vuoi', '✅ Supporto dedicato'].map(f => (
                      <div key={f} style={{ fontSize:12, color:'#15803D' }}>{f}</div>
                    ))}
                  </div>
                </div>
              )}

              {saveError && <div style={{ background:'#FEF2F2', border:'1px solid #EF4444', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#EF4444' }}>{saveError}</div>}

              <div style={{ display:'flex', gap:10 }}>
                <button onClick={() => setStep(0)} className="btn btn-secondary" style={{ flex:1 }}>← Indietro</button>
                {selectedPlan.plan === 'enterprise' ? (
                  <button onClick={() => setStep(2)} className="btn btn-primary" style={{ flex:2 }}>Contattaci →</button>
                ) : (
                  <button onClick={saveStep2} className="btn btn-primary" style={{ flex:2 }}>Continua al pagamento →</button>
                )}
              </div>
            </div>
          )}

          {/* ══════ STEP 3: PAGAMENTO / ENTERPRISE CONTACT ══════ */}
          {step === 2 && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {selectedPlan.plan === 'enterprise' ? (
                // Enterprise contact form
                <>
                  <div><h3 style={{ marginBottom:4 }}>🌐 Contattaci per Enterprise</h3><p style={{ color:'var(--text-secondary)', fontSize:14 }}>Con 6+ negozi creiamo un piano personalizzato per te</p></div>
                  {enterpriseSent ? (
                    <div style={{ textAlign:'center', padding:'30px 0' }}>
                      <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
                      <h3 style={{ marginBottom:8 }}>Richiesta inviata!</h3>
                      <p style={{ color:'var(--text-secondary)', fontSize:14 }}>Ti contatteremo entro 24 ore per configurare il tuo piano Enterprise.</p>
                    </div>
                  ) : (
                    <>
                      <div className="input-group"><label className="input-label">Email di contatto *</label><input className="input" type="email" placeholder="mario@azienda.it" value={enterpriseEmail} onChange={e => setEnterpriseEmail(e.target.value)} /></div>
                      <div className="input-group"><label className="input-label">Messaggio (opzionale)</label><textarea className="input" placeholder="Raccontaci delle tue esigenze..." rows={3} value={enterpriseMsg} onChange={e => setEnterpriseMsg(e.target.value)} style={{ resize:'none' }} /></div>
                      <div style={{ background:'var(--bg-surface)', borderRadius:8, padding:'12px 16px', fontSize:13, color:'var(--text-secondary)' }}>
                        <strong>Azienda:</strong> {company.ragione_sociale}<br/>
                        <strong>P.IVA:</strong> {company.piva}
                      </div>
                    </>
                  )}
                  <div style={{ display:'flex', gap:10 }}>
                    <button onClick={() => setStep(1)} className="btn btn-secondary" style={{ flex:1 }}>← Indietro</button>
                    {!enterpriseSent && <button onClick={sendEnterprise} disabled={!enterpriseEmail} className="btn btn-primary" style={{ flex:2 }}>📧 Invia Richiesta</button>}
                  </div>
                </>
              ) : (
                // Payment step
                <>
                  <div><h3 style={{ marginBottom:4 }}>💳 Pagamento sicuro</h3><p style={{ color:'var(--text-secondary)', fontSize:14 }}>Verrai reindirizzato a Stripe per inserire i dati di pagamento</p></div>

                  {/* Plan recap */}
                  <div style={{ background:'var(--bg-surface)', borderRadius:10, padding:'16px 20px', border:'1px solid var(--border-subtle)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                      <span style={{ fontWeight:700, fontSize:15 }}>Piano {selectedPlan.plan.charAt(0).toUpperCase() + selectedPlan.plan.slice(1)}</span>
                      <span style={{ fontWeight:800, fontSize:20, color:'var(--brand-primary)' }}>€{selectedPlan.price}/mese</span>
                    </div>
                    <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.6 }}>
                      Fino a {selectedPlan.stores} {selectedPlan.stores === 1 ? 'negozio' : 'negozi'} · Tutte le funzionalità incluse
                    </div>
                  </div>

                  {/* Trust signals */}
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {[
                      { icon: '🎁', text: 'I primi 30 giorni sono completamente GRATIS' },
                      { icon: '🔒', text: 'Pagamento sicuro gestito da Stripe' },
                      { icon: '❌', text: 'Cancella in qualsiasi momento, senza penali' },
                      { icon: '💳', text: 'Non ti verrà addebitato nulla oggi' },
                    ].map(item => (
                      <div key={item.text} style={{ display:'flex', alignItems:'center', gap:10, fontSize:13, color:'var(--text-secondary)' }}>
                        <span style={{ fontSize:16 }}>{item.icon}</span>
                        <span>{item.text}</span>
                      </div>
                    ))}
                  </div>

                  {saveError && <div style={{ background:'#FEF2F2', border:'1px solid #EF4444', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#EF4444' }}>{saveError}</div>}

                  <div style={{ display:'flex', gap:10 }}>
                    <button onClick={() => setStep(1)} className="btn btn-secondary" style={{ flex:1 }}>← Indietro</button>
                    <button onClick={handlePayment} disabled={checkoutLoading} className="btn btn-primary" style={{ flex:2, background: checkoutLoading ? undefined : '#635BFF' }}>
                      {checkoutLoading ? 'Reindirizzamento a Stripe...' : '🔒 Procedi con Stripe →'}
                    </button>
                  </div>

                  <p style={{ textAlign:'center', fontSize:11, color:'var(--text-tertiary)', marginTop:4 }}>
                    Powered by <strong>Stripe</strong> · PCI DSS Level 1 Certified
                  </p>
                </>
              )}
            </div>
          )}

          {/* ══════ STEP 4: NEGOZIO & BRAND ══════ */}
          {step === 3 && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div><h3 style={{ marginBottom:4 }}>Negozio & Brand</h3><p style={{ color:'var(--text-secondary)', fontSize:14 }}>Come si chiama il tuo negozio e come vuoi che appaia ai dipendenti</p></div>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'0.06em' }}>NEGOZIO</div>
              <div className="input-group"><label className="input-label">Nome negozio *</label><input className="input" placeholder="Es. BrainWare Milano Centro" value={store.name} onChange={e => setStore(s=>({...s,name:e.target.value}))} /></div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <div className="input-group"><label className="input-label">Città</label><input className="input" placeholder="Milano" value={store.city} onChange={e => setStore(s=>({...s,city:e.target.value}))} /></div>
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
                <div><div style={{ fontFamily:'var(--font-heading)', fontWeight:700, fontSize:16, color:brand.primary_color }}>{brand.brand_name||'BrainWare'}</div><div style={{ fontSize:12, color:'var(--text-tertiary)' }}>{store.name||'Nome negozio'}{store.city?` · ${store.city}`:''}</div></div>
              </div>
              {saveError && <div style={{ background:'#FEF2F2', border:'1px solid #EF4444', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#EF4444' }}>{saveError}</div>}
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={() => setStep(2)} className="btn btn-secondary" style={{ flex:1 }}>← Indietro</button>
                <button onClick={saveStep4} disabled={saving||!store.name||!brand.brand_name} className="btn btn-primary" style={{ flex:2 }}>{saving?'Salvataggio...':'🚀 Entra nella Dashboard'}</button>
              </div>
            </div>
          )}
        </div>
        <p style={{ textAlign:'center', marginTop:12, fontSize:12, color:'var(--text-tertiary)' }}>Puoi modificare tutto questo nelle Impostazioni del tuo account</p>
      </div>
    </div>
  )
}

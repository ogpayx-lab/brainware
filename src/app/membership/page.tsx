'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Screen = 'welcome' | 'register' | 'success' | 'points'

const NATIONALITIES = [
  'Malta','Italy','United Kingdom','Germany','France','Spain','Netherlands','Belgium','Austria','Switzerland',
  'Sweden','Norway','Denmark','Finland','Poland','Czech Republic','Hungary','Romania','Bulgaria','Croatia',
  'Greece','Portugal','Ireland','Luxembourg','Slovenia','Slovakia','Estonia','Latvia','Lithuania','Cyprus',
  'United States','Canada','Australia','Brazil','Argentina','Japan','China','South Korea','India','Russia',
  'Turkey','Egypt','Morocco','Tunisia','South Africa','Nigeria','Israel','UAE','Saudi Arabia','Other'
]
const HOW_OPTIONS = ['Walk-in','Google','Social Media','Friends','AI/ChatGPT','TripAdvisor','Hotel/Hostel','Other']

export default function MembershipPage() {
  const supabase = createClient()
  const [screen, setScreen] = useState<Screen>('welcome')
  const [storeId, setStoreId] = useState<string|null>(null)
  const [storeName, setStoreName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Register form
  const [form, setForm] = useState({
    first_name:'', last_name:'', phone:'', email:'',
    nationality:'Malta', how:'Walk-in', is_resident:false, privacy:false,
  })

  // Created card
  const [card, setCard] = useState<any>(null)

  // Points check
  const [checkPhone, setCheckPhone] = useState('')
  const [foundCard, setFoundCard] = useState<any>(null)
  const [pointsLoading, setPointsLoading] = useState(false)
  const [pointsError, setPointsError] = useState('')

  // Auto-timeout
  const [timeout, setTimeoutId] = useState<NodeJS.Timeout|null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const slug = params.get('store')
    if (!slug) { setError('Missing store parameter'); setLoading(false); return }
    loadStore(slug)
  }, [])

  async function loadStore(slug: string) {
    // Try by slug first, then by id
    let { data } = await supabase.from('stores').select('id,name').eq('slug', slug).single()
    if (!data) {
      const r = await supabase.from('stores').select('id,name').eq('id', slug).single()
      data = r.data
    }
    if (!data) { setError('Store not found'); setLoading(false); return }
    setStoreId(data.id)
    setStoreName(data.name)
    setLoading(false)
  }

  const resetToWelcome = useCallback(() => {
    setScreen('welcome')
    setForm({ first_name:'',last_name:'',phone:'',email:'',nationality:'Malta',how:'Walk-in',is_resident:false,privacy:false })
    setCard(null); setFoundCard(null); setCheckPhone(''); setPointsError('')
  }, [])

  function startTimeout(ms = 25000) {
    if (timeout) clearTimeout(timeout)
    const t = setTimeout(resetToWelcome, ms)
    setTimeoutId(t)
  }

  async function handleRegister() {
    if (!storeId || !form.first_name || !form.last_name || !form.phone || !form.privacy) return
    setSaving(true); setError('')
    const fullName = `${form.first_name} ${form.last_name}`
    const { data, error: err } = await supabase.from('fidelity_cards').insert({
      store_id: storeId, customer_name: fullName, customer_phone: form.phone,
      customer_email: form.email || null, customer_nationality: form.nationality,
      acquisition_source: form.how, is_resident: form.is_resident, notes: null,
    }).select('*').single()
    if (err) { setError(err.message); setSaving(false); return }
    setCard(data); setScreen('success'); setSaving(false); startTimeout(25000)
    // Notify store
    await supabase.from('notifications').insert({
      store_id: storeId, type: 'fidelity',
      title: '🎉 New Membership',
      message: `${fullName} (${form.phone}) just registered as a member via kiosk.`,
    }).catch(() => {})
  }

  async function handleCheckPoints() {
    if (!checkPhone || !storeId) return
    setPointsLoading(true); setPointsError(''); setFoundCard(null)
    const { data } = await supabase.from('fidelity_cards')
      .select('*').eq('store_id', storeId).eq('customer_phone', checkPhone).single()
    if (!data) { setPointsError('No membership found with this phone number.'); setPointsLoading(false); return }
    setFoundCard(data); setPointsLoading(false); startTimeout(20000)
  }

  const rewards = foundCard ? Math.floor((foundCard.points || 0) / 10) : 0
  const nextReward = foundCard ? 10 - ((foundCard.points || 0) % 10) : 10

  if (loading) return <div style={styles.center}><div style={styles.spinner}>Loading...</div></div>
  if (error && !storeId) return <div style={styles.center}><div style={{color:'#EF4444',fontSize:18}}>{error}</div></div>

  // ═══════════════════════════════════════
  // WELCOME SCREEN
  // ═══════════════════════════════════════
  if (screen === 'welcome') return (
    <div style={styles.page}>
      <div style={styles.welcomeContainer}>
        <div style={styles.logo}>✦</div>
        <h1 style={styles.storeName}>{storeName}</h1>
        <p style={styles.subtitle}>Membership Card</p>
        <div style={styles.divider} />
        <p style={styles.welcomeText}>Join our membership program and earn rewards with every purchase!</p>
        <p style={styles.rewardInfo}>🎁 Earn <strong>1 point</strong> for every <strong>€10</strong> spent.<br/>Get a <strong>free gift</strong> every <strong>10 points!</strong></p>
        <div style={styles.btnGroup}>
          <button onClick={() => setScreen('register')} style={styles.btnPrimary}>
            ✨ Become a Member
          </button>
          <button onClick={() => setScreen('points')} style={styles.btnSecondary}>
            🔍 Check Your Points
          </button>
        </div>
      </div>
    </div>
  )

  // ═══════════════════════════════════════
  // REGISTER SCREEN
  // ═══════════════════════════════════════
  if (screen === 'register') return (
    <div style={styles.page}>
      <div style={styles.formContainer}>
        <button onClick={resetToWelcome} style={styles.backBtn}>← Back</button>
        <h2 style={styles.formTitle}>Create Your Membership</h2>
        <p style={styles.formSub}>Fill in your details to get started</p>

        <div style={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>First Name *</label>
            <input style={styles.input} placeholder="John" value={form.first_name}
              onChange={e => setForm(f => ({...f, first_name: e.target.value}))} />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Last Name *</label>
            <input style={styles.input} placeholder="Smith" value={form.last_name}
              onChange={e => setForm(f => ({...f, last_name: e.target.value}))} />
          </div>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Phone Number *</label>
          <input style={styles.input} type="tel" placeholder="+356 1234 5678" value={form.phone}
            onChange={e => setForm(f => ({...f, phone: e.target.value}))} />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Email <span style={{color:'#9CA3AF',fontWeight:400}}>(optional)</span></label>
          <input style={styles.input} type="email" placeholder="john@email.com" value={form.email}
            onChange={e => setForm(f => ({...f, email: e.target.value}))} />
        </div>

        <div style={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Nationality *</label>
            <select style={styles.input} value={form.nationality}
              onChange={e => setForm(f => ({...f, nationality: e.target.value}))}>
              {NATIONALITIES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>How did you find us?</label>
            <select style={styles.input} value={form.how}
              onChange={e => setForm(f => ({...f, how: e.target.value}))}>
              {HOW_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
        </div>

        {/* Resident toggle */}
        <div style={styles.toggleRow}>
          <span style={styles.toggleLabel}>Are you a Malta resident?</span>
          <div style={styles.toggleTrack} onClick={() => setForm(f => ({...f, is_resident: !f.is_resident}))}>
            <div style={{...styles.toggleThumb, ...(form.is_resident ? styles.toggleOn : {})}} />
            <span style={styles.toggleText}>{form.is_resident ? 'YES' : 'NO'}</span>
          </div>
        </div>

        {/* GDPR */}
        <div style={styles.privacyRow}>
          <input type="checkbox" id="gdpr" checked={form.privacy}
            onChange={e => setForm(f => ({...f, privacy: e.target.checked}))}
            style={styles.checkbox} />
          <label htmlFor="gdpr" style={styles.privacyText}>
            I consent to the processing of my personal data in accordance with GDPR regulations.
          </label>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        <button onClick={handleRegister} style={{
          ...styles.btnPrimary,
          opacity: (!form.first_name || !form.last_name || !form.phone || !form.privacy) ? 0.5 : 1,
        }} disabled={saving || !form.first_name || !form.last_name || !form.phone || !form.privacy}>
          {saving ? 'Creating...' : '🎉 Create My Membership'}
        </button>
      </div>
    </div>
  )

  // ═══════════════════════════════════════
  // SUCCESS SCREEN
  // ═══════════════════════════════════════
  if (screen === 'success' && card) return (
    <div style={styles.page}>
      <div style={styles.successContainer}>
        <div style={styles.confetti}>🎉</div>
        <h2 style={styles.successTitle}>Welcome, {card.customer_name}!</h2>
        <p style={styles.successSub}>Your membership card is now active</p>

        {/* Card preview */}
        <div style={styles.memberCard}>
          <div style={styles.cardTop}>
            <div>
              <div style={styles.cardLabel}>MEMBERSHIP CARD</div>
              <div style={styles.cardStore}>{storeName}</div>
            </div>
            <div style={styles.cardLogo}>✦</div>
          </div>
          <div style={styles.cardName}>{card.customer_name.toUpperCase()}</div>
          <div style={styles.cardNumber}>{card.card_number}</div>
          <div style={styles.cardBottom}>
            <div>
              <div style={styles.cardSmall}>MEMBER SINCE</div>
              <div style={styles.cardDate}>{new Date().toLocaleDateString('en-GB')}</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:28,fontWeight:800,color:'#22C55E'}}>0</div>
              <div style={styles.cardSmall}>POINTS</div>
            </div>
          </div>
        </div>

        <div style={styles.rewardBanner}>
          🎁 Earn <strong>1 point</strong> every <strong>€10</strong> spent — get a <strong>free gift</strong> every 10 points!
        </div>

        {/* WhatsApp share */}
        <button onClick={() => {
          const msg = encodeURIComponent(
            `🎉 ${storeName} Membership Card\n\n` +
            `Name: ${card.customer_name}\n` +
            `Card: ${card.card_number}\n` +
            `Points: 0\n\n` +
            `Show this at every purchase to earn rewards! 🎁`
          )
          window.open(`https://wa.me/${card.customer_phone?.replace(/\D/g,'')}?text=${msg}`, '_blank')
        }} style={styles.btnWhatsapp}>
          📱 Send to WhatsApp
        </button>

        <button onClick={resetToWelcome} style={{...styles.btnSecondary, marginTop:12}}>
          ← Done
        </button>
      </div>
    </div>
  )

  // ═══════════════════════════════════════
  // POINTS CHECK SCREEN
  // ═══════════════════════════════════════
  if (screen === 'points') return (
    <div style={styles.page}>
      <div style={styles.formContainer}>
        <button onClick={resetToWelcome} style={styles.backBtn}>← Back</button>
        <h2 style={styles.formTitle}>Check Your Points</h2>
        <p style={styles.formSub}>Enter your phone number to view your membership</p>

        <div style={styles.field}>
          <label style={styles.label}>Phone Number</label>
          <input style={styles.input} type="tel" placeholder="+356 1234 5678" value={checkPhone}
            onChange={e => { setCheckPhone(e.target.value); setPointsError(''); setFoundCard(null) }}
            onKeyDown={e => e.key === 'Enter' && handleCheckPoints()} />
        </div>

        <button onClick={handleCheckPoints} disabled={pointsLoading || !checkPhone}
          style={{...styles.btnPrimary, opacity: !checkPhone ? 0.5 : 1}}>
          {pointsLoading ? 'Searching...' : '🔍 Find My Card'}
        </button>

        {pointsError && <div style={styles.errorBox}>{pointsError}</div>}

        {foundCard && (
          <div style={{marginTop:24}}>
            <div style={styles.memberCard}>
              <div style={styles.cardTop}>
                <div>
                  <div style={styles.cardLabel}>MEMBERSHIP CARD</div>
                  <div style={styles.cardStore}>{storeName}</div>
                </div>
                <div style={styles.cardLogo}>✦</div>
              </div>
              <div style={styles.cardName}>{foundCard.customer_name.toUpperCase()}</div>
              <div style={styles.cardNumber}>{foundCard.card_number}</div>
              <div style={styles.cardBottom}>
                <div>
                  <div style={styles.cardSmall}>MEMBER SINCE</div>
                  <div style={styles.cardDate}>{new Date(foundCard.created_at).toLocaleDateString('en-GB')}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:28,fontWeight:800,color:'#22C55E'}}>{foundCard.points || 0}</div>
                  <div style={styles.cardSmall}>POINTS</div>
                </div>
              </div>
            </div>

            {/* Progress to next reward */}
            <div style={styles.progressBox}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                <span style={{fontSize:14,fontWeight:600}}>🎁 Next Reward</span>
                <span style={{fontSize:13,color:'#9CA3AF'}}>{nextReward} points to go</span>
              </div>
              <div style={styles.progressTrack}>
                <div style={{...styles.progressBar, width: `${(((foundCard.points||0) % 10) / 10) * 100}%`}} />
              </div>
              {rewards > 0 && (
                <div style={styles.rewardCount}>
                  🏆 You have earned <strong>{rewards}</strong> reward{rewards > 1 ? 's' : ''} so far!
                </div>
              )}
            </div>
          </div>
        )}

        {!foundCard && !pointsError && (
          <div style={{textAlign:'center',marginTop:32}}>
            <p style={{color:'#9CA3AF',fontSize:14}}>Don't have a membership yet?</p>
            <button onClick={() => setScreen('register')} style={{...styles.btnSecondary,marginTop:8}}>
              ✨ Register Now
            </button>
          </div>
        )}
      </div>
    </div>
  )

  return null
}

// ═══════════════════════════════════════
// STYLES
// ═══════════════════════════════════════
const styles: Record<string, React.CSSProperties> = {
  page: { minHeight:'100dvh', background:'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)', display:'flex', alignItems:'center', justifyContent:'center', padding:24, fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif' },
  center: { display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0F172A', color:'white' },
  spinner: { fontSize:18, color:'#94A3B8' },

  // Welcome
  welcomeContainer: { textAlign:'center', maxWidth:480, width:'100%' },
  logo: { fontSize:64, marginBottom:16, color:'#22C55E' },
  storeName: { fontSize:32, fontWeight:800, color:'white', margin:'0 0 4px', letterSpacing:'-0.02em' },
  subtitle: { fontSize:16, color:'#94A3B8', letterSpacing:'0.1em', textTransform:'uppercase' as const, margin:'0 0 24px' },
  divider: { width:60, height:2, background:'linear-gradient(90deg,transparent,#22C55E,transparent)', margin:'0 auto 24px' },
  welcomeText: { fontSize:16, color:'#CBD5E1', lineHeight:1.6, marginBottom:16 },
  rewardInfo: { fontSize:14, color:'#94A3B8', lineHeight:1.6, marginBottom:32, background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:12, padding:'14px 20px' },

  btnGroup: { display:'flex', flexDirection:'column' as const, gap:12 },
  btnPrimary: { width:'100%', padding:'16px 24px', fontSize:17, fontWeight:700, border:'none', borderRadius:14, background:'linear-gradient(135deg,#22C55E,#16A34A)', color:'white', cursor:'pointer', letterSpacing:'0.01em', boxShadow:'0 4px 20px rgba(34,197,94,0.3)' },
  btnSecondary: { width:'100%', padding:'14px 24px', fontSize:15, fontWeight:600, border:'1.5px solid #334155', borderRadius:14, background:'transparent', color:'#CBD5E1', cursor:'pointer' },
  btnWhatsapp: { width:'100%', padding:'14px 24px', fontSize:15, fontWeight:700, border:'none', borderRadius:14, background:'#25D366', color:'white', cursor:'pointer', marginTop:8 },

  // Form
  formContainer: { maxWidth:520, width:'100%', background:'#1E293B', borderRadius:20, padding:32, border:'1px solid #334155' },
  backBtn: { background:'none', border:'none', color:'#94A3B8', fontSize:14, cursor:'pointer', padding:0, marginBottom:16, fontWeight:600 },
  formTitle: { fontSize:24, fontWeight:800, color:'white', margin:'0 0 4px' },
  formSub: { fontSize:14, color:'#94A3B8', margin:'0 0 24px' },
  row: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 },
  field: { marginBottom:16 },
  label: { display:'block', fontSize:13, fontWeight:600, color:'#CBD5E1', marginBottom:6 },
  input: { width:'100%', padding:'12px 14px', fontSize:15, border:'1.5px solid #334155', borderRadius:10, background:'#0F172A', color:'white', outline:'none', boxSizing:'border-box' as const },

  // Toggle
  toggleRow: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 0', borderTop:'1px solid #334155', borderBottom:'1px solid #334155', marginBottom:16 },
  toggleLabel: { fontSize:14, fontWeight:600, color:'#CBD5E1' },
  toggleTrack: { width:80, height:38, borderRadius:20, background:'#334155', position:'relative' as const, cursor:'pointer', display:'flex', alignItems:'center', padding:'0 8px' },
  toggleThumb: { width:28, height:28, borderRadius:14, background:'#64748B', position:'absolute' as const, left:4, top:5, transition:'all 0.2s' },
  toggleOn: { left:48, background:'#22C55E' },
  toggleText: { fontSize:11, fontWeight:700, color:'#94A3B8', marginLeft:'auto' },

  // Privacy
  privacyRow: { display:'flex', alignItems:'flex-start', gap:10, marginBottom:20 },
  checkbox: { width:20, height:20, marginTop:2, accentColor:'#22C55E', cursor:'pointer', flexShrink:0 },
  privacyText: { fontSize:13, color:'#94A3B8', lineHeight:1.5, cursor:'pointer' },

  errorBox: { background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#EF4444', marginBottom:16 },

  // Success
  successContainer: { maxWidth:480, width:'100%', textAlign:'center' as const },
  confetti: { fontSize:64, marginBottom:8 },
  successTitle: { fontSize:26, fontWeight:800, color:'white', margin:'0 0 4px' },
  successSub: { fontSize:15, color:'#94A3B8', margin:'0 0 24px' },
  rewardBanner: { fontSize:14, color:'#CBD5E1', background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:12, padding:'12px 16px', marginBottom:8, lineHeight:1.5 },

  // Card
  memberCard: { background:'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', borderRadius:20, padding:28, color:'white', boxShadow:'0 8px 40px rgba(0,0,0,0.4)', marginBottom:20, textAlign:'left' as const },
  cardTop: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:28 },
  cardLabel: { fontSize:10, fontWeight:700, letterSpacing:'0.12em', opacity:0.5, marginBottom:4 },
  cardStore: { fontSize:20, fontWeight:800 },
  cardLogo: { width:44, height:44, borderRadius:10, background:'#22C55E', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:800, color:'white' },
  cardName: { fontSize:18, fontWeight:700, letterSpacing:'0.04em', marginBottom:4 },
  cardNumber: { fontSize:13, opacity:0.5, letterSpacing:'0.08em', marginBottom:20 },
  cardBottom: { display:'flex', justifyContent:'space-between', alignItems:'flex-end' },
  cardSmall: { fontSize:10, opacity:0.4, letterSpacing:'0.06em' },
  cardDate: { fontSize:13, marginTop:2 },

  // Progress
  progressBox: { background:'#1E293B', border:'1px solid #334155', borderRadius:14, padding:20, marginTop:16 },
  progressTrack: { height:10, borderRadius:5, background:'#334155', overflow:'hidden' },
  progressBar: { height:'100%', borderRadius:5, background:'linear-gradient(90deg,#22C55E,#16A34A)', transition:'width 0.5s' },
  rewardCount: { fontSize:14, color:'#22C55E', marginTop:12, fontWeight:600 },
}

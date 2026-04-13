'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatTime } from '@/lib/utils'
import { BottomNav } from '@/components/employee/BottomNav'
import type { FidelityCard } from '@/types/database'

interface CardCreated {
  card_number: string
  customer_name: string
  customer_phone: string
  customer_email: string
  customer_nationality: string
  acquisition_source: string
}

export default function FidelityPage() {
  const router = useRouter()
  const supabase = createClient()

  const [cards, setCards] = useState<any[]>([])
  const [stats, setStats] = useState({ total: 0, active: 0, pointsToday: 0 })
  const [shiftId, setShiftId] = useState<string | null>(null)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState<CardCreated | null>(null)

  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    dob: '', notes: '', nationality: 'Italia', how: 'Walk-in',
    privacy: false,
  })

  const NATIONALITIES = [
    'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua e Barbuda','Arabia Saudita','Argentina','Armenia','Australia',
    'Austria','Azerbaigian','Bahamas','Bahrain','Bangladesh','Barbados','Belgio','Belize','Benin','Bhutan',
    'Bielorussia','Bolivia','Bosnia ed Erzegovina','Botswana','Brasile','Brunei','Bulgaria','Burkina Faso','Burundi','Cambogia',
    'Camerun','Canada','Capo Verde','Ciad','Cile','Cina','Cipro','Colombia','Comore','Congo',
    'Corea del Nord','Corea del Sud','Costa Rica','Costa d\'Avorio','Croazia','Cuba','Danimarca','Dominica','Ecuador','Egitto',
    'El Salvador','Emirati Arabi Uniti','Eritrea','Estonia','Eswatini','Etiopia','Fiji','Filippine','Finlandia','Francia',
    'Gabon','Gambia','Georgia','Germania','Ghana','Giamaica','Giappone','Gibuti','Giordania','Grecia',
    'Grenada','Guatemala','Guinea','Guinea-Bissau','Guinea Equatoriale','Guyana','Haiti','Honduras','India','Indonesia',
    'Iran','Iraq','Irlanda','Islanda','Israele','Italia','Kazakistan','Kenya','Kirghizistan','Kiribati',
    'Kuwait','Laos','Lesotho','Lettonia','Libano','Liberia','Libia','Liechtenstein','Lituania','Lussemburgo',
    'Madagascar','Malawi','Malaysia','Maldive','Mali','Malta','Marocco','Mauritania','Mauritius','Messico',
    'Micronesia','Moldavia','Monaco','Mongolia','Montenegro','Mozambico','Myanmar','Namibia','Nauru','Nepal',
    'Nicaragua','Niger','Nigeria','Norvegia','Nuova Zelanda','Oman','Paesi Bassi','Pakistan','Palau','Panama',
    'Papua Nuova Guinea','Paraguay','Per\u00f9','Polonia','Portogallo','Qatar','Regno Unito','Rep. Ceca','Rep. Dominicana','Romania',
    'Ruanda','Russia','Saint Kitts e Nevis','Saint Lucia','Saint Vincent','Samoa','San Marino','S\u00e3o Tom\u00e9','Senegal','Serbia',
    'Seychelles','Sierra Leone','Singapore','Siria','Slovacchia','Slovenia','Somalia','Spagna','Sri Lanka','Stati Uniti',
    'Sudafrica','Sudan','Sudan del Sud','Suriname','Svezia','Svizzera','Tagikistan','Tanzania','Thailandia','Timor Est',
    'Togo','Tonga','Trinidad e Tobago','Tunisia','Turchia','Turkmenistan','Tuvalu','Ucraina','Uganda','Ungheria',
    'Uruguay','Uzbekistan','Vanuatu','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe'
  ]
  const HOW_OPTIONS = ['Walk-in', 'Usual Customer', 'Google', 'Social', 'AI/ChatGPT/Gemini Etc..', 'Friends']

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserId(user.id)

    const { data: profile } = await supabase.from('users').select('store_id').eq('id', user.id).single()
    if (!profile?.store_id) return
    setStoreId(profile.store_id)

    const { data: shift } = await supabase.from('shifts').select('id').eq('user_id', user.id).eq('status', 'open').order('created_at',{ascending:false}).limit(1).single()
    if (shift) setShiftId(shift.id)

    const [{ data: allCards }, { count: activeCount }] = await Promise.all([
      supabase.from('fidelity_cards').select('*').eq('store_id', profile.store_id).order('created_at', { ascending: false }).limit(10),
      supabase.from('fidelity_cards').select('*', { count: 'exact', head: true }).eq('store_id', profile.store_id).eq('is_active', true),
    ])

    setCards(allCards ?? [])
    setStats({ total: allCards?.length ?? 0, active: activeCount ?? 0, pointsToday: 345 })
    setLoading(false)
  }

  async function handleCreate() {
    if (!storeId || !userId || !form.first_name || !form.last_name || !form.phone || !form.privacy) return
    setSaving(true)

    const fullName = `${form.first_name} ${form.last_name}`

    const { data: card } = await supabase.from('fidelity_cards').insert({
      store_id: storeId,
      customer_name: fullName,
      customer_phone: form.phone,
      customer_email: form.email || null,
      customer_dob: form.dob || null,
      customer_nationality: form.nationality,
      acquisition_source: form.how,
      notes: form.notes || null,
      created_by: userId,
    }).select('card_number').single()

    if (card) {
      setCreated({
        card_number: card.card_number,
        customer_name: fullName,
        customer_phone: form.phone,
        customer_email: form.email,
        customer_nationality: form.nationality,
        acquisition_source: form.how,
      })

      const { data: empProfile } = await supabase.from('users').select('full_name').eq('id', userId).single()
      await supabase.from('notifications').insert({
        store_id: storeId,
        type: 'fidelity',
        title: '💳 Nuova Fidelity Card',
        message: `${empProfile?.full_name || 'Dipendente'} ha creato una e-Card per ${fullName} (${form.phone}).`,
      })

      setForm({ first_name: '', last_name: '', email: '', phone: '', dob: '', notes: '', nationality: 'Italia', how: 'Walk-in', privacy: false })
      await loadData()
    }
    setSaving(false)
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>Caricamento...</div>

  // Success screen
  if (created) return (
    <div className="page" style={{ paddingBottom: 80 }}>
      <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)', padding: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        <h3>Fidelity e-Card</h3>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Card creata con successo</span>
      </div>

      <div style={{ padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        <div style={{ textAlign: 'center', padding: 'var(--space-xl)', background: 'var(--success-light)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--brand-primary)' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}></div>
          <h3 style={{ color: 'var(--brand-primary-dark)', marginBottom: 4 }}>e-Card creata con successo!</h3>
          <p style={{ fontSize: 14, color: 'var(--brand-primary-dark)', opacity: 0.8 }}>
            La card <strong>{created.card_number}</strong> e stata attivata per {created.customer_name}
          </p>
        </div>

        {/* Card preview */}
        <div style={{
          background: 'linear-gradient(135deg, #1A1A2E 0%, #16213E 50%, #0F3460 100%)',
          borderRadius: 'var(--radius-xl)',
          padding: '24px',
          color: 'white',
          boxShadow: 'var(--shadow-lg)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', opacity: 0.6, marginBottom: 4 }}>FIDELITY e-CARD</div>
              <div style={{ fontSize: 20, fontFamily: 'var(--font-heading)', fontWeight: 700 }}>BrainWare</div>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 20 }}>B</div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.05em' }}>{created.customer_name.toUpperCase()}</div>
            <div style={{ fontSize: 13, opacity: 0.6, marginTop: 4, letterSpacing: '0.1em' }}>{created.card_number}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: 10, opacity: 0.5, letterSpacing: '0.05em' }}>ATTIVA DAL</div>
              <div style={{ fontSize: 13 }}>{new Date().toLocaleDateString('it-IT')}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--brand-primary)' }}>0</div>
              <div style={{ fontSize: 10, opacity: 0.5, letterSpacing: '0.05em' }}>PUNTI</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-sm)' }}>
          <button
            className="btn btn-secondary"
            style={{ flexDirection: 'column', gap: 4, padding: 'var(--space-md)' }}
            onClick={() => {
              const msg = encodeURIComponent(`Benvenuto! La tua Fidelity e-Card BrainWare è stata attivata.\nNumero Card: ${created.card_number}\nNome: ${created.customer_name}\nPunti: 0\nGrazie per averci scelto!`)
              window.open(`sms:${created.customer_phone}?body=${msg}`, '_blank')
            }}
            disabled={!created.customer_phone}
          >
            <span>📱</span><span style={{ fontSize: 12 }}>Invia SMS</span>
          </button>
          <button
            className="btn btn-secondary"
            style={{ flexDirection: 'column', gap: 4, padding: 'var(--space-md)' }}
            onClick={() => {
              const subject = encodeURIComponent('La tua Fidelity e-Card BrainWare')
              const body = encodeURIComponent(`Ciao ${created.customer_name},\n\nLa tua Fidelity e-Card è stata attivata con successo!\n\nNumero Card: ${created.card_number}\nPunti accumulati: 0\n\nPresenta il tuo numero card ad ogni acquisto per accumulare punti e ottenere sconti esclusivi.\n\nGrazie per averci scelto!\nBrainWare`)
              window.open(`mailto:${created.customer_email}?subject=${subject}&body=${body}`, '_blank')
            }}
            disabled={!created.customer_email}
          >
            <span>📧</span><span style={{ fontSize: 12 }}>Invia Email</span>
          </button>
          <button
            className="btn btn-secondary"
            style={{ flexDirection: 'column', gap: 4, padding: 'var(--space-md)' }}
            onClick={() => {
              // Generate a printable card with QR code using a QR API
              const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(created.card_number)}`
              const w = window.open('', '_blank', 'width=400,height=600')
              if (w) {
                w.document.write(`
                  <html><head><title>Fidelity Card - ${created.card_number}</title>
                  <style>
                    body { font-family: -apple-system, sans-serif; text-align: center; padding: 40px 20px; margin: 0; }
                    .card { max-width: 320px; margin: 0 auto; border: 2px solid #1A1A2E; border-radius: 16px; padding: 30px; }
                    h2 { color: #1A1A2E; margin: 0 0 4px; font-size: 20px; }
                    .subtitle { color: #666; font-size: 12px; letter-spacing: 0.1em; margin-bottom: 20px; }
                    .name { font-size: 18px; font-weight: 700; margin: 16px 0 4px; }
                    .number { font-size: 14px; color: #999; letter-spacing: 0.05em; margin-bottom: 20px; }
                    img { margin: 0 auto; display: block; }
                    .footer { font-size: 11px; color: #999; margin-top: 20px; }
                    @media print { body { padding: 0; } }
                  </style></head><body>
                  <div class="card">
                    <h2>BrainWare</h2>
                    <div class="subtitle">FIDELITY e-CARD</div>
                    <img src="${qrUrl}" width="180" height="180" alt="QR Code" />
                    <div class="name">${created.customer_name}</div>
                    <div class="number">${created.card_number}</div>
                    <div class="footer">Presenta questa card ad ogni acquisto</div>
                  </div>
                  <script>setTimeout(() => window.print(), 500)</script>
                  </body></html>
                `)
                w.document.close()
              }
            }}
          >
            <span>🖨️</span><span style={{ fontSize: 12 }}>Stampa QR</span>
          </button>
        </div>

        {/* Customer details */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          <h4 style={{ marginBottom: 8 }}>Dati Cliente</h4>
          {[
            { l: 'Nome Completo', v: created.customer_name },
            { l: 'Telefono', v: created.customer_phone },
            { l: 'Email', v: created.customer_email || '' },
            { l: 'Nazionalita', v: created.customer_nationality },
            { l: 'Come ci ha trovato', v: created.acquisition_source },
            { l: 'Numero Card', v: created.card_number },
            { l: 'Punti', v: '0 (appena creata)' },
          ].map(d => (
            <div key={d.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 13 }}>
              <span style={{ color: 'var(--text-secondary)' }}>{d.l}</span>
              <span style={{ fontWeight: 600 }}>{d.v}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
          <button onClick={() => setCreated(null)} className="btn btn-primary">+ Nuova Card</button>
          <button onClick={() => router.push('/employee/dashboard')} className="btn btn-secondary">Lista Clienti</button>
        </div>
      </div>

      <BottomNav />
    </div>
  )

  return (
    <div className="page" style={{ paddingBottom: 80 }}>
      <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)', padding: 'var(--space-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Fidelity e-Card</h3>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button className="btn btn-secondary" style={{ fontSize: 12 }}> Scansiona Card</button>
          <button onClick={() => {}} className="btn btn-primary" style={{ fontSize: 12 }}>+ Nuova e-Card</button>
        </div>
      </div>

      <div style={{ padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)' }}>
          <div className="kpi-card">
            <div className="kpi-label">Clienti Registrati</div>
            <div className="kpi-value">{stats.total}</div>
            <div className="kpi-sub">+8 questo mese</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Card Attive</div>
            <div className="kpi-value">{stats.active}</div>
            <div className="kpi-sub" style={{ color: 'var(--success)' }}>{stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}% del totale</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Punti Emessi Oggi</div>
            <div className="kpi-value">{stats.pointsToday}</div>
            <div className="kpi-sub">spesa clienti fidelity</div>
          </div>
        </div>

        {/* Form nuova card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4>Nuova Fidelity e-Card</h4>
            <span className="badge badge-brand">Step 1/2</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div className="input-group">
              <label className="input-label">Nome *</label>
              <input className="input" placeholder="Mario" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} />
            </div>
            <div className="input-group">
              <label className="input-label">Cognome *</label>
              <input className="input" placeholder="Bianchi" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Telefono *</label>
            <input className="input" type="tel" placeholder="+39 333 456 7890" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div className="input-group">
              <label className="input-label">Email</label>
              <input className="input" type="email" placeholder="mario@email.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="input-group">
              <label className="input-label">Data di Nascita</label>
              <input className="input" type="date" value={form.dob} onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div className="input-group">
              <label className="input-label">Nazionalita *</label>
              <select className="input" value={form.nationality} onChange={e => setForm(f => ({ ...f, nationality: e.target.value }))}>
                {NATIONALITIES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Come ci conosce? *</label>
              <select className="input" value={form.how} onChange={e => setForm(f => ({ ...f, how: e.target.value }))}>
                {HOW_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Note (opzionale)</label>
            <textarea className="input" placeholder="Cliente abituale, preferisce..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-sm)' }}>
            <input type="checkbox" id="privacy" checked={form.privacy} onChange={e => setForm(f => ({ ...f, privacy: e.target.checked }))}
              style={{ width: 16, height: 16, marginTop: 2, accentColor: 'var(--brand-primary)', cursor: 'pointer', flexShrink: 0 }} />
            <label htmlFor="privacy" style={{ fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', lineHeight: 1.4 }}>
              Acconsento al trattamento dei dati personali (GDPR)
            </label>
          </div>

          <button onClick={handleCreate} disabled={saving || !form.first_name || !form.last_name || !form.phone || !form.privacy} className="btn btn-primary btn-full btn-lg">
            {saving ? 'Creazione...' : 'Crea e-Card'}
          </button>
        </div>

        {/* Recent cards */}
        {cards.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
              <h4>Ultime Card Create</h4>
              <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Oggi: {cards.filter(c => new Date(c.created_at).toDateString() === new Date().toDateString()).length}</span>
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {cards.slice(0, 5).map((card, i) => (
                <div key={card.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: 'var(--space-md) var(--space-lg)', borderBottom: i < Math.min(cards.length, 5) - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--brand-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: 'var(--brand-primary-dark)' }}>
                    {card.customer_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{card.customer_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{card.customer_phone}  {formatTime(card.created_at)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>{card.card_number}</div>
                    <span className="badge badge-success" style={{ fontSize: 10 }}>Attiva</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
      <BottomNav />
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [storeId, setStoreId] = useState<string | null>(null)
  const [store, setStore] = useState({ name: '', address: '', city: '' })
  const [brand, setBrand] = useState({ brand_name: '', logo_letter: '', primary_color: '#22C55E', piva: '', receipt_header: '', receipt_footer: 'Grazie per il tuo acquisto!' })
  const [brandId, setBrandId] = useState<string | null>(null)
  const [cfg, setCfg] = useState({ fcu_default: 200, morning_shift_start: '08:00', morning_shift_end: '14:00', evening_shift_start: '14:00', evening_shift_end: '22:00', stock_alert_threshold: 5, discount_notify_pct: 15 })
  const [cfgId, setCfgId] = useState<string | null>(null)
  const [bonus, setBonus] = useState({ sales_commission_pct: 0.01, hours_bonus_amount: 5, hours_bonus_threshold: 8, avg_sale_threshold: 40 })
  const [bonusId, setBonusId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('store_id, role').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }
    setStoreId(profile.store_id)

    const [{ data: storeData }, { data: brandData }, { data: cfgData }, { data: bonusData }] = await Promise.all([
      supabase.from('stores').select('*').eq('id', profile.store_id).single(),
      supabase.from('brand_config').select('*').eq('store_id', profile.store_id).single(),
      supabase.from('store_config').select('*').eq('store_id', profile.store_id).single(),
      supabase.from('bonus_config').select('*').eq('store_id', profile.store_id).single(),
    ])

    if (storeData) setStore({ name: storeData.name, address: storeData.address ?? '', city: storeData.city ?? '' })
    if (brandData) { setBrand({ brand_name: brandData.brand_name, logo_letter: brandData.logo_letter, primary_color: brandData.primary_color, piva: brandData.piva ?? '', receipt_header: brandData.receipt_header ?? '', receipt_footer: brandData.receipt_footer ?? '' }); setBrandId(brandData.id) }
    if (cfgData) { setCfg({ fcu_default: cfgData.fcu_default, morning_shift_start: cfgData.morning_shift_start, morning_shift_end: cfgData.morning_shift_end, evening_shift_start: cfgData.evening_shift_start, evening_shift_end: cfgData.evening_shift_end, stock_alert_threshold: cfgData.stock_alert_threshold, discount_notify_pct: cfgData.discount_notify_pct }); setCfgId(cfgData.id) }
    if (bonusData) { setBonus({ sales_commission_pct: bonusData.sales_commission_pct, hours_bonus_amount: bonusData.hours_bonus_amount, hours_bonus_threshold: bonusData.hours_bonus_threshold, avg_sale_threshold: bonusData.avg_sale_threshold }); setBonusId(bonusData.id) }
    setLoading(false)
  }

  function showSaved(section: string) { setSaved(section); setTimeout(() => setSaved(''), 2000) }

  async function saveStore() {
    if (!storeId) return; setSaving(true)
    await supabase.from('stores').update(store).eq('id', storeId)
    showSaved('store'); setSaving(false)
  }

  async function saveBrand() {
    if (!storeId) return; setSaving(true)
    if (brandId) { await supabase.from('brand_config').update(brand).eq('id', brandId) }
    else { const { data } = await supabase.from('brand_config').insert({ store_id: storeId, ...brand }).select('id').single(); if (data) setBrandId(data.id) }
    showSaved('brand'); setSaving(false)
  }

  async function saveConfig() {
    if (!storeId) return; setSaving(true)
    if (cfgId) { await supabase.from('store_config').update(cfg).eq('id', cfgId) }
    else { const { data } = await supabase.from('store_config').insert({ store_id: storeId, ...cfg }).select('id').single(); if (data) setCfgId(data.id) }
    showSaved('config'); setSaving(false)
  }

  async function saveBonus() {
    if (!storeId) return; setSaving(true)
    if (bonusId) { await supabase.from('bonus_config').update(bonus).eq('id', bonusId) }
    else { const { data } = await supabase.from('bonus_config').insert({ store_id: storeId, ...bonus }).select('id').single(); if (data) setBonusId(data.id) }
    showSaved('bonus'); setSaving(false)
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>Caricamento...</div>

  const SavedBadge = ({ section }: { section: string }) => saved === section
    ? <span className="badge badge-success" style={{ marginLeft: 8 }}> Salvato</span> : null

  return (
    <div>
      <h2 style={{ marginBottom: 'var(--space-xl)' }}>Impostazioni Negozio</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>

        {/* Branding */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h3>Branding</h3><SavedBadge section="brand" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div className="input-group">
              <label className="input-label">Nome Brand</label>
              <input className="input" value={brand.brand_name} onChange={e => setBrand(b => ({ ...b, brand_name: e.target.value }))} />
            </div>
            <div className="input-group">
              <label className="input-label">Lettera Logo</label>
              <input className="input" maxLength={1} value={brand.logo_letter} onChange={e => setBrand(b => ({ ...b, logo_letter: e.target.value }))} />
            </div>
            <div className="input-group">
              <label className="input-label">Colore Primario</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={brand.primary_color} onChange={e => setBrand(b => ({ ...b, primary_color: e.target.value }))} style={{ width: 44, height: 44, border: 'none', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
                <input className="input" value={brand.primary_color} onChange={e => setBrand(b => ({ ...b, primary_color: e.target.value }))} style={{ flex: 1 }} />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">P.IVA</label>
              <input className="input" placeholder="IT12345678901" value={brand.piva} onChange={e => setBrand(b => ({ ...b, piva: e.target.value }))} />
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Intestazione Scontrino</label>
            <input className="input" placeholder="Nome Negozio  Via Roma 42" value={brand.receipt_header} onChange={e => setBrand(b => ({ ...b, receipt_header: e.target.value }))} />
          </div>
          <div className="input-group">
            <label className="input-label">Messaggio Footer Scontrino</label>
            <input className="input" placeholder="Grazie per il tuo acquisto!" value={brand.receipt_footer} onChange={e => setBrand(b => ({ ...b, receipt_footer: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
            <button onClick={saveBrand} disabled={saving} className="btn btn-primary">Salva Branding</button>
            <div style={{ padding: '10px 16px', background: brand.primary_color + '18', border: `2px solid ${brand.primary_color}`, borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: brand.primary_color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14 }}>{brand.logo_letter || 'M'}</div>
              <span style={{ fontWeight: 700, color: brand.primary_color }}>{brand.brand_name || 'MamaMary'}</span>
            </div>
          </div>
        </div>

        {/* Turni & FCU */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h3>Turni & FCU</h3><SavedBadge section="config" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div className="input-group">
              <label className="input-label">FCU Desiderato Default ()</label>
              <input className="input" type="number" min="0" step="10" value={cfg.fcu_default} onChange={e => setCfg(c => ({ ...c, fcu_default: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div />
            <div className="input-group">
              <label className="input-label">Inizio Turno Mattina</label>
              <input className="input" type="time" value={cfg.morning_shift_start} onChange={e => setCfg(c => ({ ...c, morning_shift_start: e.target.value }))} />
            </div>
            <div className="input-group">
              <label className="input-label">Fine Turno Mattina</label>
              <input className="input" type="time" value={cfg.morning_shift_end} onChange={e => setCfg(c => ({ ...c, morning_shift_end: e.target.value }))} />
            </div>
            <div className="input-group">
              <label className="input-label">Inizio Turno Sera</label>
              <input className="input" type="time" value={cfg.evening_shift_start} onChange={e => setCfg(c => ({ ...c, evening_shift_start: e.target.value }))} />
            </div>
            <div className="input-group">
              <label className="input-label">Fine Turno Sera</label>
              <input className="input" type="time" value={cfg.evening_shift_end} onChange={e => setCfg(c => ({ ...c, evening_shift_end: e.target.value }))} />
            </div>
          </div>
          <h4 style={{ marginTop: 8 }}>Soglie</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div className="input-group">
              <label className="input-label">Alert Inventario (qty minima)</label>
              <input className="input" type="number" min="0" value={cfg.stock_alert_threshold} onChange={e => setCfg(c => ({ ...c, stock_alert_threshold: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="input-group">
              <label className="input-label">Soglia Sconto Notifica (%)</label>
              <input className="input" type="number" min="0" max="100" step="1" value={cfg.discount_notify_pct} onChange={e => setCfg(c => ({ ...c, discount_notify_pct: parseFloat(e.target.value) || 0 }))} />
            </div>
          </div>
          <button onClick={saveConfig} disabled={saving} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Salva Configurazione</button>
        </div>

        {/* Informazioni Negozio */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h3>Informazioni Negozio</h3><SavedBadge section="store" />
          </div>
          <div className="input-group">
            <label className="input-label">Nome negozio</label>
            <input className="input" value={store.name} onChange={e => setStore(s => ({ ...s, name: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-md)' }}>
            <div className="input-group">
              <label className="input-label">Indirizzo</label>
              <input className="input" value={store.address} onChange={e => setStore(s => ({ ...s, address: e.target.value }))} />
            </div>
            <div className="input-group">
              <label className="input-label">Citta</label>
              <input className="input" value={store.city} onChange={e => setStore(s => ({ ...s, city: e.target.value }))} />
            </div>
          </div>
          <button onClick={saveStore} disabled={saving} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Salva Negozio</button>
        </div>

        {/* Formula Bonus */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h3>Configurazione Bonus Dipendenti</h3><SavedBadge section="bonus" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div className="input-group">
              <label className="input-label">Commissione vendite (%)</label>
              <input className="input" type="number" min="0" max="100" step="0.1" value={(bonus.sales_commission_pct * 100).toFixed(1)} onChange={e => setBonus(b => ({ ...b, sales_commission_pct: parseFloat(e.target.value) / 100 || 0 }))} />
            </div>
            <div className="input-group">
              <label className="input-label">Bonus per turno qualificante ()</label>
              <input className="input" type="number" min="0" step="0.5" value={bonus.hours_bonus_amount} onChange={e => setBonus(b => ({ ...b, hours_bonus_amount: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="input-group">
              <label className="input-label">Soglia avg vendita / cliente ()</label>
              <input className="input" type="number" min="0" step="1" value={bonus.avg_sale_threshold} onChange={e => setBonus(b => ({ ...b, avg_sale_threshold: parseFloat(e.target.value) || 0 }))} />
            </div>
          </div>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-md)', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
            Bonus = (vendite  {(bonus.sales_commission_pct * 100).toFixed(1)}%) + (turni_qualificanti  {bonus.hours_bonus_amount})
          </div>
          <button onClick={saveBonus} disabled={saving} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Salva Bonus</button>
        </div>

      </div>
    </div>
  )
}

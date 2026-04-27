'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt } from '@/lib/utils'

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [storeId, setStoreId] = useState<string | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [store, setStore] = useState({ name: '', address: '', city: '' })
  const [brand, setBrand] = useState({ brand_name: '', logo_letter: '', primary_color: '#22C55E', piva: '', receipt_header: '', receipt_footer: 'Grazie per il tuo acquisto!' })
  const [brandId, setBrandId] = useState<string | null>(null)
  const [cfg, setCfg] = useState({ fcu_default: 200, morning_shift_start: '08:00', morning_shift_end: '14:00', evening_shift_start: '14:00', evening_shift_end: '22:00', stock_alert_threshold: 5, discount_notify_pct: 15, punctuality_tolerance_min: 5 })
  const [cfgId, setCfgId] = useState<string | null>(null)
  const [bonus, setBonus] = useState({ sales_commission_pct: 0.01, hours_bonus_amount: 5, hours_bonus_threshold: 8, avg_sale_threshold: 40 })
  const [bonusId, setBonusId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')
  const [loading, setLoading] = useState(true)
  const [shopify, setShopify] = useState({ shopify_domain: '', access_token: '', sync_enabled: false })
  const [shopifyId, setShopifyId] = useState<string | null>(null)

  // Tablet account
  const [tabletAccount, setTabletAccount] = useState<any>(null)
  const [tabletPw, setTabletPw] = useState('')
  const [tabletSaving, setTabletSaving] = useState(false)

  // Multistore
  const [stores, setStores] = useState<any[]>([])
  const [showAddStore, setShowAddStore] = useState(false)
  const [storeForm, setStoreForm] = useState({ name: '', city: '', address: '' })

  // Employee feature config (on/off + sub-settings)
  const [empCfg, setEmpCfg] = useState<Record<string, any>>({
    pos: { enabled: true, max_discount_pct: 15, allow_returns: true, allow_promo_codes: true, require_customer_name: false, show_cost_price: false },
    shopify: { enabled: true, can_fulfill: true, can_see_revenue: false, show_customer_contact: true },
    fidelity: { enabled: true, can_create: true, can_edit: false, can_delete: false, points_per_euro: 1 },
    inventory: { enabled: true, require_daily: false, max_attempts: 3, hide_system_qty: true, require_photo: false },
    stock: { enabled: true, max_qty_per_reload: 100, require_approval: false },
    transfers: { enabled: true, can_initiate: true, require_approval: true, max_qty: 50 },
    expenses: { enabled: true, max_amount: 100, require_receipt_photo: true, require_description: true, categories: 'Pulizia,Forniture,Trasporto,Altro' },
    maintenance: { enabled: true, require_photos: true, require_daily: true, checklist_items: 'Pulizia,Vetrina,Cassa,Bagno,Esterno' },
    photos: { enabled: true, require_before_close: false, max_daily: 10 },
    vending: { enabled: true, can_reload: true, can_collect: true },
    ai: { enabled: true, can_access_sales_data: false, can_access_inventory: true },
    calendar: { enabled: true, max_days_month: 3, advance_notice_days: 7 },
    checkout: { enabled: true, require_reason: false },
  })
  const [empCfgId, setEmpCfgId] = useState<string | null>(null)
  const [expandedFeat, setExpandedFeat] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<'general' | 'employee' | 'shopify'>('general')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('store_id, role, stores(organization_id)').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }
    setStoreId(profile.store_id)
    const oid = (profile.stores as any)?.organization_id
    setOrgId(oid)

    const [{ data: storeData }, { data: brandData }, { data: cfgData }, { data: bonusData }] = await Promise.all([
      supabase.from('stores').select('*').eq('id', profile.store_id).single(),
      supabase.from('brand_config').select('*').eq('store_id', profile.store_id).single(),
      supabase.from('store_config').select('*').eq('store_id', profile.store_id).single(),
      supabase.from('bonus_config').select('*').eq('store_id', profile.store_id).single(),
    ])

    if (storeData) setStore({ name: storeData.name, address: storeData.address ?? '', city: storeData.city ?? '' })
    if (brandData) { setBrand({ brand_name: brandData.brand_name, logo_letter: brandData.logo_letter, primary_color: brandData.primary_color, piva: brandData.piva ?? '', receipt_header: brandData.receipt_header ?? '', receipt_footer: brandData.receipt_footer ?? '' }); setBrandId(brandData.id) }
    if (cfgData) { setCfg({ fcu_default: cfgData.fcu_default, morning_shift_start: cfgData.morning_shift_start, morning_shift_end: cfgData.morning_shift_end, evening_shift_start: cfgData.evening_shift_start, evening_shift_end: cfgData.evening_shift_end, stock_alert_threshold: cfgData.stock_alert_threshold, discount_notify_pct: cfgData.discount_notify_pct, punctuality_tolerance_min: cfgData.punctuality_tolerance_min ?? 5 }); setCfgId(cfgData.id) }
    if (bonusData) { setBonus({ sales_commission_pct: bonusData.sales_commission_pct, hours_bonus_amount: bonusData.hours_bonus_amount, hours_bonus_threshold: bonusData.hours_bonus_threshold, avg_sale_threshold: bonusData.avg_sale_threshold }); setBonusId(bonusData.id) }

    // Shopify
    const { data: shopifyData } = await supabase.from('shopify_config').select('*').eq('store_id', profile.store_id).single()
    if (shopifyData) { setShopify({ shopify_domain: shopifyData.shopify_domain, access_token: shopifyData.access_token ?? '', sync_enabled: shopifyData.sync_enabled }); setShopifyId(shopifyData.id) }

    // Multistore
    if (oid) {
      const { data: storesData } = await supabase.from('stores').select('*').eq('organization_id', oid)
      setStores(storesData ?? [])
    }

    // Employee feature config
    const { data: empFeat } = await supabase.from('employee_features').select('*').eq('store_id', profile.store_id).single()
    if (empFeat) {
      setEmpCfgId(empFeat.id)
      if (empFeat.config) {
        setEmpCfg(prev => ({ ...prev, ...empFeat.config }))
      }
    }

    // Tablet account (store account linked to this store)
    const { data: tabletUser } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('store_id', profile.store_id)
      .like('full_name', '[STORE]%')
      .limit(1)
      .single()
    if (tabletUser) {
      // If email is stored on users table, use it. Otherwise try fetching via API.
      let email = tabletUser.email
      if (!email) {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          const res = await fetch('/api/get-user-email', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: tabletUser.id }),
          })
          if (res.ok) { const json = await res.json(); email = json.email }
        } catch {}
      }
      setTabletAccount({ id: tabletUser.id, full_name: tabletUser.full_name, email })
    } else {
      setTabletAccount(null)
    }

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
  async function addNewStore() {
    if (!orgId || !storeForm.name) return
    setSaving(true)
    const { data: st } = await supabase.from('stores').insert({ name: storeForm.name, city: storeForm.city || null, address: storeForm.address || null, organization_id: orgId }).select('id').single()
    if (st) {
      await Promise.all([
        supabase.from('brand_config').insert({ store_id: st.id, brand_name: brand.brand_name || 'BrainWare', logo_letter: brand.logo_letter || 'B', primary_color: brand.primary_color }),
        supabase.from('store_config').insert({ store_id: st.id }),
        supabase.from('bonus_config').insert({ store_id: st.id }),
      ])
    }
    setShowAddStore(false); setStoreForm({ name: '', city: '', address: '' }); setSaving(false)
    loadData()
  }
  async function saveEmpFeatures() {
    if (!storeId) return; setSaving(true)
    const payload = { config: empCfg }
    if (empCfgId) {
      await supabase.from('employee_features').update(payload).eq('id', empCfgId)
    } else {
      const { data } = await supabase.from('employee_features').insert({ store_id: storeId, ...payload }).select('id').single()
      if (data) setEmpCfgId(data.id)
    }
    showSaved('empfeat'); setSaving(false)
  }

  function updateEmpCfg(section: string, field: string, value: any) {
    setEmpCfg(prev => ({ ...prev, [section]: { ...prev[section], [field]: value } }))
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>Caricamento...</div>

  const SavedBadge = ({ section }: { section: string }) => saved === section
    ? <span className="badge badge-success" style={{ marginLeft: 8 }}>✅ Salvato</span> : null

  const TABS = [
    { key: 'general', icon: '⚙️', label: 'Generale' },
    { key: 'employee', icon: '👥', label: 'Dipendente' },
    { key: 'shopify', icon: '🛍️', label: 'Shopify' },
  ] as const

  // Toggle UI helper
  const Toggle = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
    <div onClick={onClick} style={{ width:44, height:24, borderRadius:12, padding:2, background: on ? 'var(--brand-primary)' : 'var(--border-default)', cursor:'pointer', transition:'background 0.2s', display:'flex', alignItems:'center', flexShrink:0 }}>
      <div style={{ width:20, height:20, borderRadius:'50%', background:'white', transition:'transform 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)', transform: on ? 'translateX(20px)' : 'translateX(0)' }} />
    </div>
  )

  const FEATURES: { key: string; icon: string; label: string; desc: string; fields: { field: string; label: string; type: 'toggle' | 'number' | 'text'; placeholder?: string }[] }[] = [
    { key: 'pos', icon: '🛒', label: 'POS / Vendita', desc: 'Registrare vendite e gestire il carrello', fields: [
      { field: 'max_discount_pct', label: 'Sconto massimo (%)', type: 'number' },
      { field: 'allow_returns', label: 'Permetti resi', type: 'toggle' },
      { field: 'allow_promo_codes', label: 'Permetti codici promo', type: 'toggle' },
      { field: 'require_customer_name', label: 'Richiedi nome cliente', type: 'toggle' },
      { field: 'show_cost_price', label: 'Mostra prezzo di costo', type: 'toggle' },
    ]},
    { key: 'shopify', icon: '📦', label: 'Ordini Shopify', desc: 'Gestione ordini online', fields: [
      { field: 'can_fulfill', label: 'Può evadere ordini', type: 'toggle' },
      { field: 'can_see_revenue', label: 'Può vedere revenue totale', type: 'toggle' },
      { field: 'show_customer_contact', label: 'Mostra contatti cliente', type: 'toggle' },
    ]},
    { key: 'fidelity', icon: '💳', label: 'Fidelity Card', desc: 'Gestione carte fedeltà', fields: [
      { field: 'can_create', label: 'Può creare nuove card', type: 'toggle' },
      { field: 'can_edit', label: 'Può modificare dati cliente', type: 'toggle' },
      { field: 'can_delete', label: 'Può eliminare card', type: 'toggle' },
      { field: 'points_per_euro', label: 'Punti per ogni €1', type: 'number' },
    ]},
    { key: 'inventory', icon: '📊', label: 'Conteggio Inventario', desc: 'Inventario e conteggio prodotti', fields: [
      { field: 'require_daily', label: 'Conteggio giornaliero obbligatorio', type: 'toggle' },
      { field: 'max_attempts', label: 'Max tentativi prima di escalation', type: 'number' },
      { field: 'hide_system_qty', label: 'Nascondi qty sistema (blind count)', type: 'toggle' },
      { field: 'require_photo', label: 'Richiedi foto conteggio', type: 'toggle' },
    ]},
    { key: 'stock', icon: '📦', label: 'Ricarica Stock', desc: 'Aggiungere quantità ai prodotti', fields: [
      { field: 'max_qty_per_reload', label: 'Qty max per ricarica', type: 'number' },
      { field: 'require_approval', label: 'Richiedi approvazione owner', type: 'toggle' },
    ]},
    { key: 'transfers', icon: '🔄', label: 'Trasferimenti', desc: 'Trasferire prodotti tra store', fields: [
      { field: 'can_initiate', label: 'Può avviare trasferimenti', type: 'toggle' },
      { field: 'require_approval', label: 'Richiedi approvazione', type: 'toggle' },
      { field: 'max_qty', label: 'Qty max per trasferimento', type: 'number' },
    ]},
    { key: 'expenses', icon: '💸', label: 'Spese', desc: 'Registrare spese durante il turno', fields: [
      { field: 'max_amount', label: 'Importo max senza approvazione (€)', type: 'number' },
      { field: 'require_receipt_photo', label: 'Richiedi foto ricevuta', type: 'toggle' },
      { field: 'require_description', label: 'Richiedi descrizione', type: 'toggle' },
      { field: 'categories', label: 'Categorie spesa (separate da virgola)', type: 'text', placeholder: 'Pulizia,Forniture,Trasporto,Altro' },
    ]},
    { key: 'maintenance', icon: '🔧', label: 'Manutenzione', desc: 'Checklist e manutenzione', fields: [
      { field: 'require_photos', label: 'Richiedi foto per ogni punto', type: 'toggle' },
      { field: 'require_daily', label: 'Checklist giornaliera obbligatoria', type: 'toggle' },
      { field: 'checklist_items', label: 'Voci checklist (separate da virgola)', type: 'text', placeholder: 'Pulizia,Vetrina,Cassa,Bagno,Esterno' },
    ]},
    { key: 'photos', icon: '📷', label: 'Foto Registro', desc: 'Upload foto registro cassa', fields: [
      { field: 'require_before_close', label: 'Obbligatoria prima di chiudere turno', type: 'toggle' },
      { field: 'max_daily', label: 'Max foto giornaliere', type: 'number' },
    ]},
    { key: 'vending', icon: '🏧', label: 'Vending Machine', desc: 'Gestione macchine H24', fields: [
      { field: 'can_reload', label: 'Può ricaricare macchine', type: 'toggle' },
      { field: 'can_collect', label: 'Può ritirare incasso', type: 'toggle' },
    ]},
    { key: 'ai', icon: '🤖', label: 'Assistente AI', desc: 'Accesso all\'assistente AI', fields: [
      { field: 'can_access_sales_data', label: 'Accesso a dati vendite', type: 'toggle' },
      { field: 'can_access_inventory', label: 'Accesso a dati inventario', type: 'toggle' },
    ]},
    { key: 'calendar', icon: '📅', label: 'Giorni Liberi', desc: 'Richiesta permessi e ferie', fields: [
      { field: 'max_days_month', label: 'Max giorni liberi al mese', type: 'number' },
      { field: 'advance_notice_days', label: 'Preavviso minimo (giorni)', type: 'number' },
    ]},
    { key: 'checkout', icon: '🚪', label: 'Check Out', desc: 'Uscire senza chiudere il turno', fields: [
      { field: 'require_reason', label: 'Richiedi motivazione', type: 'toggle' },
    ]},
  ]

  return (
    <div>
      <h2 style={{ marginBottom: 'var(--space-lg)' }}>⚙️ Impostazioni</h2>

      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 'var(--space-xl)', background: 'var(--bg-surface)', borderRadius: 12, padding: 4 }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 10, border: 'none',
              background: activeTab === tab.key ? 'var(--bg-primary)' : 'transparent',
              fontWeight: activeTab === tab.key ? 700 : 400,
              color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: 'pointer', fontSize: 13, transition: 'all 0.15s',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════ TAB: GENERALE ═══════════════ */}
      {activeTab === 'general' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
          {/* Branding */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <h3>🎨 Branding</h3><SavedBadge section="brand" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <div className="input-group"><label className="input-label">Nome Brand</label><input className="input" value={brand.brand_name} onChange={e => setBrand(b => ({ ...b, brand_name: e.target.value }))} /></div>
              <div className="input-group"><label className="input-label">Lettera Logo</label><input className="input" maxLength={1} value={brand.logo_letter} onChange={e => setBrand(b => ({ ...b, logo_letter: e.target.value }))} /></div>
              <div className="input-group">
                <label className="input-label">Colore Primario</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="color" value={brand.primary_color} onChange={e => setBrand(b => ({ ...b, primary_color: e.target.value }))} style={{ width: 44, height: 44, border: 'none', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
                  <input className="input" value={brand.primary_color} onChange={e => setBrand(b => ({ ...b, primary_color: e.target.value }))} style={{ flex: 1 }} />
                </div>
              </div>
              <div className="input-group"><label className="input-label">P.IVA</label><input className="input" placeholder="IT12345678901" value={brand.piva} onChange={e => setBrand(b => ({ ...b, piva: e.target.value }))} /></div>
            </div>
            <div className="input-group"><label className="input-label">Intestazione Scontrino</label><input className="input" value={brand.receipt_header} onChange={e => setBrand(b => ({ ...b, receipt_header: e.target.value }))} /></div>
            <div className="input-group"><label className="input-label">Footer Scontrino</label><input className="input" value={brand.receipt_footer} onChange={e => setBrand(b => ({ ...b, receipt_footer: e.target.value }))} /></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
              <button onClick={saveBrand} disabled={saving} className="btn btn-primary">Salva Branding</button>
              <div style={{ padding: '10px 16px', background: brand.primary_color + '18', border: `2px solid ${brand.primary_color}`, borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: brand.primary_color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14 }}>{brand.logo_letter || 'M'}</div>
                <span style={{ fontWeight: 700, color: brand.primary_color }}>{brand.brand_name || 'Brand'}</span>
              </div>
            </div>
          </div>

          {/* Turni & FCU */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}><h3>🕐 Turni & FCU</h3><SavedBadge section="config" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <div className="input-group"><label className="input-label">FCU Desiderato (€)</label><input className="input" type="number" min="0" step="10" value={cfg.fcu_default} onChange={e => setCfg(c => ({ ...c, fcu_default: parseFloat(e.target.value) || 0 }))} /></div>
              <div />
              <div className="input-group"><label className="input-label">Inizio Mattina</label><input className="input" type="time" value={cfg.morning_shift_start} onChange={e => setCfg(c => ({ ...c, morning_shift_start: e.target.value }))} /></div>
              <div className="input-group"><label className="input-label">Fine Mattina</label><input className="input" type="time" value={cfg.morning_shift_end} onChange={e => setCfg(c => ({ ...c, morning_shift_end: e.target.value }))} /></div>
              <div className="input-group"><label className="input-label">Inizio Sera</label><input className="input" type="time" value={cfg.evening_shift_start} onChange={e => setCfg(c => ({ ...c, evening_shift_start: e.target.value }))} /></div>
              <div className="input-group"><label className="input-label">Fine Sera</label><input className="input" type="time" value={cfg.evening_shift_end} onChange={e => setCfg(c => ({ ...c, evening_shift_end: e.target.value }))} /></div>
              <div className="input-group"><label className="input-label">Tolleranza Puntualità (min)</label><input className="input" type="number" min="0" max="30" value={cfg.punctuality_tolerance_min} onChange={e => setCfg(c => ({ ...c, punctuality_tolerance_min: parseInt(e.target.value) || 0 }))} /></div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}>⏰ Il dipendente è "puntuale" se apre il turno entro {cfg.punctuality_tolerance_min} min dall'orario previsto</div>
            </div>
            <h4>Soglie</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <div className="input-group"><label className="input-label">Alert Inventario (qty minima)</label><input className="input" type="number" min="0" value={cfg.stock_alert_threshold} onChange={e => setCfg(c => ({ ...c, stock_alert_threshold: parseInt(e.target.value) || 0 }))} /></div>
              <div className="input-group"><label className="input-label">Soglia Sconto Notifica (%)</label><input className="input" type="number" min="0" max="100" value={cfg.discount_notify_pct} onChange={e => setCfg(c => ({ ...c, discount_notify_pct: parseFloat(e.target.value) || 0 }))} /></div>
            </div>
            <button onClick={saveConfig} disabled={saving} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Salva Configurazione</button>
          </div>

          {/* Info Negozio */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}><h3>🏪 Informazioni Negozio</h3><SavedBadge section="store" /></div>
            <div className="input-group"><label className="input-label">Nome negozio</label><input className="input" value={store.name} onChange={e => setStore(s => ({ ...s, name: e.target.value }))} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-md)' }}>
              <div className="input-group"><label className="input-label">Indirizzo</label><input className="input" value={store.address} onChange={e => setStore(s => ({ ...s, address: e.target.value }))} /></div>
              <div className="input-group"><label className="input-label">Città</label><input className="input" value={store.city} onChange={e => setStore(s => ({ ...s, city: e.target.value }))} /></div>
            </div>
            <button onClick={saveStore} disabled={saving} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Salva Negozio</button>
          </div>

          {/* Tablet Account */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <h3>📱 Account Tablet</h3>
              <SavedBadge section="tablet" />
            </div>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-md)', fontSize: 13, color: 'var(--text-secondary)' }}>
              💡 L'account tablet è quello usato dall'iPad del negozio per accedere. I dipendenti si identificheranno con il loro PIN dopo il login.
            </div>
            {tabletAccount ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                  <div className="input-group">
                    <label className="input-label">Email Tablet</label>
                    <div style={{ padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 600, border: '1px solid var(--border-subtle)' }}>
                      {tabletAccount.email || tabletAccount.full_name}
                    </div>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Nuova Password (opzionale)</label>
                    <input className="input" type="password" placeholder="Lascia vuoto per non cambiare" value={tabletPw} onChange={e => setTabletPw(e.target.value)} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} />
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Account configurato — il tablet può loggarsi</span>
                </div>
                {tabletPw.length > 0 && (
                  <button
                    className="btn btn-primary"
                    style={{ alignSelf: 'flex-start' }}
                    disabled={tabletSaving || tabletPw.length < 6}
                    onClick={async () => {
                      setTabletSaving(true)
                      try {
                        const headers = await getAuthHeader()
                        const res = await fetch('/api/update-password', {
                          method: 'POST', headers,
                          body: JSON.stringify({ userId: tabletAccount.id, password: tabletPw }),
                        })
                        if (res.ok) { showSaved('tablet'); setTabletPw('') }
                      } catch {}
                      setTabletSaving(false)
                    }}
                  >
                    {tabletSaving ? 'Aggiornamento...' : '🔑 Aggiorna Password'}
                  </button>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 'var(--space-lg)', color: 'var(--text-tertiary)' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📱</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Nessun account tablet configurato</div>
                <div style={{ fontSize: 12 }}>Vai su <strong>Gestione Dipendenti → Account Store</strong> per crearne uno</div>
              </div>
            )}
          </div>

          {/* Bonus */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}><h3>💰 Bonus Dipendenti</h3><SavedBadge section="bonus" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <div className="input-group"><label className="input-label">Commissione vendite (%)</label><input className="input" type="number" min="0" max="100" step="0.1" value={(bonus.sales_commission_pct * 100).toFixed(1)} onChange={e => setBonus(b => ({ ...b, sales_commission_pct: parseFloat(e.target.value) / 100 || 0 }))} /></div>
              <div className="input-group"><label className="input-label">Bonus per turno (€)</label><input className="input" type="number" min="0" step="0.5" value={bonus.hours_bonus_amount} onChange={e => setBonus(b => ({ ...b, hours_bonus_amount: parseFloat(e.target.value) || 0 }))} /></div>
              <div className="input-group"><label className="input-label">Soglia avg vendita (€)</label><input className="input" type="number" min="0" value={bonus.avg_sale_threshold} onChange={e => setBonus(b => ({ ...b, avg_sale_threshold: parseFloat(e.target.value) || 0 }))} /></div>
            </div>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-md)', fontSize: 13, color: 'var(--text-secondary)' }}>
              Bonus = (vendite × {(bonus.sales_commission_pct * 100).toFixed(1)}%) + (turni × €{bonus.hours_bonus_amount})
            </div>
            <button onClick={saveBonus} disabled={saving} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Salva Bonus</button>
          </div>
        </div>
      )}


      {/* ═══════════════ TAB: DIPENDENTE ═══════════════ */}
      {activeTab === 'employee' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3>👥 Funzioni Dipendente</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>
                Configura ogni funzionalità accessibile ai dipendenti
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SavedBadge section="empfeat" />
              <button onClick={saveEmpFeatures} disabled={saving} className="btn btn-primary" style={{ fontSize: 13 }}>
                {saving ? 'Salvataggio...' : '💾 Salva Tutto'}
              </button>
            </div>
          </div>

          {FEATURES.map(feat => {
            const section = empCfg[feat.key] || {}
            const isEnabled = section.enabled !== false
            const isExpanded = expandedFeat === feat.key
            return (
              <div key={feat.key} className="card" style={{ padding: 0, overflow: 'hidden', border: isEnabled ? '1px solid var(--brand-primary)25' : '1px solid var(--border-subtle)', opacity: isEnabled ? 1 : 0.7, transition: 'all 0.2s' }}>
                {/* Header row */}
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', cursor: 'pointer' }}
                  onClick={() => setExpandedFeat(isExpanded ? null : feat.key)}
                >
                  <span style={{ fontSize: 24, width: 36, textAlign: 'center' }}>{feat.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{feat.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 1 }}>{feat.desc}</div>
                  </div>
                  <Toggle on={isEnabled} onClick={() => { updateEmpCfg(feat.key, 'enabled', !isEnabled) }} />
                  <span style={{ fontSize: 14, color: 'var(--text-tertiary)', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
                </div>

                {/* Expanded sub-config */}
                {isExpanded && isEnabled && (
                  <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '16px 18px', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {feat.fields.map(f => (
                      <div key={f.field} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                        <label style={{ fontSize: 14, color: 'var(--text-secondary)', flex: 1 }}>{f.label}</label>
                        {f.type === 'toggle' && (
                          <Toggle on={section[f.field] ?? false} onClick={() => updateEmpCfg(feat.key, f.field, !(section[f.field] ?? false))} />
                        )}
                        {f.type === 'number' && (
                          <input
                            className="input"
                            type="number"
                            min="0"
                            style={{ width: 90, textAlign: 'center', padding: '6px 10px', fontSize: 14 }}
                            value={section[f.field] ?? 0}
                            onChange={e => updateEmpCfg(feat.key, f.field, parseFloat(e.target.value) || 0)}
                          />
                        )}
                        {f.type === 'text' && (
                          <input
                            className="input"
                            style={{ maxWidth: 260, padding: '6px 10px', fontSize: 13 }}
                            placeholder={f.placeholder}
                            value={section[f.field] ?? ''}
                            onChange={e => updateEmpCfg(feat.key, f.field, e.target.value)}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {isExpanded && !isEnabled && (
                  <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '16px 18px', background: 'var(--bg-surface)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                    ⚠️ Attiva la funzione per configurare i parametri
                  </div>
                )}
              </div>
            )
          })}

          <div style={{ background: 'var(--bg-surface)', borderRadius: 12, padding: '14px 18px', fontSize: 13, color: 'var(--text-secondary)' }}>
            💡 Le funzioni disattivate non appariranno nella dashboard del dipendente. Clicca su ogni sezione per espandere le opzioni avanzate.
          </div>
        </div>
      )}

      {/* ═══════════════ TAB: SHOPIFY ═══════════════ */}
      {activeTab === 'shopify' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <h3>🛍️ Integrazione Shopify</h3><SavedBadge section="shopify" />
            </div>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
              Collega il tuo Shopify store per visualizzare ordini e gestire le spedizioni direttamente da BrainWare.
            </div>
            <div className="input-group">
              <label className="input-label">Dominio Shopify Store</label>
              <input className="input" placeholder="mio-negozio.myshopify.com" value={shopify.shopify_domain} onChange={e => setShopify(s => ({ ...s, shopify_domain: e.target.value.replace('https://', '').replace('/', '') }))} />
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Solo il dominio, es: mamamarycannabis.myshopify.com</div>
            </div>
            <div className="input-group">
              <label className="input-label">Access Token (Admin API)</label>
              <input className="input" type="password" placeholder="shpat_xxxxxxxxxxxxxxxxxxxx" value={shopify.access_token} onChange={e => setShopify(s => ({ ...s, access_token: e.target.value }))} />
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                Shopify Admin → Settings → Apps → Develop apps → Create app → Admin API access scopes (orders: read_orders, write_orders)
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="shopify-sync" checked={shopify.sync_enabled} onChange={e => setShopify(s => ({ ...s, sync_enabled: e.target.checked }))} />
              <label htmlFor="shopify-sync" style={{ fontSize: 13, cursor: 'pointer' }}>Sincronizzazione automatica attiva</label>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={async () => {
                if (!storeId || !shopify.shopify_domain) return; setSaving(true)
                if (shopifyId) { await supabase.from('shopify_config').update(shopify).eq('id', shopifyId) }
                else { const { data } = await supabase.from('shopify_config').insert({ store_id: storeId, ...shopify }).select('id').single(); if (data) setShopifyId(data.id) }
                showSaved('shopify'); setSaving(false)
              }} disabled={saving || !shopify.shopify_domain} className="btn btn-primary">Salva Shopify</button>
              {shopifyId && <button onClick={() => router.push('/owner/shopify')} className="btn btn-secondary">👁️ Vedi Ordini</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

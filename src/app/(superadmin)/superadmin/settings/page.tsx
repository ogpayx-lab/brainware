'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const SA_CARD = { background: '#1E293B', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 24 } as React.CSSProperties

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!value)} style={{ width: 44, height: 24, borderRadius: 12, background: value ? '#22C55E' : 'rgba(255,255,255,0.15)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 3, left: value ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
    </div>
  )
}

function PolicyRow({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div>
        <div style={{ color: 'white', fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{label}</div>
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>{desc}</div>
      </div>
      <Toggle value={value} onChange={onChange} />
    </div>
  )
}

export default function SuperAdminSettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [cfg, setCfg] = useState({
    owner_can_edit_settings: true,
    max_discount_pct: 25,
    force_daily_inventory: false,
    transfers_enabled: true,
    online_sales_enabled: true,
    hide_system_inventory_qty: false,
    fidelity_enabled_default: true,
    fidelity_points_per_euro: 1,
    fidelity_target_per_day: 5,
    inventory_max_attempts: 2,
    delivery_radius_km: 15,
    delivery_cost_default: 5.00,
    long_distance_cost_default: 9.90,
    fcu_default: 50,
    expense_approval_threshold: 50,
  })
  const [activeTab, setActiveTab] = useState<'global' | 'fidelity' | 'online' | 'inventory' | 'objectives'>('global')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [cfgId, setCfgId] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/superadmin/login'); return }
    const { data } = await supabase.from('platform_settings').select('*').limit(1).single()
    if (data) { setCfg({ ...cfg, ...data }); setCfgId(data.id) }
    setLoading(false)
  }

  async function save() {
    setSaving(true)
    if (cfgId) await supabase.from('platform_settings').update({ ...cfg, updated_at: new Date().toISOString() }).eq('id', cfgId)
    setSaved(true); setTimeout(() => setSaved(false), 2000); setSaving(false)
  }

  const input = (key: string, val: number | string, step?: string) => (
    <input type="number" value={val} step={step ?? '1'} onChange={e => setCfg(c => ({ ...c, [key]: parseFloat(e.target.value) || 0 }))}
      style={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 10px', fontSize: 13, color: 'white', outline: 'none', width: 80, textAlign: 'right' }} />
  )

  const TABS = [
    { key: 'global', label: 'Globale' },
    { key: 'fidelity', label: 'Fidelity' },
    { key: 'online', label: 'Online & Trasf.' },
    { key: 'inventory', label: 'Inventario' },
    { key: 'objectives', label: 'Obiettivi' },
  ]

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><div style={{ color: 'rgba(255,255,255,0.4)' }}>Caricamento...</div></div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ color: 'white', fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700 }}>Impostazioni Piattaforma</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 4 }}>Policy e default globali applicati a tutti gli owner</p>
        </div>
        <button onClick={save} disabled={saving}
          style={{ padding: '8px 20px', background: saved ? '#166534' : '#22C55E', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
          {saved ? ' Salvato' : saving ? 'Salvataggio...' : 'Salva Modifiche'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 4 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)', background: activeTab === t.key ? '#1E293B' : 'transparent', color: activeTab === t.key ? 'white' : 'rgba(255,255,255,0.4)', fontWeight: activeTab === t.key ? 600 : 400 }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'global' && (
        <div style={SA_CARD}>
          <h4 style={{ color: 'white', fontWeight: 700, marginBottom: 4 }}>Policy Globali</h4>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginBottom: 20 }}>Si applicano a tutti gli owner e non possono essere modificate da loro</p>
          <PolicyRow label="Owner puo modificare Impostazioni" desc="Permetti agli owner di personalizzare le config del proprio negozio" value={cfg.owner_can_edit_settings} onChange={v => setCfg(c => ({ ...c, owner_can_edit_settings: v }))} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div>
              <div style={{ color: 'white', fontSize: 14, fontWeight: 500, marginBottom: 2 }}>Blocco Sconto Massimo Globale</div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>Nessun owner puo superare questo limite di sconto</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{input('max_discount_pct', cfg.max_discount_pct)}<span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>%</span></div>
          </div>
          <PolicyRow label="Forza Inventario Giornaliero" desc="Obbliga tutti i negozi al conteggio inventario quotidiano" value={cfg.force_daily_inventory} onChange={v => setCfg(c => ({ ...c, force_daily_inventory: v }))} />
          <PolicyRow label="Abilita Trasferimenti tra Negozi" desc="I dipendenti possono movimentare inventario tra store" value={cfg.transfers_enabled} onChange={v => setCfg(c => ({ ...c, transfers_enabled: v }))} />
          <PolicyRow label="Abilita Vendite Online" desc="Delivery e Long Distance attivi per tutti gli store" value={cfg.online_sales_enabled} onChange={v => setCfg(c => ({ ...c, online_sales_enabled: v }))} />
          <PolicyRow label="Nascondi Valore Sistema Inventario" desc="Il dipendente non vede la quantita attesa del sistema durante il conteggio" value={cfg.hide_system_inventory_qty} onChange={v => setCfg(c => ({ ...c, hide_system_inventory_qty: v }))} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0' }}>
            <div>
              <div style={{ color: 'white', fontSize: 14, fontWeight: 500, marginBottom: 2 }}>Limite Spesa Singola ()</div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>Sopra questa soglia serve approvazione owner</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}></span>{input('expense_approval_threshold', cfg.expense_approval_threshold, '5')}</div>
          </div>
        </div>
      )}

      {activeTab === 'fidelity' && (
        <div style={SA_CARD}>
          <h4 style={{ color: 'white', fontWeight: 700, marginBottom: 20 }}>Fidelity Card  Default Globale</h4>
          <PolicyRow label="Fidelity Card Abilitata" desc="Default attivo per tutti i nuovi negozi" value={cfg.fidelity_enabled_default} onChange={v => setCfg(c => ({ ...c, fidelity_enabled_default: v }))} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div><div style={{ color: 'white', fontSize: 14, fontWeight: 500 }}>Punti per 1 Speso</div><div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>Valore base applicato a tutti gli store</div></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{input('fidelity_points_per_euro', cfg.fidelity_points_per_euro, '0.1')}<span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>pt/</span></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0' }}>
            <div><div style={{ color: 'white', fontSize: 14, fontWeight: 500 }}>Target Card/Giorno Default</div><div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>Obiettivo giornaliero creazione fidelity</div></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{input('fidelity_target_per_day', cfg.fidelity_target_per_day)}<span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>card/gg</span></div>
          </div>
        </div>
      )}

      {activeTab === 'online' && (
        <div style={SA_CARD}>
          <h4 style={{ color: 'white', fontWeight: 700, marginBottom: 20 }}>Default Vendite Online & Trasferimenti</h4>
          {[
            { label: 'Raggio Delivery Default (km)', key: 'delivery_radius_km', unit: 'km' },
            { label: 'Costo Delivery Default ()', key: 'delivery_cost_default', unit: '', step: '0.5' },
            { label: 'Costo Long Distance Default ()', key: 'long_distance_cost_default', unit: '', step: '0.5' },
          ].map(f => (
            <div key={f.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ color: 'white', fontSize: 14, fontWeight: 500 }}>{f.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{input(f.key, (cfg as any)[f.key], f.step)}<span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{f.unit}</span></div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'inventory' && (
        <div style={SA_CARD}>
          <h4 style={{ color: 'white', fontWeight: 700, marginBottom: 20 }}>Default Conteggio Inventario</h4>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div><div style={{ color: 'white', fontSize: 14, fontWeight: 500 }}>Tentativi Default</div><div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>Max tentativi conteggio per prodotto prima di escalation</div></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{input('inventory_max_attempts', cfg.inventory_max_attempts)}<span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>tentativi</span></div>
          </div>
          <PolicyRow label="QR Scan Abilitato" desc="Default per nuovi negozi" value={false} onChange={() => {}} />
          <PolicyRow label="Assistenza Auto dopo Errori" desc="Attiva richiesta assistenza automatica dopo tentativi esauriti" value={true} onChange={() => {}} />
        </div>
      )}

      {activeTab === 'objectives' && (
        <div style={SA_CARD}>
          <h4 style={{ color: 'white', fontWeight: 700, marginBottom: 20 }}>Default Turni & Obiettivi</h4>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div><div style={{ color: 'white', fontSize: 14, fontWeight: 500 }}>FCU Default ()</div><div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>Fondo cassa uscita suggerito default</div></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}></span>{input('fcu_default', cfg.fcu_default, '10')}</div>
          </div>
          <PolicyRow label="Stampa Ricevuta Turno" desc="Permetti stampa/email a fine turno" value={true} onChange={() => {}} />
          <PolicyRow label="Foto Ricevuta Spese Obbligatoria" desc="Il dipendente deve allegare scontrino alle spese" value={false} onChange={() => {}} />
        </div>
      )}
    </div>
  )
}

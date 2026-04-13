'use client'

import { useState, useEffect } from 'react'

const SCENES = [
  { id: 'dashboard', label: 'Dashboard', duration: 10000 },
  { id: 'pos', label: 'POS', duration: 12000 },
  { id: 'inventory', label: 'Inventario', duration: 12000 },
  { id: 'employees', label: 'Dipendenti', duration: 10000 },
  { id: 'ai', label: 'AI Analytics', duration: 11000 },
  { id: 'cta', label: 'CTA', duration: 5000 },
]

export default function DemoShowcase() {
  const [scene, setScene] = useState(0)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const dur = SCENES[scene].duration
    const interval = 50
    let elapsed = 0
    const timer = setInterval(() => {
      elapsed += interval
      setProgress((elapsed / dur) * 100)
      if (elapsed >= dur) {
        setScene(prev => (prev + 1) % SCENES.length)
        setProgress(0)
      }
    }, interval)
    return () => clearInterval(timer)
  }, [scene])

  return (
    <div style={{ background: '#030712', minHeight: '100vh', fontFamily: "'Inter', sans-serif", color: 'white', overflow: 'hidden' }}>
      {/* Scene indicator */}
      <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6, zIndex: 100 }}>
        {SCENES.map((s, i) => (
          <div key={s.id} onClick={() => { setScene(i); setProgress(0); }} style={{ cursor: 'pointer', padding: '6px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600, background: scene === i ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.03)', color: scene === i ? '#22C55E' : '#64748B', border: `1px solid ${scene === i ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.06)'}`, transition: 'all 0.3s' }}>
            {s.label}
          </div>
        ))}
      </div>
      {/* Progress bar */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, background: 'rgba(255,255,255,0.03)', zIndex: 100 }}>
        <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #22C55E, #4ADE80)', transition: 'width 50ms linear', borderRadius: '0 4px 4px 0' }} />
      </div>

      {/* Browser chrome */}
      <div style={{ maxWidth: 1200, margin: '60px auto 0', padding: '0 24px' }}>
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px 20px 0 0', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', background: 'rgba(0,0,0,0.25)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#EF4444' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#F59E0B' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#22C55E' }} />
            </div>
            <div style={{ flex: 1, textAlign: 'center', fontSize: 12, color: '#64748B', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '4px 16px', margin: '0 60px', border: '1px solid rgba(255,255,255,0.04)' }}>
              🔒 app.brainware.io/{SCENES[scene]?.id === 'dashboard' ? 'dashboard' : SCENES[scene]?.id === 'pos' ? 'pos' : SCENES[scene]?.id === 'inventory' ? 'inventory' : SCENES[scene]?.id === 'employees' ? 'employees' : SCENES[scene]?.id === 'ai' ? 'analytics' : 'dashboard'}
            </div>
          </div>

          {/* App body */}
          <div style={{ display: 'flex', minHeight: 600 }}>
            {/* Sidebar */}
            <div style={{ width: 220, borderRight: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.15)', padding: '16px 0', flexShrink: 0 }}>
              <div style={{ padding: '8px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #22C55E, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800 }}>B</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>BrainWare</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>Green Valley Store</div>
                  </div>
                </div>
              </div>
              {[
                { icon: '📊', label: 'Dashboard', id: 'dashboard' },
                { icon: '🛒', label: 'POS', id: 'pos' },
                { icon: '📦', label: 'Inventario', id: 'inventory' },
                { icon: '👥', label: 'Dipendenti', id: 'employees' },
                { icon: '🤖', label: 'AI Analytics', id: 'ai' },
                { icon: '🔔', label: 'Notifiche', id: '' },
                { icon: '⚙️', label: 'Impostazioni', id: '' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', fontSize: 13, color: SCENES[scene]?.id === item.id ? 'white' : '#64748B', background: SCENES[scene]?.id === item.id ? 'rgba(34,197,94,0.1)' : 'transparent', borderRight: SCENES[scene]?.id === item.id ? '2px solid #22C55E' : '2px solid transparent', transition: 'all 0.3s', fontWeight: SCENES[scene]?.id === item.id ? 600 : 400 }}>
                  <span style={{ fontSize: 16 }}>{item.icon}</span> {item.label}
                </div>
              ))}
            </div>

            {/* Main content */}
            <div style={{ flex: 1, padding: 28, overflow: 'auto' }}>
              <div style={{ animation: 'fadeIn 0.5s ease-out' }} key={scene}>

                {/* ═══ DASHBOARD ═══ */}
                {scene === 0 && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
                      <div>
                        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>Buongiorno, Marco 👋</div>
                        <div style={{ fontSize: 14, color: '#64748B', marginTop: 4 }}>Green Valley Store · Milano Centro</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {['Oggi', '7 Giorni', '30 Giorni'].map((p, i) => (
                          <div key={p} style={{ padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: i === 0 ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.03)', color: i === 0 ? '#22C55E' : '#64748B', border: `1px solid ${i === 0 ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)'}` }}>{p}</div>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
                      {[
                        { label: 'Fatturato', val: '€18,420', change: '+24.3%', color: '#22C55E' },
                        { label: 'Ordini', val: '342', change: '+18.7%', color: '#3B82F6' },
                        { label: 'Clienti', val: '1,847', change: '+12.1%', color: '#8B5CF6' },
                        { label: 'Scontrino Medio', val: '€53.80', change: '+8.5%', color: '#F59E0B' },
                      ].map(kpi => (
                        <div key={kpi.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 20 }}>
                          <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 10 }}>{kpi.label}</div>
                          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>{kpi.val}</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: kpi.color, marginTop: 6, background: `${kpi.color}15`, display: 'inline-block', padding: '2px 8px', borderRadius: 6 }}>↑ {kpi.change}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, padding: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                          <div style={{ fontSize: 13, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Andamento Fatturato</div>
                          <div style={{ fontSize: 12, color: '#22C55E', fontWeight: 600 }}>€18,420 totale</div>
                        </div>
                        <svg viewBox="0 0 500 120" style={{ width: '100%' }}>
                          <defs><linearGradient id="dg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22C55E" stopOpacity="0.2" /><stop offset="100%" stopColor="#22C55E" stopOpacity="0" /></linearGradient></defs>
                          {[30, 60, 90].map(y => <line key={y} x1="0" y1={y} x2="500" y2={y} stroke="rgba(255,255,255,0.03)" />)}
                          <path d="M0,100 C40,95 60,85 100,70 S180,30 240,40 S340,55 400,35 S460,15 500,8 L500,120 L0,120 Z" fill="url(#dg)" />
                          <path d="M0,100 C40,95 60,85 100,70 S180,30 240,40 S340,55 400,35 S460,15 500,8" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" />
                          <circle cx="500" cy="8" r="4" fill="#22C55E"><animate attributeName="r" values="4;7;4" dur="2s" repeatCount="indefinite" /></circle>
                        </svg>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: '#475569' }}><span>Ott</span><span>Nov</span><span>Dic</span><span>Gen</span><span>Feb</span><span>Mar</span></div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, padding: 20 }}>
                        <div style={{ fontSize: 13, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>Top Prodotti</div>
                        {[
                          { name: 'Premium Oil 15%', val: '€3,240', pct: 90 },
                          { name: 'Vape Pro Kit', val: '€2,180', pct: 65 },
                          { name: 'Herbal Cream', val: '€1,560', pct: 48 },
                          { name: 'Aroma Pack', val: '€890', pct: 28 },
                        ].map(p => (
                          <div key={p.name} style={{ marginBottom: 14 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                              <span style={{ color: '#CBD5E1', fontWeight: 500 }}>{p.name}</span>
                              <span style={{ color: '#22C55E', fontWeight: 700 }}>{p.val}</span>
                            </div>
                            <div style={{ height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.04)' }}>
                              <div style={{ height: '100%', borderRadius: 4, width: `${p.pct}%`, background: 'linear-gradient(90deg, #22C55E, #4ADE80)', transition: 'width 1s ease-out' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ═══ POS ═══ */}
                {scene === 1 && (
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 24, letterSpacing: '-0.02em' }}>🛒 Punto Cassa</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
                      <div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                          {['Tutti', 'Oli', 'Vaporizzatori', 'Creme', 'Accessori'].map((c, i) => (
                            <div key={c} style={{ padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: i === 0 ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.03)', color: i === 0 ? '#22C55E' : '#94A3B8', border: `1px solid ${i === 0 ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)'}` }}>{c}</div>
                          ))}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                          {[
                            { name: 'Premium Oil 15%', price: '€45.00', stock: 24 },
                            { name: 'Vape Pro Kit', price: '€89.90', stock: 12 },
                            { name: 'Herbal Cream 50ml', price: '€32.00', stock: 38 },
                            { name: 'Aroma Relax Pack', price: '€28.50', stock: 45 },
                            { name: 'Cartridge Refill 3pk', price: '€19.90', stock: 67 },
                            { name: 'CBD Infusion Tea', price: '€15.00', stock: 53 },
                          ].map(p => (
                            <div key={p.name} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 18, cursor: 'pointer', transition: 'all 0.2s' }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 8 }}>{p.name}</div>
                              <div style={{ fontSize: 20, fontWeight: 800, color: '#22C55E' }}>{p.price}</div>
                              <div style={{ fontSize: 11, color: '#64748B', marginTop: 6 }}>📦 {p.stock} in stock</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 20 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: '#94A3B8' }}>🧾 Carrello Attuale</div>
                        {[
                          { name: 'Premium Oil 15%', qty: 2, price: '€90.00' },
                          { name: 'Aroma Relax Pack', qty: 1, price: '€28.50' },
                          { name: 'CBD Infusion Tea', qty: 3, price: '€45.00' },
                        ].map(item => (
                          <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 13 }}>
                            <div>
                              <div style={{ color: 'white', fontWeight: 500 }}>{item.name}</div>
                              <div style={{ color: '#64748B', fontSize: 11 }}>Qty: {item.qty}</div>
                            </div>
                            <div style={{ color: '#22C55E', fontWeight: 700 }}>{item.price}</div>
                          </div>
                        ))}
                        <div style={{ marginTop: 20, padding: '16px 0', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#94A3B8', marginBottom: 8 }}><span>Subtotale</span><span>€163.50</span></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#94A3B8', marginBottom: 8 }}><span>Sconto Fidelity -5%</span><span style={{ color: '#EF4444' }}>-€8.18</span></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 800, marginTop: 12 }}><span>Totale</span><span style={{ color: '#22C55E' }}>€155.32</span></div>
                        </div>
                        <div style={{ background: 'linear-gradient(135deg, #22C55E, #059669)', color: 'white', textAlign: 'center', padding: '14px', borderRadius: 12, fontWeight: 700, fontSize: 15, marginTop: 12, cursor: 'pointer' }}>
                          💳 Completa Vendita
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ═══ INVENTORY ═══ */}
                {scene === 2 && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>📦 Inventario in Tempo Reale</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ padding: '8px 16px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, fontSize: 13, color: '#22C55E', fontWeight: 600 }}>+ Aggiungi Prodotto</div>
                        <div style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, fontSize: 13, color: '#94A3B8', fontWeight: 500 }}>📥 Conteggio</div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
                      {[
                        { label: 'Prodotti Totali', val: '156', icon: '📋' },
                        { label: 'Valore Stock', val: '€34,280', icon: '💰' },
                        { label: 'Sotto Scorta', val: '3', icon: '⚠️' },
                      ].map(s => (
                        <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
                          <div style={{ fontSize: 28 }}>{s.icon}</div>
                          <div>
                            <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{s.label}</div>
                            <div style={{ fontSize: 24, fontWeight: 800 }}>{s.val}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, overflow: 'hidden' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                        <span>Prodotto</span><span>SKU</span><span>In Stock</span><span>Min</span><span>Stato</span>
                      </div>
                      {[
                        { name: 'Premium Oil 15%', sku: 'OIL-015', stock: 24, min: 10, ok: true },
                        { name: 'Vape Pro Kit', sku: 'VPK-001', stock: 12, min: 8, ok: true },
                        { name: 'Herbal Cream 50ml', sku: 'HCR-050', stock: 38, min: 15, ok: true },
                        { name: 'Cartridge Refill', sku: 'CRF-003', stock: 3, min: 20, ok: false },
                        { name: 'CBD Tea Box', sku: 'CTB-001', stock: 2, min: 10, ok: false },
                        { name: 'Aroma Relax', sku: 'ARP-001', stock: 45, min: 10, ok: true },
                      ].map(p => (
                        <div key={p.sku} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: 13, alignItems: 'center' }}>
                          <span style={{ fontWeight: 600, color: 'white' }}>{p.name}</span>
                          <span style={{ color: '#64748B', fontFamily: 'monospace', fontSize: 12 }}>{p.sku}</span>
                          <span style={{ fontWeight: 700, color: p.ok ? 'white' : '#EF4444' }}>{p.stock}</span>
                          <span style={{ color: '#64748B' }}>{p.min}</span>
                          <span style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: p.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: p.ok ? '#22C55E' : '#EF4444', display: 'inline-block', textAlign: 'center' }}>
                            {p.ok ? '✓ OK' : '⚠ Basso'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ═══ EMPLOYEES ═══ */}
                {scene === 3 && (
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 24, letterSpacing: '-0.02em' }}>👥 Gestione Dipendenti</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
                      {[
                        { label: 'In Turno Ora', val: '4', color: '#22C55E' },
                        { label: 'Performance Media', val: '94%', color: '#3B82F6' },
                        { label: 'Task Completati', val: '28/32', color: '#8B5CF6' },
                        { label: 'Puntualità', val: '97%', color: '#F59E0B' },
                      ].map(s => (
                        <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 18 }}>
                          <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 8 }}>{s.label}</div>
                          <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.val}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, overflow: 'hidden' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                        <span>Dipendente</span><span>Turno</span><span>Vendite</span><span>Task</span><span>Status</span>
                      </div>
                      {[
                        { name: 'Sofia R.', shift: '09:00-17:00', sales: '€1,240', tasks: '8/8', status: 'active' },
                        { name: 'Luca M.', shift: '09:00-17:00', sales: '€980', tasks: '6/7', status: 'active' },
                        { name: 'Elena T.', shift: '14:00-22:00', sales: '€720', tasks: '5/6', status: 'active' },
                        { name: 'Marco P.', shift: '14:00-22:00', sales: '€650', tasks: '4/5', status: 'active' },
                        { name: 'Anna B.', shift: 'Off', sales: '-', tasks: '-', status: 'off' },
                      ].map(e => (
                        <div key={e.name} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: 13, alignItems: 'center' }}>
                          <span style={{ fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #22C55E, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{e.name.charAt(0)}</div>
                            {e.name}
                          </span>
                          <span style={{ color: '#94A3B8' }}>{e.shift}</span>
                          <span style={{ color: '#22C55E', fontWeight: 700 }}>{e.sales}</span>
                          <span style={{ color: '#94A3B8' }}>{e.tasks}</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: e.status === 'active' ? '#22C55E' : '#64748B', boxShadow: e.status === 'active' ? '0 0 6px rgba(34,197,94,0.5)' : 'none' }} />
                            <span style={{ color: e.status === 'active' ? '#22C55E' : '#64748B', fontWeight: 600 }}>{e.status === 'active' ? 'In turno' : 'Off'}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ═══ AI ANALYTICS ═══ */}
                {scene === 4 && (
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 24, letterSpacing: '-0.02em' }}>🤖 AI Analytics & Insights</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                      {[
                        { icon: '📈', title: 'Trend Positivo', desc: 'Le vendite di oli premium crescono del +34% rispetto al mese scorso. Consigliamo di aumentare lo stock del 20%.', color: '#22C55E' },
                        { icon: '🔮', title: 'Previsione Domanda', desc: 'Il modello prevede un picco di domanda per vaporizzatori nel weekend. Probabilità: 87%.', color: '#3B82F6' },
                        { icon: '⚠️', title: 'Alert Inventario', desc: 'Cartridge Refill raggiungerà lo stock minimo in ~3 giorni al ritmo attuale. Riordino suggerito: 50 unità.', color: '#F59E0B' },
                        { icon: '💡', title: 'Ottimizzazione Prezzo', desc: 'Herbal Cream ha un margine superiore alla media (+12%). Potrebbe supportare un aumento prezzo del 5%.', color: '#8B5CF6' },
                      ].map(insight => (
                        <div key={insight.title} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 22 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${insight.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{insight.icon}</div>
                            <div style={{ fontSize: 15, fontWeight: 700 }}>{insight.title}</div>
                          </div>
                          <div style={{ fontSize: 13, color: '#CBD5E1', lineHeight: 1.7 }}>{insight.desc}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.12)', borderRadius: 16, padding: 24, textAlign: 'center' }}>
                      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>📊 Report Automatico Generato</div>
                      <div style={{ fontSize: 14, color: '#94A3B8', lineHeight: 1.6 }}>L&apos;AI ha analizzato 342 transazioni, 1,847 interazioni clienti e 156 prodotti.<br/>Prossimo report automatico: domani alle 08:00.</div>
                    </div>
                  </div>
                )}

                {/* ═══ CTA ═══ */}
                {scene === 5 && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 450, textAlign: 'center' }}>
                    <div style={{ fontSize: 48, marginBottom: 20 }}>🚀</div>
                    <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 16 }}>BrainWare</div>
                    <div style={{ fontSize: 20, color: '#94A3B8', marginBottom: 32, maxWidth: 400, lineHeight: 1.6 }}>Il sistema operativo per il retail moderno.</div>
                    <div style={{ background: 'linear-gradient(135deg, #22C55E, #059669)', color: 'white', padding: '16px 40px', borderRadius: 14, fontWeight: 700, fontSize: 17, boxShadow: '0 0 40px rgba(34,197,94,0.3)' }}>
                      Prova 30 Giorni Gratis
                    </div>
                    <div style={{ fontSize: 13, color: '#64748B', marginTop: 16 }}>Zero rischi · Nessun addebito · Setup in 2 minuti</div>
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}

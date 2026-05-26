'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const LANGS = [
  { code: 'it', flag: '🇮🇹' }, { code: 'en', flag: '🇬🇧' }, { code: 'de', flag: '🇩🇪' },
  { code: 'fr', flag: '🇫🇷' }, { code: 'es', flag: '🇪🇸' }, { code: 'pt', flag: '🇧🇷' },
]

const T: Record<string, Record<string, string>> = {
  it: {
    back: '← Torna alla home', title: 'Prova BrainWare', subtitle: 'Esplora la piattaforma completa con dati di esempio realistici.', noReg: 'Nessuna registrazione richiesta.',
    owner: 'Vista Owner', ownerDesc: 'Dashboard completa, analytics, vendite, team, inventario, magazzino, AI Intelligence e tutte le funzionalità di gestione multi-store.',
    employee: 'Vista Dipendente', empDesc: 'POS vendite, turni, conteggio inventario, fidelity card, manutenzione e l\'esperienza quotidiana del dipendente su tablet.',
    enterOwner: 'Entra come Owner', enterEmp: 'Entra come Dipendente', loading: 'Accesso in corso...',
    feat1: '📊 Dashboard Real-time', feat2: '💰 Vendite & POS', feat3: '👥 Team & Turni', feat4: '📦 Magazzino Multi-sede',
    feat5: '🤖 AI Intelligence', feat6: '📈 Analytics Avanzati', feat7: '🛍️ Shopify & E-commerce', feat8: '🌍 6 Lingue',
    empFeat1: '🛒 POS Smart', empFeat2: '⏰ Gestione Turni', empFeat3: '📸 Foto & Report', empFeat4: '💳 Fidelity Card',
    note: 'Dati demo di esempio — si resettano periodicamente. Nessun dato reale esposto.',
    stats1: '6 Store demo', stats2: '500+ Prodotti', stats3: '1.200+ Vendite', stats4: 'AI Integrata',
  },
  en: {
    back: '← Back to home', title: 'Try BrainWare', subtitle: 'Explore the complete platform with realistic sample data.', noReg: 'No registration required.',
    owner: 'Owner View', ownerDesc: 'Full dashboard, analytics, sales, team, inventory, warehouse, AI Intelligence and all multi-store management features.',
    employee: 'Employee View', empDesc: 'POS sales, shifts, inventory counting, fidelity cards, maintenance and the daily employee tablet experience.',
    enterOwner: 'Enter as Owner', enterEmp: 'Enter as Employee', loading: 'Logging in...',
    feat1: '📊 Real-time Dashboard', feat2: '💰 Sales & POS', feat3: '👥 Team & Shifts', feat4: '📦 Multi-location Warehouse',
    feat5: '🤖 AI Intelligence', feat6: '📈 Advanced Analytics', feat7: '🛍️ Shopify & E-commerce', feat8: '🌍 6 Languages',
    empFeat1: '🛒 Smart POS', empFeat2: '⏰ Shift Management', empFeat3: '📸 Photos & Reports', empFeat4: '💳 Fidelity Cards',
    note: 'Sample demo data — resets periodically. No real data exposed.',
    stats1: '6 Demo Stores', stats2: '500+ Products', stats3: '1,200+ Sales', stats4: 'Built-in AI',
  },
  de: {
    back: '← Zurück zur Startseite', title: 'BrainWare testen', subtitle: 'Erkunden Sie die komplette Plattform mit realistischen Beispieldaten.', noReg: 'Keine Registrierung erforderlich.',
    owner: 'Owner-Ansicht', ownerDesc: 'Vollständiges Dashboard, Analysen, Verkäufe, Team, Inventar, Lager, KI-Intelligenz und Multi-Store-Management.',
    employee: 'Mitarbeiter-Ansicht', empDesc: 'POS-Verkäufe, Schichten, Inventur, Kundenkarten, Wartung und die tägliche Tablet-Erfahrung.',
    enterOwner: 'Als Owner einloggen', enterEmp: 'Als Mitarbeiter einloggen', loading: 'Anmeldung...',
    feat1: '📊 Echtzeit-Dashboard', feat2: '💰 Verkäufe & POS', feat3: '👥 Team & Schichten', feat4: '📦 Multi-Standort Lager',
    feat5: '🤖 KI-Intelligenz', feat6: '📈 Erweiterte Analysen', feat7: '🛍️ Shopify & E-Commerce', feat8: '🌍 6 Sprachen',
    empFeat1: '🛒 Smart POS', empFeat2: '⏰ Schichtverwaltung', empFeat3: '📸 Fotos & Berichte', empFeat4: '💳 Kundenkarten',
    note: 'Demo-Beispieldaten — werden regelmäßig zurückgesetzt.',
    stats1: '6 Demo-Stores', stats2: '500+ Produkte', stats3: '1.200+ Verkäufe', stats4: 'Integrierte KI',
  },
  fr: {
    back: '← Retour à l\'accueil', title: 'Essayer BrainWare', subtitle: 'Explorez la plateforme complète avec des données d\'exemple réalistes.', noReg: 'Aucune inscription requise.',
    owner: 'Vue Propriétaire', ownerDesc: 'Dashboard complet, analyses, ventes, équipe, inventaire, entrepôt, Intelligence IA et gestion multi-boutique.',
    employee: 'Vue Employé', empDesc: 'POS ventes, quarts, comptage d\'inventaire, cartes fidélité, maintenance et l\'expérience quotidienne.',
    enterOwner: 'Entrer comme Propriétaire', enterEmp: 'Entrer comme Employé', loading: 'Connexion...',
    feat1: '📊 Dashboard Temps Réel', feat2: '💰 Ventes & POS', feat3: '👥 Équipe & Quarts', feat4: '📦 Entrepôt Multi-site',
    feat5: '🤖 Intelligence IA', feat6: '📈 Analyses Avancées', feat7: '🛍️ Shopify & E-commerce', feat8: '🌍 6 Langues',
    empFeat1: '🛒 POS Intelligent', empFeat2: '⏰ Gestion Quarts', empFeat3: '📸 Photos & Rapports', empFeat4: '💳 Cartes Fidélité',
    note: 'Données de démonstration — réinitialisées périodiquement.',
    stats1: '6 Boutiques démo', stats2: '500+ Produits', stats3: '1 200+ Ventes', stats4: 'IA Intégrée',
  },
  es: {
    back: '← Volver al inicio', title: 'Prueba BrainWare', subtitle: 'Explora la plataforma completa con datos de ejemplo realistas.', noReg: 'Sin registro requerido.',
    owner: 'Vista Owner', ownerDesc: 'Dashboard completo, análisis, ventas, equipo, inventario, almacén, Inteligencia IA y gestión multi-tienda.',
    employee: 'Vista Empleado', empDesc: 'POS ventas, turnos, conteo de inventario, tarjetas fidelidad, mantenimiento y la experiencia diaria.',
    enterOwner: 'Entrar como Owner', enterEmp: 'Entrar como Empleado', loading: 'Conectando...',
    feat1: '📊 Dashboard Tiempo Real', feat2: '💰 Ventas & POS', feat3: '👥 Equipo & Turnos', feat4: '📦 Almacén Multi-sede',
    feat5: '🤖 Inteligencia IA', feat6: '📈 Análisis Avanzados', feat7: '🛍️ Shopify & E-commerce', feat8: '🌍 6 Idiomas',
    empFeat1: '🛒 POS Inteligente', empFeat2: '⏰ Gestión Turnos', empFeat3: '📸 Fotos & Reportes', empFeat4: '💳 Tarjetas Fidelidad',
    note: 'Datos demo de ejemplo — se reinician periódicamente.',
    stats1: '6 Tiendas demo', stats2: '500+ Productos', stats3: '1.200+ Ventas', stats4: 'IA Integrada',
  },
  pt: {
    back: '← Voltar ao início', title: 'Teste BrainWare', subtitle: 'Explore a plataforma completa com dados de exemplo realistas.', noReg: 'Nenhum cadastro necessário.',
    owner: 'Visão Owner', ownerDesc: 'Dashboard completo, análises, vendas, equipe, inventário, armazém, Inteligência IA e gestão multi-loja.',
    employee: 'Visão Funcionário', empDesc: 'POS vendas, turnos, contagem de inventário, cartões fidelidade, manutenção e a experiência diária.',
    enterOwner: 'Entrar como Owner', enterEmp: 'Entrar como Funcionário', loading: 'Conectando...',
    feat1: '📊 Dashboard Tempo Real', feat2: '💰 Vendas & POS', feat3: '👥 Equipe & Turnos', feat4: '📦 Armazém Multi-sede',
    feat5: '🤖 Inteligência IA', feat6: '📈 Análises Avançadas', feat7: '🛍️ Shopify & E-commerce', feat8: '🌍 6 Idiomas',
    empFeat1: '🛒 POS Inteligente', empFeat2: '⏰ Gestão Turnos', empFeat3: '📸 Fotos & Relatórios', empFeat4: '💳 Cartões Fidelidade',
    note: 'Dados demo de exemplo — reiniciam periodicamente.',
    stats1: '6 Lojas demo', stats2: '500+ Produtos', stats3: '1.200+ Vendas', stats4: 'IA Integrada',
  },
}

export default function DemoPage() {
  const [loading, setLoading] = useState<'owner' | 'employee' | null>(null)
  const [error, setError] = useState('')
  const [lang, setLang] = useState('en')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const bl = navigator.language.slice(0, 2)
    if (T[bl]) setLang(bl)
    setMounted(true)
  }, [])

  const t = (k: string) => T[lang]?.[k] || T['en']?.[k] || k

  async function startDemo(view: 'owner' | 'employee') {
    setLoading(view); setError('')
    try {
      const res = await fetch('/api/demo-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ view }) })
      const data = await res.json()
      if (data.error) { setError(data.error); setLoading(null); return }
      const supabase = createClient()
      await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token })
      window.location.href = data.redirect
    } catch { setError('Network error'); setLoading(null) }
  }

  const cardBase: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 32,
    cursor: 'pointer', transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
    position: 'relative', overflow: 'hidden',
  }

  if (!mounted) return null

  return (
    <div style={{
      minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif",
      background: 'linear-gradient(160deg, #0A0A1B 0%, #111133 35%, #1a0a2e 65%, #0A0A1B 100%)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Animated background orbs */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)', top: -200, right: -100, animation: 'pulse 8s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)', bottom: -150, left: -100, animation: 'pulse 10s ease-in-out infinite reverse' }} />
        <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,197,94,0.08) 0%, transparent 70%)', top: '40%', left: '50%', animation: 'pulse 6s ease-in-out infinite' }} />
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.15); opacity: 1; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        .demo-card:hover { transform: translateY(-4px) !important; border-color: rgba(99,102,241,0.4) !important; box-shadow: 0 20px 60px rgba(99,102,241,0.15) !important; }
        .demo-card-emp:hover { border-color: rgba(34,197,94,0.4) !important; box-shadow: 0 20px 60px rgba(34,197,94,0.15) !important; }
        .demo-stat { text-align: center; padding: 16px 0; }
        .demo-stat-value { font-size: 22px; font-weight: 800; background: linear-gradient(135deg, #A5B4FC, #818CF8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .demo-stat-label { font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 4px; letter-spacing: 0.02em; }
      `}</style>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 780, margin: '0 auto', padding: '40px 24px 60px' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 48, animation: 'fadeUp 0.5s ease-out' }}>
          <Link href="/" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontSize: 13, transition: 'color 0.2s' }}>{t('back')}</Link>
          <div style={{ display: 'flex', gap: 4 }}>
            {LANGS.map(l => (
              <button key={l.code} onClick={() => setLang(l.code)}
                style={{ background: lang === l.code ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.05)', border: lang === l.code ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent', borderRadius: 8, padding: '5px 8px', fontSize: 16, cursor: 'pointer', transition: 'all 0.2s' }}>
                {l.flag}
              </button>
            ))}
          </div>
        </div>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48, animation: 'fadeUp 0.6s ease-out' }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, margin: '0 auto 20px', background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #A855F7 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, color: 'white', boxShadow: '0 8px 32px rgba(99,102,241,0.4)' }}>B</div>
          <h1 style={{ color: 'white', fontSize: 36, fontWeight: 800, marginBottom: 12, letterSpacing: '-0.02em' }}>{t('title')}</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, lineHeight: 1.6, maxWidth: 480, margin: '0 auto' }}>
            {t('subtitle')}<br/><strong style={{ color: 'rgba(255,255,255,0.7)' }}>{t('noReg')}</strong>
          </p>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 32, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '8px 0', animation: 'fadeUp 0.7s ease-out' }}>
          {['stats1','stats2','stats3','stats4'].map(k => (
            <div key={k} className="demo-stat">
              <div className="demo-stat-value">{t(k).split(' ')[0]}</div>
              <div className="demo-stat-label">{t(k).split(' ').slice(1).join(' ')}</div>
            </div>
          ))}
        </div>

        {/* Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, animation: 'fadeUp 0.8s ease-out' }}>
          {/* Owner Card */}
          <div className="demo-card" style={cardBase} onClick={() => !loading && startDemo('owner')}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #6366F1, #8B5CF6, #A855F7)', borderRadius: '20px 20px 0 0' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>👑</div>
              <div>
                <h3 style={{ color: 'white', fontSize: 19, fontWeight: 700, margin: 0 }}>{t('owner')}</h3>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Full management access</div>
              </div>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>{t('ownerDesc')}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
              {['feat1','feat2','feat3','feat4','feat5','feat6','feat7','feat8'].map(k => (
                <span key={k} style={{ padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 600, background: 'rgba(99,102,241,0.12)', color: '#A5B4FC', border: '1px solid rgba(99,102,241,0.15)' }}>{t(k)}</span>
              ))}
            </div>
            <button disabled={!!loading} style={{
              width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
              background: loading === 'owner' ? '#4338CA' : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              color: 'white', fontWeight: 700, fontSize: 14, cursor: loading ? 'wait' : 'pointer',
              boxShadow: '0 4px 20px rgba(99,102,241,0.3)', transition: 'all 0.3s', letterSpacing: '0.01em',
            }}>
              {loading === 'owner' ? `⏳ ${t('loading')}` : `🚀 ${t('enterOwner')}`}
            </button>
          </div>

          {/* Employee Card */}
          <div className="demo-card demo-card-emp" style={cardBase} onClick={() => !loading && startDemo('employee')}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #22C55E, #16A34A, #15803D)', borderRadius: '20px 20px 0 0' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(22,163,74,0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>👤</div>
              <div>
                <h3 style={{ color: 'white', fontSize: 19, fontWeight: 700, margin: 0 }}>{t('employee')}</h3>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Tablet POS experience</div>
              </div>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>{t('empDesc')}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
              {['empFeat1','empFeat2','empFeat3','empFeat4'].map(k => (
                <span key={k} style={{ padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 600, background: 'rgba(34,197,94,0.12)', color: '#86EFAC', border: '1px solid rgba(34,197,94,0.15)' }}>{t(k)}</span>
              ))}
            </div>
            <button disabled={!!loading} style={{
              width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
              background: loading === 'employee' ? '#166534' : 'linear-gradient(135deg, #22C55E, #16A34A)',
              color: 'white', fontWeight: 700, fontSize: 14, cursor: loading ? 'wait' : 'pointer',
              boxShadow: '0 4px 20px rgba(34,197,94,0.3)', transition: 'all 0.3s', letterSpacing: '0.01em',
            }}>
              {loading === 'employee' ? `⏳ ${t('loading')}` : `🚀 ${t('enterEmp')}`}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ marginTop: 20, padding: '12px 18px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, color: '#FCA5A5', fontSize: 13, textAlign: 'center' }}>{error}</div>
        )}

        {/* Note */}
        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 32, textAlign: 'center', lineHeight: 1.5 }}>
          🔒 {t('note')}
        </p>
      </div>
    </div>
  )
}

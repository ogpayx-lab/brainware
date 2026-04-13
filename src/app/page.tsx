'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import translations, { LANGS, type LandingLang } from '@/lib/landing-translations'
import '@/styles/landing.css'

export default function LandingPage() {
  const [lang, setLang] = useState<LandingLang>('en')
  const [scrolled, setScrolled] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  useEffect(() => {
    const browserLang = navigator.language.slice(0, 2) as LandingLang
    if (['it', 'en', 'de', 'fr', 'es'].includes(browserLang)) setLang(browserLang)
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const t = (key: string) => translations[lang]?.[key] || translations['en']?.[key] || key

  const FEATURES = [
    { icon: '🛒', title: t('feat_pos_title'), desc: t('feat_pos_desc') },
    { icon: '📊', title: t('feat_inv_title'), desc: t('feat_inv_desc') },
    { icon: '👥', title: t('feat_emp_title'), desc: t('feat_emp_desc') },
    { icon: '📈', title: t('feat_analytics_title'), desc: t('feat_analytics_desc') },
    { icon: '🏪', title: t('feat_multi_title'), desc: t('feat_multi_desc') },
    { icon: '🛍️', title: t('feat_shopify_title'), desc: t('feat_shopify_desc') },
    { icon: '🔧', title: t('feat_maint_title'), desc: t('feat_maint_desc') },
    { icon: '🤖', title: t('feat_ai_title'), desc: t('feat_ai_desc') },
  ]

  const PLANS = [
    { name: t('plan_starter'), desc: t('plan_starter_desc'), price: '49', stores: t('plan_starter_stores'), features: [t('pricing_feature_all'), t('pricing_feature_support_email')] },
    { name: t('plan_growth'), desc: t('plan_growth_desc'), price: '99', stores: t('plan_growth_stores'), popular: true, features: [t('pricing_feature_all'), t('pricing_feature_support_priority'), t('pricing_feature_analytics')] },
    { name: t('plan_business'), desc: t('plan_business_desc'), price: '149', stores: t('plan_business_stores'), features: [t('pricing_feature_all'), t('pricing_feature_support_priority'), t('pricing_feature_analytics'), t('pricing_feature_onboarding')] },
    { name: t('plan_enterprise'), desc: t('plan_enterprise_desc'), price: null, stores: t('plan_enterprise_stores'), features: [t('pricing_feature_all'), t('pricing_feature_sla'), t('pricing_feature_manager'), t('pricing_feature_custom')] },
  ]

  const FAQS = [
    { q: t('faq_q1'), a: t('faq_a1') }, { q: t('faq_q2'), a: t('faq_a2') },
    { q: t('faq_q3'), a: t('faq_a3') }, { q: t('faq_q4'), a: t('faq_a4') },
    { q: t('faq_q5'), a: t('faq_a5') }, { q: t('faq_q6'), a: t('faq_a6') },
  ]

  const heroTitle = {
    it: { pre: 'Il gestionale', br: 'intelligente per il tuo', accent: 'retail' },
    en: { pre: 'The intelligent', br: 'platform for your', accent: 'retail' },
    de: { pre: 'Die intelligente', br: 'Plattform für Ihren', accent: 'Einzelhandel' },
    fr: { pre: 'La plateforme', br: 'intelligente pour votre', accent: 'commerce' },
    es: { pre: 'La plataforma', br: 'inteligente para tu', accent: 'comercio' },
  }

  const ht = heroTitle[lang]

  return (
    <div className="landing">
      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'BrainWare',
        applicationCategory: 'BusinessApplication', operatingSystem: 'Web',
        offers: [
          { '@type': 'Offer', name: 'Starter', price: '49', priceCurrency: 'EUR' },
          { '@type': 'Offer', name: 'Growth', price: '99', priceCurrency: 'EUR' },
          { '@type': 'Offer', name: 'Business', price: '149', priceCurrency: 'EUR' },
        ],
      }) }} />

      {/* ═══ NAV ═══ */}
      <header>
        <nav className={`l-nav ${scrolled ? 'scrolled' : ''}`} aria-label="Main navigation">
          <div className="l-nav-inner">
            <a href="#" className="l-nav-logo"><div className="l-nav-logo-icon">B</div>BrainWare</a>
            <div className="l-nav-links">
              <a href="#features">{t('nav_features')}</a>
              <a href="#pricing">{t('nav_pricing')}</a>
              <a href="#faq">{t('nav_faq')}</a>
            </div>
            <div className="l-nav-actions">
              <select className="l-lang-select" value={lang} onChange={e => setLang(e.target.value as LandingLang)}>
                {LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
              </select>
              <Link href="/login" className="l-btn l-btn-ghost">{t('nav_login')}</Link>
              <Link href="/signup" className="l-btn l-btn-primary l-btn-sm">{t('nav_cta')}</Link>
            </div>
          </div>
        </nav>
      </header>

      <main>
        {/* ═══ HERO ═══ */}
        <section className="l-hero" aria-label="Hero">
          <div className="l-hero-bg">
            <div className="orb orb-1" />
            <div className="orb orb-2" />
            <div className="orb orb-3" />
          </div>
          <div className="l-hero-grid" />

          <div className="l-hero-content">
            <div className="l-hero-badge l-animate">⚡ {t('hero_badge')}</div>
            <h1 className="l-animate l-animate-d1">
              {ht.pre}<br/>{ht.br} <span className="l-gradient-text">{ht.accent}</span>
            </h1>
            <p className="l-hero-sub l-animate l-animate-d2">{t('hero_subtitle')}</p>
            <div className="l-hero-buttons l-animate l-animate-d3">
              <Link href="/signup" className="l-btn l-btn-primary l-btn-lg">{t('hero_cta')}</Link>
              <a href="#features" className="l-btn l-btn-secondary l-btn-lg">{t('hero_cta_secondary')}</a>
            </div>
            <div className="l-hero-note l-animate l-animate-d4">{t('hero_no_cc')}</div>
          </div>

          {/* ── Premium Dashboard ── */}
          <div className="l-hero-visual l-animate l-animate-d5">
            <div className="l-dashboard">
              {/* Floating notification */}
              <div className="l-float-card l-float-card-1">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📈</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>AI Insight</div>
                    <div style={{ fontSize: 12, color: '#22C55E', fontWeight: 600 }}>Revenue up 23% this week</div>
                  </div>
                </div>
              </div>
              {/* Floating status */}
              <div className="l-float-card l-float-card-2">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🔔</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>New Order #1042</div>
                    <div style={{ fontSize: 12, color: '#94A3B8' }}>CBD Oil 10% × 2 — €49.80</div>
                  </div>
                </div>
              </div>

              <div className="l-dash-main">
                <div className="l-dash-toolbar">
                  <div className="l-dash-dots">
                    <div className="l-dash-dot" style={{ background: '#EF4444' }} />
                    <div className="l-dash-dot" style={{ background: '#F59E0B' }} />
                    <div className="l-dash-dot" style={{ background: '#22C55E' }} />
                  </div>
                  <div className="l-dash-url">
                    <span style={{ marginRight: 6, fontSize: 10, color: '#22C55E' }}>🔒</span>
                    app.brainware.io/dashboard
                  </div>
                </div>

                <div className="l-dash-body">
                  <div className="l-dash-sidebar">
                    <div style={{ padding: '4px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', marginBottom: 8 }}>
                      <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 6 }}>Store</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>Milano Centro</div>
                    </div>
                    {[
                      { icon: '◻️', label: 'Dashboard', active: true },
                      { icon: '🛒', label: 'POS' },
                      { icon: '📦', label: 'Inventario' },
                      { icon: '👥', label: 'Dipendenti' },
                      { icon: '📊', label: 'Analytics' },
                      { icon: '🔧', label: 'Settings' },
                    ].map(item => (
                      <div key={item.label} className={`l-dash-sidebar-item ${item.active ? 'active' : ''}`}>
                        <span>{item.icon}</span> {item.label}
                      </div>
                    ))}
                  </div>

                  <div className="l-dash-content">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>Dashboard</div>
                        <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>Domenica 13 Aprile, 2025</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ padding: '6px 14px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, fontSize: 12, color: '#22C55E', fontWeight: 600 }}>Today</div>
                        <div style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, fontSize: 12, color: '#64748B', fontWeight: 500 }}>7 Days</div>
                        <div style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, fontSize: 12, color: '#64748B', fontWeight: 500 }}>30 Days</div>
                      </div>
                    </div>

                    <div className="l-dash-kpis">
                      {[
                        { label: 'Revenue', val: '€12,480', change: '+18.2%', color: '#22C55E', bg: 'rgba(34,197,94,0.08)', spark: 'M0,20 Q8,18 16,15 T32,10 T48,12 T64,5' },
                        { label: 'Orders', val: '284', change: '+12.5%', color: '#3B82F6', bg: 'rgba(59,130,246,0.08)', spark: 'M0,18 Q12,15 24,12 T48,8 T64,10' },
                        { label: 'Customers', val: '1,205', change: '+7.3%', color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)', spark: 'M0,16 Q16,14 32,10 T48,12 T64,8' },
                        { label: 'Avg. Order', val: '€43.90', change: '+5.1%', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', spark: 'M0,15 Q10,12 24,14 T48,8 T64,6' },
                      ].map(kpi => (
                        <div key={kpi.label} className="l-dash-kpi">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                            <div>
                              <div className="l-dash-kpi-label">{kpi.label}</div>
                              <div className="l-dash-kpi-val">{kpi.val}</div>
                            </div>
                            <svg viewBox="0 0 64 24" style={{ width: 64, height: 24, marginTop: 4 }}>
                              <path d={kpi.spark} fill="none" stroke={kpi.color} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
                            </svg>
                          </div>
                          <div className="l-dash-kpi-change" style={{ color: kpi.color, background: kpi.bg }}>↑ {kpi.change}</div>
                        </div>
                      ))}
                    </div>

                    <div className="l-dash-chart-area">
                      <div className="l-dash-chart-box">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                          <div className="l-dash-chart-title">Revenue Overview</div>
                          <div style={{ fontSize: 11, color: '#22C55E', fontWeight: 600 }}>€12,480 total</div>
                        </div>
                        <svg viewBox="0 0 380 80" style={{ width: '100%' }}>
                          <defs>
                            <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#22C55E" stopOpacity="0.25" />
                              <stop offset="100%" stopColor="#22C55E" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          {/* Grid lines */}
                          {[20, 40, 60].map(y => (
                            <line key={y} x1="0" y1={y} x2="380" y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                          ))}
                          <path d="M0,70 C25,68 40,60 80,48 S130,22 180,28 S250,40 300,30 S350,10 380,6 L380,80 L0,80 Z" fill="url(#cg)" />
                          <path d="M0,70 C25,68 40,60 80,48 S130,22 180,28 S250,40 300,30 S350,10 380,6" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" />
                          <circle cx="380" cy="6" r="3.5" fill="#22C55E">
                            <animate attributeName="r" values="3.5;5;3.5" dur="2s" repeatCount="indefinite" />
                          </circle>
                          <circle cx="380" cy="6" r="8" fill="none" stroke="#22C55E" strokeWidth="1" opacity="0.3">
                            <animate attributeName="r" values="8;14;8" dur="2s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
                          </circle>
                        </svg>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: '#475569' }}>
                          <span>Oct</span><span>Nov</span><span>Dec</span><span>Jan</span><span>Feb</span><span>Mar</span>
                        </div>
                      </div>
                      <div className="l-dash-chart-box">
                        <div className="l-dash-chart-title">Top Products</div>
                        {[
                          { name: 'CBD Oil 10%', val: '€2,340', pct: 85 },
                          { name: 'Vape Kit Pro', val: '€1,890', pct: 70 },
                          { name: 'Hemp Cream', val: '€1,120', pct: 48 },
                        ].map(p => (
                          <div key={p.name} style={{ marginBottom: 14 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                              <span style={{ color: '#CBD5E1', fontWeight: 500 }}>{p.name}</span>
                              <span style={{ color: '#22C55E', fontWeight: 700 }}>{p.val}</span>
                            </div>
                            <div style={{ height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.04)' }}>
                              <div style={{ height: '100%', borderRadius: 4, width: `${p.pct}%`, background: 'linear-gradient(90deg, #22C55E, #4ADE80)' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ STATS ═══ */}
        <section className="l-stats" aria-label="Statistics">
          <div className="l-stats-inner">
            {[
              { value: '500+', label: t('social_stores') },
              { value: '50K+', label: t('social_transactions') },
              { value: '99.9%', label: t('social_uptime') },
              { value: '24/7', label: t('social_support') },
            ].map(s => (
              <div key={s.label} className="l-stat">
                <div className="l-stat-value">{s.value}</div>
                <div className="l-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ FEATURES ═══ */}
        <section className="l-section l-section-alt" id="features" aria-label="Features">
          <div className="l-section-inner">
            <div className="l-section-header">
              <div className="l-section-badge">✦ {t('features_badge')}</div>
              <h2>{t('features_title')}</h2>
              <p>{t('features_subtitle')}</p>
            </div>
            <div className="l-features-grid">
              {FEATURES.map((f, i) => (
                <div key={i} className="l-feat-card">
                  <span className="l-feat-icon">{f.icon}</span>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ AI ═══ */}
        <section className="l-ai" aria-label="AI Features">
          <div className="l-ai-inner">
            <div className="l-section-header">
              <div className="l-section-badge">🧠 {t('ai_badge')}</div>
              <h2>{t('ai_title')}</h2>
              <p>{t('ai_subtitle')}</p>
            </div>
            <div className="l-ai-visual">
              {['Machine Learning', 'NLP', 'Predictive Analytics', 'Smart Automation', 'Real-time Insights'].map(chip => (
                <div key={chip} className="l-ai-chip">⚡ {chip}</div>
              ))}
            </div>
            <div className="l-ai-grid">
              {[
                { icon: '📊', title: t('ai_card1_title'), desc: t('ai_card1_desc') },
                { icon: '🔮', title: t('ai_card2_title'), desc: t('ai_card2_desc') },
                { icon: '📋', title: t('ai_card3_title'), desc: t('ai_card3_desc') },
                { icon: '💬', title: t('ai_card4_title'), desc: t('ai_card4_desc') },
              ].map((card, i) => (
                <div key={i} className="l-ai-card">
                  <div className="l-ai-card-icon">{card.icon}</div>
                  <h3>{card.title}</h3>
                  <p>{card.desc}</p>
                </div>
              ))}
            </div>
            <div className="l-ai-quote"><p>&ldquo;{t('ai_quote')}&rdquo;</p></div>
          </div>
        </section>

        {/* ═══ HOW ═══ */}
        <section className="l-section l-section-dark" aria-label="How it works">
          <div className="l-section-inner">
            <div className="l-section-header">
              <div className="l-section-badge">→ {t('how_badge')}</div>
              <h2>{t('how_title')}</h2>
            </div>
            <div className="l-how-grid">
              {[
                { num: '1', title: t('how_step1_title'), desc: t('how_step1_desc') },
                { num: '2', title: t('how_step2_title'), desc: t('how_step2_desc') },
                { num: '3', title: t('how_step3_title'), desc: t('how_step3_desc') },
              ].map(step => (
                <div key={step.num} className="l-how-step">
                  <div className="l-how-num">{step.num}</div>
                  <h3>{step.title}</h3>
                  <p>{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ PRICING ═══ */}
        <section className="l-section l-section-alt" id="pricing" aria-label="Pricing">
          <div className="l-section-inner">
            <div className="l-section-header">
              <div className="l-section-badge">💎 {t('pricing_badge')}</div>
              <h2>{t('pricing_title')}</h2>
              <p>{t('pricing_subtitle')}</p>
            </div>
            <div className="l-pricing-grid">
              {PLANS.map((plan, i) => (
                <div key={i} className={`l-price-card ${plan.popular ? 'popular' : ''}`}>
                  {plan.popular && <div className="l-price-popular-tag">⭐ {t('plan_growth_popular')}</div>}
                  <div className="l-price-name">{plan.name}</div>
                  <div className="l-price-desc">{plan.desc}</div>
                  {plan.price ? (
                    <div className="l-price-amount">€{plan.price}<span className="l-price-period">{t('pricing_per_month')}</span></div>
                  ) : (
                    <div className="l-price-amount" style={{ fontSize: 30 }}>{t('plan_enterprise_price')}</div>
                  )}
                  <div className="l-price-stores">{plan.stores}</div>
                  <div className="l-price-trial">🎁 {t('pricing_trial')}</div>
                  <ul className="l-price-features">
                    {plan.features.map((f, j) => <li key={j}>{f}</li>)}
                  </ul>
                  {plan.price ? (
                    <Link href="/signup" className="l-btn l-btn-primary" style={{ width: '100%' }}>{t('pricing_cta')}</Link>
                  ) : (
                    <a href="https://calendly.com" target="_blank" rel="noopener noreferrer" className="l-btn l-btn-secondary" style={{ width: '100%' }}>{t('pricing_enterprise_cta')}</a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ FAQ ═══ */}
        <section className="l-section l-section-dark" id="faq" aria-label="FAQ">
          <div className="l-section-inner">
            <div className="l-section-header">
              <div className="l-section-badge">❓ {t('faq_badge')}</div>
              <h2>{t('faq_title')}</h2>
            </div>
            <div className="l-faq-list">
              {FAQS.map((faq, i) => (
                <div key={i} className={`l-faq-item ${openFaq === i ? 'open' : ''}`}>
                  <div className="l-faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                    {faq.q}
                    <span className="l-faq-arrow">▼</span>
                  </div>
                  {openFaq === i && <div className="l-faq-a">{faq.a}</div>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ CTA ═══ */}
        <section className="l-cta" aria-label="Call to action">
          <h2>{t('cta_title')}</h2>
          <p>{t('cta_subtitle')}</p>
          <Link href="/signup" className="l-btn l-btn-primary l-btn-lg">{t('cta_button')}</Link>
          <div className="l-cta-note">{t('cta_note')}</div>
        </section>
      </main>

      {/* ═══ FOOTER ═══ */}
      <footer className="l-footer">
        <div className="l-footer-inner">
          <div className="l-footer-grid">
            <div className="l-footer-brand">
              <a href="#" className="l-nav-logo"><div className="l-nav-logo-icon">B</div>BrainWare</a>
              <p>{t('footer_tagline')}</p>
            </div>
            <div className="l-footer-col">
              <h4>{t('footer_product')}</h4>
              <a href="#features">{t('footer_features')}</a>
              <a href="#pricing">{t('footer_pricing')}</a>
              <a href="#">{t('footer_integrations')}</a>
            </div>
            <div className="l-footer-col">
              <h4>{t('footer_company')}</h4>
              <a href="#">{t('footer_about')}</a>
              <a href="#">{t('footer_contact')}</a>
              <a href="#">{t('footer_blog')}</a>
            </div>
            <div className="l-footer-col">
              <h4>{t('footer_legal')}</h4>
              <Link href="/privacy">{t('footer_privacy')}</Link>
              <Link href="/terms">{t('footer_terms')}</Link>
              <a href="#">{t('footer_cookies')}</a>
            </div>
          </div>
          <div className="l-footer-bottom">{t('footer_rights')}</div>
        </div>
      </footer>
    </div>
  )
}

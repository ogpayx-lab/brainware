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
    // Detect browser language
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
    {
      name: t('plan_starter'), desc: t('plan_starter_desc'), price: '49', stores: t('plan_starter_stores'),
      features: [t('pricing_feature_all'), t('pricing_feature_support_email')],
    },
    {
      name: t('plan_growth'), desc: t('plan_growth_desc'), price: '99', stores: t('plan_growth_stores'),
      popular: true,
      features: [t('pricing_feature_all'), t('pricing_feature_support_priority'), t('pricing_feature_analytics')],
    },
    {
      name: t('plan_business'), desc: t('plan_business_desc'), price: '149', stores: t('plan_business_stores'),
      features: [t('pricing_feature_all'), t('pricing_feature_support_priority'), t('pricing_feature_analytics'), t('pricing_feature_onboarding')],
    },
    {
      name: t('plan_enterprise'), desc: t('plan_enterprise_desc'), price: null, stores: t('plan_enterprise_stores'),
      features: [t('pricing_feature_all'), t('pricing_feature_sla'), t('pricing_feature_manager'), t('pricing_feature_custom')],
    },
  ]

  const FAQS = [
    { q: t('faq_q1'), a: t('faq_a1') },
    { q: t('faq_q2'), a: t('faq_a2') },
    { q: t('faq_q3'), a: t('faq_a3') },
    { q: t('faq_q4'), a: t('faq_a4') },
    { q: t('faq_q5'), a: t('faq_a5') },
    { q: t('faq_q6'), a: t('faq_a6') },
  ]

  return (
    <div className="landing">
      {/* JSON-LD Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'BrainWare',
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web',
          description: 'Retail management platform with POS, inventory, employee management, and AI analytics.',
          offers: [
            { '@type': 'Offer', name: 'Starter', price: '49', priceCurrency: 'EUR', description: '1 Store' },
            { '@type': 'Offer', name: 'Growth', price: '99', priceCurrency: 'EUR', description: 'Up to 3 Stores' },
            { '@type': 'Offer', name: 'Business', price: '149', priceCurrency: 'EUR', description: '3-5 Stores' },
          ],
          aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.9', reviewCount: '127' },
        }) }}
      />

      {/* ═══════ NAVBAR ═══════ */}
      <header>
      <nav className={`l-nav ${scrolled ? 'scrolled' : ''}`} aria-label="Main navigation">
        <div className="l-nav-inner">
          <a href="#" className="l-nav-logo">
            <div className="l-nav-logo-icon">B</div>
            BrainWare
          </a>
          <div className="l-nav-links">
            <a href="#features">{t('nav_features')}</a>
            <a href="#pricing">{t('nav_pricing')}</a>
            <a href="#faq">{t('nav_faq')}</a>
          </div>
          <div className="l-nav-actions">
            <select
              className="l-lang-select"
              value={lang}
              onChange={e => setLang(e.target.value as LandingLang)}
            >
              {LANGS.map(l => (
                <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
              ))}
            </select>
            <Link href="/login" className="l-btn l-btn-ghost">{t('nav_login')}</Link>
            <Link href="/signup" className="l-btn l-btn-primary l-btn-sm">{t('nav_cta')}</Link>
          </div>
        </div>
      </nav>
      </header>

      <main>
      {/* ═══════ HERO ═══════ */}
      <section className="l-hero" aria-label="Hero">
        <div className="l-hero-inner">
          <div>
            <div className="l-hero-badge l-animate">{t('hero_badge')}</div>
            <h1 className="l-animate l-animate-d1">{t('hero_title')}</h1>
            <p className="l-animate l-animate-d2">{t('hero_subtitle')}</p>
            <div className="l-hero-buttons l-animate l-animate-d3">
              <Link href="/signup" className="l-btn l-btn-primary l-btn-lg">{t('hero_cta')}</Link>
              <a href="#features" className="l-btn l-btn-secondary l-btn-lg">{t('hero_cta_secondary')}</a>
            </div>
            <div className="l-hero-note l-animate l-animate-d4">{t('hero_no_cc')}</div>
          </div>
          <div className="l-hero-img l-animate l-animate-d2">
            <div style={{
              background: 'linear-gradient(135deg, #1E293B, #0F172A)',
              borderRadius: 12,
              padding: 24,
              minHeight: 400,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}>
              {/* Dashboard mockup */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#EF4444' }} />
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#F59E0B' }} />
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#22C55E' }} />
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 12, color: '#64748B' }}>BrainWare Dashboard</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { label: 'Revenue', value: '€12,480', change: '+18%', color: '#22C55E' },
                  { label: 'Orders', value: '284', change: '+12%', color: '#3B82F6' },
                  { label: 'Customers', value: '1,205', change: '+7%', color: '#8B5CF6' },
                ].map(m => (
                  <div key={m.label} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>{m.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'white' }}>{m.value}</div>
                    <div style={{ fontSize: 12, color: m.color, fontWeight: 600 }}>↑ {m.change}</div>
                  </div>
                ))}
              </div>
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 12 }}>Revenue Overview</div>
                <svg viewBox="0 0 400 120" style={{ width: '100%', height: 'auto' }}>
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22C55E" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#22C55E" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0,100 Q50,80 100,60 T200,40 T300,50 T400,20 L400,120 L0,120 Z" fill="url(#chartGrad)" />
                  <path d="M0,100 Q50,80 100,60 T200,40 T300,50 T400,20" fill="none" stroke="#22C55E" strokeWidth="2.5" />
                </svg>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {['📦 Inventory: 94%', '👥 Staff: 8 active', '🔔 Alerts: 2', '⭐ Rating: 4.9'].map(item => (
                  <div key={item} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#CBD5E1', border: '1px solid rgba(255,255,255,0.04)' }}>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ STATS — Social Proof ═══════ */}
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

      {/* ═══════ FEATURES ═══════ */}
      <section className="l-section" id="features" aria-label="Features">
        <div className="l-section-inner">
          <div className="l-section-header">
            <div className="l-section-badge">{t('features_badge')}</div>
            <h2>{t('features_title')}</h2>
            <p>{t('features_subtitle')}</p>
          </div>
          <div className="l-features-grid">
            {FEATURES.map((f, i) => (
              <div key={i} className="l-feat-card">
                <div className="l-feat-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ AI SECTION ═══════ */}
      <section className="l-ai">
        <div className="l-ai-inner">
          <div className="l-section-header">
            <div className="l-section-badge">{t('ai_badge')}</div>
            <h2>{t('ai_title')}</h2>
            <p>{t('ai_subtitle')}</p>
          </div>

          <div className="l-ai-visual">
            {['Machine Learning', 'Natural Language', 'Predictive Analytics', 'Smart Automation', 'Real-time Insights'].map(chip => (
              <div key={chip} className="l-ai-chip">
                <span style={{ fontSize: 14 }}>⚡</span> {chip}
              </div>
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

          <div className="l-ai-quote">
            <p>{t('ai_quote')}</p>
          </div>
        </div>
      </section>

      {/* ═══════ HOW IT WORKS ═══════ */}
      <section className="l-section l-section-alt">
        <div className="l-section-inner">
          <div className="l-section-header">
            <div className="l-section-badge">{t('how_badge')}</div>
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

      {/* ═══════ PRICING ═══════ */}
      <section className="l-section" id="pricing" aria-label="Pricing">
        <div className="l-section-inner">
          <div className="l-section-header">
            <div className="l-section-badge">{t('pricing_badge')}</div>
            <h2>{t('pricing_title')}</h2>
            <p>{t('pricing_subtitle')}</p>
          </div>
          <div className="l-pricing-grid">
            {PLANS.map((plan, i) => (
              <div key={i} className={`l-price-card ${plan.popular ? 'popular' : ''}`}>
                {plan.popular && <div className="l-price-popular-tag">{t('plan_growth_popular')}</div>}
                <div className="l-price-name">{plan.name}</div>
                <div className="l-price-desc">{plan.desc}</div>
                {plan.price ? (
                  <div className="l-price-amount">€{plan.price}<span className="l-price-period">{t('pricing_per_month')}</span></div>
                ) : (
                  <div className="l-price-amount" style={{ fontSize: 28 }}>{t('plan_enterprise_price')}</div>
                )}
                <div className="l-price-stores">{plan.stores}</div>
                <div className="l-price-trial">{t('pricing_trial')}</div>
                <ul className="l-price-features">
                  {plan.features.map((f, j) => <li key={j}>{f}</li>)}
                </ul>
                {plan.price ? (
                  <Link href="/signup" className="l-btn l-btn-primary" style={{ width: '100%' }}>
                    {t('pricing_cta')}
                  </Link>
                ) : (
                  <a href="https://calendly.com" target="_blank" rel="noopener noreferrer" className="l-btn l-btn-secondary" style={{ width: '100%' }}>
                    {t('pricing_enterprise_cta')}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ FAQ ═══════ */}
      <section className="l-section l-section-alt" id="faq">
        <div className="l-section-inner">
          <div className="l-section-header">
            <div className="l-section-badge">{t('faq_badge')}</div>
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

      {/* ═══════ CTA ═══════ */}
      <section className="l-cta">
        <h2>{t('cta_title')}</h2>
        <p>{t('cta_subtitle')}</p>
        <Link href="/signup" className="l-btn l-btn-primary l-btn-lg">{t('cta_button')}</Link>
        <div className="l-cta-note">{t('cta_note')}</div>
      </section>
      </main>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="l-footer">
        <div className="l-footer-inner">
          <div className="l-footer-grid">
            <div className="l-footer-brand">
              <a href="#" className="l-nav-logo">
                <div className="l-nav-logo-icon">B</div>
                BrainWare
              </a>
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
          <div className="l-footer-bottom">
            {t('footer_rights')}
          </div>
        </div>
      </footer>
    </div>
  )
}

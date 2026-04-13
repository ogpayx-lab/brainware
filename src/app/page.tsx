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

  return (
    <div className="landing">
      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'BrainWare',
        applicationCategory: 'BusinessApplication', operatingSystem: 'Web',
        description: 'Retail management platform with POS, inventory, employee management, and AI analytics.',
        offers: [
          { '@type': 'Offer', name: 'Starter', price: '49', priceCurrency: 'EUR' },
          { '@type': 'Offer', name: 'Growth', price: '99', priceCurrency: 'EUR' },
          { '@type': 'Offer', name: 'Business', price: '149', priceCurrency: 'EUR' },
        ],
        aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.9', reviewCount: '127' },
      }) }} />

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
        {/* ═══════ HERO ═══════ */}
        <section className="l-hero" aria-label="Hero">
          <div className="l-orb l-orb-1" />
          <div className="l-orb l-orb-2" />
          <div className="l-hero-inner">
            <div>
              <div className="l-hero-badge l-animate">
                <span style={{ fontSize: 16 }}>⚡</span> {t('hero_badge')}
              </div>
              <h1 className="l-animate l-animate-d1">
                {lang === 'it' ? (
                  <>Il sistema operativo<br/>per il tuo <span className="l-gradient">retail</span></>
                ) : lang === 'de' ? (
                  <>Das Betriebssystem<br/>für Ihren <span className="l-gradient">Einzelhandel</span></>
                ) : lang === 'fr' ? (
                  <>Le système d&apos;exploitation<br/>pour votre <span className="l-gradient">commerce</span></>
                ) : lang === 'es' ? (
                  <>El sistema operativo<br/>para tu <span className="l-gradient">comercio</span></>
                ) : (
                  <>The operating system<br/>for your <span className="l-gradient">retail</span></>
                )}
              </h1>
              <p className="l-animate l-animate-d2">{t('hero_subtitle')}</p>
              <div className="l-hero-buttons l-animate l-animate-d3">
                <Link href="/signup" className="l-btn l-btn-primary l-btn-lg">{t('hero_cta')}</Link>
                <a href="#features" className="l-btn l-btn-secondary l-btn-lg">{t('hero_cta_secondary')}</a>
              </div>
              <div className="l-hero-note l-animate l-animate-d4">{t('hero_no_cc')}</div>
            </div>

            {/* Dashboard Mockup with 3D perspective */}
            <div className="l-hero-mockup l-animate l-animate-d2">
              <div className="l-hero-mockup-inner">
                <div className="l-mockup-bar">
                  <div className="l-mockup-dot" style={{ background: '#EF4444' }} />
                  <div className="l-mockup-dot" style={{ background: '#F59E0B' }} />
                  <div className="l-mockup-dot" style={{ background: '#22C55E' }} />
                  <div className="l-mockup-url">app.brainware.io/dashboard</div>
                </div>
                <div className="l-mockup-metrics">
                  {[
                    { label: 'Revenue', value: '€12,480', change: '+18.2%', color: '#22C55E' },
                    { label: 'Orders', value: '284', change: '+12.5%', color: '#3B82F6' },
                    { label: 'Customers', value: '1,205', change: '+7.3%', color: '#8B5CF6' },
                  ].map(m => (
                    <div key={m.label} className="l-mockup-metric">
                      <div className="l-mockup-metric-label">{m.label}</div>
                      <div className="l-mockup-metric-value">{m.value}</div>
                      <div className="l-mockup-metric-change" style={{ color: m.color }}>↑ {m.change}</div>
                    </div>
                  ))}
                </div>
                <div className="l-mockup-chart">
                  <div className="l-mockup-chart-label">Revenue Overview — Last 6 months</div>
                  <svg viewBox="0 0 400 100" style={{ width: '100%', height: 'auto' }}>
                    <defs>
                      <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22C55E" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#22C55E" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M0,85 C40,80 60,70 100,55 S160,25 200,30 S280,45 320,35 S380,15 400,10 L400,100 L0,100 Z" fill="url(#cg)" />
                    <path d="M0,85 C40,80 60,70 100,55 S160,25 200,30 S280,45 320,35 S380,15 400,10" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" />
                    <circle cx="400" cy="10" r="4" fill="#22C55E">
                      <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" />
                    </circle>
                  </svg>
                </div>
                <div className="l-mockup-pills">
                  {['📦 Inventory: 94%', '👥 Staff: 8 active', '🔔 Alerts: 2 new', '⭐ Rating: 4.9/5'].map(item => (
                    <div key={item} className="l-mockup-pill">{item}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════ STATS ═══════ */}
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

        {/* ═══════ AI SECTION ═══════ */}
        <section className="l-ai" aria-label="AI Features">
          <div className="l-ai-inner">
            <div className="l-section-header">
              <div className="l-section-badge">🧠 {t('ai_badge')}</div>
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
              <p>&ldquo;{t('ai_quote')}&rdquo;</p>
            </div>
          </div>
        </section>

        {/* ═══════ HOW IT WORKS ═══════ */}
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

        {/* ═══════ PRICING ═══════ */}
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
                    <div className="l-price-amount" style={{ fontSize: 32 }}>{t('plan_enterprise_price')}</div>
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

        {/* ═══════ FAQ ═══════ */}
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

        {/* ═══════ CTA ═══════ */}
        <section className="l-cta" aria-label="Call to action">
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
          <div className="l-footer-bottom">{t('footer_rights')}</div>
        </div>
      </footer>
    </div>
  )
}

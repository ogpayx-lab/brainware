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

          <div className="l-hero-inner">
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

          {/* ── Platform Video Demo ── */}
          <div className="l-hero-visual l-animate l-animate-d5">
            <div className="l-video-container">
              <div className="l-video-toolbar">
                <div className="l-dash-dots">
                  <div className="l-dash-dot" style={{ background: '#EF4444' }} />
                  <div className="l-dash-dot" style={{ background: '#F59E0B' }} />
                  <div className="l-dash-dot" style={{ background: '#22C55E' }} />
                </div>
                <div className="l-dash-url">
                  <span style={{ marginRight: 6, fontSize: 10, color: '#22C55E' }}>🔒</span>
                  app.brainware.io
                </div>
              </div>
              <div className="l-video-content">
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  poster="/demo-poster.jpg"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '0 0 20px 20px' }}
                >
                  <source src="/demo.mp4" type="video/mp4" />
                  <source src="/demo.webm" type="video/webm" />
                </video>
                {/* Fallback: shown until you add /public/demo.mp4 */}
                <div className="l-video-fallback">
                  <div className="l-video-fallback-grid">
                    {[
                      { icon: '📊', label: 'Dashboard', desc: 'Real-time KPIs' },
                      { icon: '🛒', label: 'POS', desc: 'Smart checkout' },
                      { icon: '📦', label: 'Inventory', desc: 'Live tracking' },
                      { icon: '🤖', label: 'AI Insights', desc: 'Auto reports' },
                    ].map(f => (
                      <div key={f.label} className="l-video-fallback-item">
                        <div className="l-video-fallback-icon">{f.icon}</div>
                        <div className="l-video-fallback-label">{f.label}</div>
                        <div className="l-video-fallback-desc">{f.desc}</div>
                      </div>
                    ))}
                  </div>
                  <div className="l-video-fallback-note">
                    Interactive platform demo — coming soon
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

        {/* ═══ PROBLEMS ═══ */}
        <section className="l-section l-section-white" aria-label="Problems we solve">
          <div className="l-section-inner">
            <div className="l-section-header">
              <div className="l-section-badge">🎯 {t('problems_badge')}</div>
              <h2>{t('problems_title')}</h2>
              <p>{t('problems_subtitle')}</p>
            </div>
            <div className="l-problems-grid">
              {[
                { icon: '📦', num: '1', titleKey: 'prob1_title', probKey: 'prob1_problem', solKey: 'prob1_solution' },
                { icon: '👥', num: '2', titleKey: 'prob2_title', probKey: 'prob2_problem', solKey: 'prob2_solution' },
                { icon: '💰', num: '3', titleKey: 'prob3_title', probKey: 'prob3_problem', solKey: 'prob3_solution' },
                { icon: '📊', num: '4', titleKey: 'prob4_title', probKey: 'prob4_problem', solKey: 'prob4_solution' },
                { icon: '🏪', num: '5', titleKey: 'prob5_title', probKey: 'prob5_problem', solKey: 'prob5_solution' },
                { icon: '✅', num: '6', titleKey: 'prob6_title', probKey: 'prob6_problem', solKey: 'prob6_solution' },
              ].map((item) => (
                <div key={item.num} className="l-problem-card">
                  <div className="l-problem-header">
                    <span className="l-problem-icon">{item.icon}</span>
                    <h3>{t(item.titleKey)}</h3>
                  </div>
                  <div className="l-problem-body">
                    <div className="l-problem-before">
                      <div className="l-problem-label">❌ {t('prob_label_problem')}</div>
                      <p>{t(item.probKey)}</p>
                    </div>
                    <div className="l-problem-after">
                      <div className="l-problem-label l-problem-label-green">✓ {t('prob_label_solution')}</div>
                      <p>{t(item.solKey)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
        <section className="l-section l-section-white" aria-label="How it works">
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
        <section className="l-section l-section-white" id="faq" aria-label="FAQ">
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
        <div className="l-cta-wrap">
          <section className="l-cta" aria-label="Call to action">
            <h2>{t('cta_title')}</h2>
            <p>{t('cta_subtitle')}</p>
            <Link href="/signup" className="l-btn l-btn-primary l-btn-lg">{t('cta_button')}</Link>
            <div className="l-cta-note">{t('cta_note')}</div>
          </section>
        </div>
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

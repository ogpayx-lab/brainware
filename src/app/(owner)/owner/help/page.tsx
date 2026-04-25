'use client'
import { useState } from 'react'
import { HELP_CATEGORIES, HELP_ARTICLES, HelpArticle } from '@/lib/help-articles'

export default function OwnerHelpPage() {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null)

  // Filter articles for owner
  const articles = HELP_ARTICLES.filter(a => a.role === 'owner' || a.role === 'both')

  // Apply search + category filter
  const filtered = articles.filter(a => {
    const matchCategory = selectedCategory === 'all' || a.category === selectedCategory
    const matchSearch = !search || 
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.summary.toLowerCase().includes(search.toLowerCase()) ||
      a.steps.some(s => s.toLowerCase().includes(search.toLowerCase()))
    return matchCategory && matchSearch
  })

  // Group by category
  const grouped: Record<string, HelpArticle[]> = {}
  for (const a of filtered) {
    if (!grouped[a.category]) grouped[a.category] = []
    grouped[a.category].push(a)
  }

  return (
    <div>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h2 style={{ marginBottom: 6 }}>📖 Help Center</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Guide e procedure per utilizzare BrainWare al meglio
        </p>
      </div>

      {/* Search */}
      <div style={{ maxWidth: 500, margin: '0 auto 20px', position: 'relative' }}>
        <input
          type="text"
          placeholder="🔍 Cerca nelle guide..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '12px 16px 12px 16px', fontSize: 14,
            border: '2px solid var(--border-default)', borderRadius: 10,
            background: 'var(--bg-primary)', color: 'var(--text-primary)',
            outline: 'none', transition: 'border-color 0.2s',
          }}
          onFocus={e => e.target.style.borderColor = '#6366F1'}
          onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
        />
      </div>

      {/* Category pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={() => setSelectedCategory('all')}
          style={{
            padding: '6px 14px', borderRadius: 20, border: '1px solid',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: selectedCategory === 'all' ? '#6366F1' : 'var(--bg-primary)',
            color: selectedCategory === 'all' ? 'white' : 'var(--text-secondary)',
            borderColor: selectedCategory === 'all' ? '#6366F1' : 'var(--border-default)',
          }}>
          Tutti
        </button>
        {HELP_CATEGORIES.filter(c => articles.some(a => a.category === c.key)).map(cat => (
          <button
            key={cat.key}
            onClick={() => setSelectedCategory(cat.key)}
            style={{
              padding: '6px 14px', borderRadius: 20, border: '1px solid',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: selectedCategory === cat.key ? '#6366F1' : 'var(--bg-primary)',
              color: selectedCategory === cat.key ? 'white' : 'var(--text-secondary)',
              borderColor: selectedCategory === cat.key ? '#6366F1' : 'var(--border-default)',
            }}>
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* Articles */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
          <p>Nessun risultato per "{search}"</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {Object.entries(grouped).map(([catKey, catArticles]) => {
            const cat = HELP_CATEGORIES.find(c => c.key === catKey)
            return (
              <div key={catKey}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 20 }}>{cat?.icon}</span>
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>{cat?.label}</h3>
                  <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {catArticles.map(article => (
                    <div
                      key={article.id}
                      style={{
                        background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
                        borderRadius: 10, overflow: 'hidden',
                        transition: 'box-shadow 0.2s',
                      }}
                    >
                      {/* Article header */}
                      <div
                        onClick={() => setExpandedArticle(expandedArticle === article.id ? null : article.id)}
                        style={{
                          padding: '14px 16px', cursor: 'pointer',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                            {article.title}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{article.summary}</div>
                        </div>
                        <span style={{
                          fontSize: 18, color: 'var(--text-tertiary)',
                          transform: expandedArticle === article.id ? 'rotate(90deg)' : 'none',
                          transition: 'transform 0.2s', flexShrink: 0, marginLeft: 12,
                        }}>›</span>
                      </div>

                      {/* Expanded content */}
                      {expandedArticle === article.id && (
                        <div style={{
                          padding: '0 16px 16px', borderTop: '1px solid var(--border-subtle)',
                          background: 'var(--bg-surface)',
                        }}>
                          {/* Steps */}
                          <div style={{ padding: '14px 0 0' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#6366F1', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Procedura
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {article.steps.map((step, i) => (
                                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                  <span style={{
                                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                                    background: '#6366F1', color: 'white', fontSize: 11, fontWeight: 700,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}>
                                    {i + 1}
                                  </span>
                                  <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-primary)', paddingTop: 2 }}>
                                    {step}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Tips */}
                          {article.tips && article.tips.length > 0 && (
                            <div style={{ marginTop: 14, padding: '10px 12px', background: '#FEF3C7', borderRadius: 8, border: '1px solid #FCD34D' }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#92400E', marginBottom: 6 }}>💡 SUGGERIMENTI</div>
                              {article.tips.map((tip, i) => (
                                <div key={i} style={{ fontSize: 12, color: '#78350F', lineHeight: 1.5, marginBottom: i < article.tips!.length - 1 ? 4 : 0 }}>
                                  • {tip}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

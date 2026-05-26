'use client'
import { useState } from 'react'
import Link from 'next/link'
import { HELP_CATEGORIES, HELP_ARTICLES, HelpArticle } from '@/lib/help-articles'
import { BottomNav } from '@/components/employee/BottomNav'
import { useT } from '@/lib/i18n'

export default function EmployeeHelpPage() {
  const t = useT()
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null)

  const articles = HELP_ARTICLES.filter(a => a.role === 'employee' || a.role === 'both')

  const filtered = articles.filter(a => {
    const matchCategory = selectedCategory === 'all' || a.category === selectedCategory
    const matchSearch = !search ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.summary.toLowerCase().includes(search.toLowerCase()) ||
      a.steps.some(s => s.toLowerCase().includes(search.toLowerCase()))
    return matchCategory && matchSearch
  })

  const grouped: Record<string, HelpArticle[]> = {}
  for (const a of filtered) {
    if (!grouped[a.category]) grouped[a.category] = []
    grouped[a.category].push(a)
  }

  return (
    <div className="page" style={{ paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)', padding: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        <Link href="/employee/dashboard" style={{ textDecoration: 'none', color: 'var(--text-primary)', fontSize: 20 }}>←</Link>
        <div>
          <h3 style={{ marginBottom: 2 }}>📖 Help Center</h3>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Guide per utilizzare BrainWare</p>
        </div>
      </div>

      <div style={{ padding: 'var(--space-lg)' }}>
        {/* Search */}
        <input
          type="text"
          placeholder="🔍 Cerca nelle guide..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input"
          style={{ marginBottom: 14, fontSize: 14 }}
        />

        {/* Category pills - scrollable */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
          <button
            onClick={() => setSelectedCategory('all')}
            style={{
              padding: '6px 12px', borderRadius: 16, border: '1px solid',
              fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
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
                padding: '6px 12px', borderRadius: 16, border: '1px solid',
                fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
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
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🔍</div>
            <p>Nessun risultato per "{search}"</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {Object.entries(grouped).map(([catKey, catArticles]) => {
              const cat = HELP_CATEGORIES.find(c => c.key === catKey)
              return (
                <div key={catKey}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <span style={{ fontSize: 18 }}>{cat?.icon}</span>
                    <h4 style={{ fontSize: 14 }}>{cat?.label}</h4>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {catArticles.map(article => (
                      <div key={article.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div
                          onClick={() => setExpandedArticle(expandedArticle === article.id ? null : article.id)}
                          style={{ padding: '12px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{article.title}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{article.summary}</div>
                          </div>
                          <span style={{
                            fontSize: 16, color: 'var(--text-tertiary)',
                            transform: expandedArticle === article.id ? 'rotate(90deg)' : 'none',
                            transition: 'transform 0.2s', marginLeft: 8,
                          }}>›</span>
                        </div>

                        {expandedArticle === article.id && (
                          <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border-subtle)' }}>
                            <div style={{ paddingTop: 12 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: '#6366F1', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Procedura
                              </div>
                              {article.steps.map((step, i) => (
                                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
                                  <span style={{
                                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                                    background: '#6366F1', color: 'white', fontSize: 10, fontWeight: 700,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}>{i + 1}</span>
                                  <span style={{ fontSize: 12, lineHeight: 1.5, paddingTop: 2 }}>{step}</span>
                                </div>
                              ))}
                            </div>
                            {article.tips && (
                              <div style={{ marginTop: 10, padding: '8px 10px', background: '#FEF3C7', borderRadius: 6, border: '1px solid #FCD34D' }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#92400E', marginBottom: 4 }}>💡 SUGGERIMENTI</div>
                                {article.tips.map((tip, i) => (
                                  <div key={i} style={{ fontSize: 11, color: '#78350F', lineHeight: 1.4, marginBottom: 2 }}>• {tip}</div>
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

      <BottomNav />
    </div>
  )
}

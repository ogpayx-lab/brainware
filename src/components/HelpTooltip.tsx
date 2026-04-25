'use client'
import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { PAGE_TIPS } from '@/lib/help-articles'

export function HelpTooltip() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Find matching tips for current page
  const tips = PAGE_TIPS[pathname]

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  if (!tips) return null

  return (
    <div ref={ref} style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9990 }}>
      {/* Floating ? button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: 44, height: 44, borderRadius: '50%',
          background: open ? '#6366F1' : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
          color: 'white', border: 'none', fontSize: 20, fontWeight: 700,
          cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(99,102,241,0.5)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(99,102,241,0.4)' }}
        title="Aiuto su questa pagina"
      >
        {open ? '✕' : '?'}
      </button>

      {/* Tips panel */}
      {open && (
        <div style={{
          position: 'absolute', bottom: 56, right: 0,
          width: 300, maxHeight: 400, overflowY: 'auto',
          background: 'white', borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08)',
          border: '1px solid #E5E7EB',
          animation: 'helpSlideUp 0.2s ease-out',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 16px 10px', borderBottom: '1px solid #F3F4F6',
            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            borderRadius: '12px 12px 0 0', color: 'white',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>💡 {tips.title}</div>
            <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>Suggerimenti per questa pagina</div>
          </div>

          {/* Tips list */}
          <div style={{ padding: '12px 16px' }}>
            {tips.tips.map((tip, i) => (
              <div key={i} style={{
                display: 'flex', gap: 8, marginBottom: i < tips.tips.length - 1 ? 10 : 0,
                fontSize: 13, lineHeight: 1.5, color: '#374151',
              }}>
                <span style={{ color: '#6366F1', fontSize: 16, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>›</span>
                <span>{tip}</span>
              </div>
            ))}
          </div>

          {/* Footer link */}
          <div style={{
            padding: '8px 16px 12px', borderTop: '1px solid #F3F4F6',
            textAlign: 'center',
          }}>
            <a href={pathname.includes('/owner/') ? '/owner/help' : '/employee/help'}
              style={{ fontSize: 12, color: '#6366F1', fontWeight: 600, textDecoration: 'none' }}>
              📖 Apri Help Center completo
            </a>
          </div>
        </div>
      )}

      <style>{`
        @keyframes helpSlideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

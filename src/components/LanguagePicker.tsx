'use client'

import { useState } from 'react'
import { useLanguage, LANGUAGES } from '@/lib/i18n'

export function LanguagePicker() {
  const { lang, setLang } = useLanguage()
  const [open, setOpen] = useState(false)
  const current = LANGUAGES.find(l => l.code === lang) ?? LANGUAGES[0]

  return (
    <div style={{ position: 'fixed', top: 14, right: 20, zIndex: 1000 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 10,
          background: 'var(--bg-primary)', border: '1px solid var(--border-default)',
          cursor: 'pointer', fontSize: 13, fontWeight: 500,
          color: 'var(--text-secondary)', transition: 'all 0.15s',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}
      >
        <span style={{ fontSize: 18 }}>{current.flag}</span>
        <span style={{ fontSize: 12 }}>{current.code.toUpperCase()}</span>
        <span style={{ fontSize: 10, opacity: 0.5, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 6,
            background: 'var(--bg-primary)', border: '1px solid var(--border-default)',
            borderRadius: 12, padding: 6, zIndex: 1000,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            minWidth: 160,
          }}>
            {LANGUAGES.map(l => (
              <button
                key={l.code}
                onClick={() => { setLang(l.code); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '8px 12px', borderRadius: 8, border: 'none',
                  background: lang === l.code ? 'var(--brand-primary-light)' : 'transparent',
                  cursor: 'pointer', fontSize: 13, textAlign: 'left',
                  fontWeight: lang === l.code ? 600 : 400,
                  color: lang === l.code ? 'var(--brand-primary)' : 'var(--text-secondary)',
                  transition: 'background 0.1s',
                }}
              >
                <span style={{ fontSize: 18 }}>{l.flag}</span>
                <span>{l.label}</span>
                {lang === l.code && <span style={{ marginLeft: 'auto', fontSize: 12 }}>✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import it from './translations/it'
import en from './translations/en'
import de from './translations/de'
import fr from './translations/fr'
import es from './translations/es'
import pt from './translations/pt'

export type Lang = 'it' | 'en' | 'de' | 'fr' | 'es' | 'pt'

export const LANGUAGES: { code: Lang; flag: string; label: string }[] = [
  { code: 'it', flag: '🇮🇹', label: 'Italiano' },
  { code: 'en', flag: '🇬🇧', label: 'English' },
  { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
  { code: 'fr', flag: '🇫🇷', label: 'Français' },
  { code: 'es', flag: '🇪🇸', label: 'Español' },
  { code: 'pt', flag: '🇧🇷', label: 'Português' },
]

const translations: Record<Lang, any> = { it, en, de, fr, es, pt }

type LanguageContextType = {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'it',
  setLang: () => {},
  t: (key: string) => key,
})

// Deep get a nested value by dot-separated key
function deepGet(obj: any, path: string): string {
  const parts = path.split('.')
  let current = obj
  for (const part of parts) {
    if (current == null) return path
    current = current[part]
  }
  return typeof current === 'string' ? current : path
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('it')

  useEffect(() => {
    const saved = localStorage.getItem('brainware_lang') as Lang | null
    if (saved && translations[saved]) {
      setLangState(saved)
    }
  }, [])

  const setLang = (newLang: Lang) => {
    setLangState(newLang)
    localStorage.setItem('brainware_lang', newLang)
  }

  const t = (key: string): string => {
    // First try current language, fallback to Italian
    const value = deepGet(translations[lang], key)
    if (value !== key) return value
    return deepGet(translations.it, key)
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

/** Get the translation function */
export function useT() {
  const { t } = useContext(LanguageContext)
  return t
}

/** Get current language and setter */
export function useLanguage() {
  const { lang, setLang } = useContext(LanguageContext)
  return { lang, setLang }
}

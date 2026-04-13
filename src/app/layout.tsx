import type { Metadata } from 'next'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: 'BrainWare — Software Gestionale Retail | POS, Inventario, Dipendenti & AI',
  description: 'BrainWare è il gestionale completo per negozi retail, CBD shop e vape store. POS intelligente, inventario in tempo reale, gestione dipendenti, analytics AI e multi-store. Prova 30 giorni gratis.',
  keywords: 'gestionale retail, software negozio, POS retail, gestione inventario, gestione dipendenti, CBD shop software, vape store gestionale, multi-store management, retail AI, punto vendita',
  openGraph: {
    title: 'BrainWare — Il Sistema Operativo per il Retail Moderno',
    description: 'POS, inventario, dipendenti, analytics e AI in un\'unica piattaforma. Progettato per CBD shop, vape store e qualsiasi retail. 30 giorni gratis.',
    type: 'website',
    locale: 'it_IT',
    siteName: 'BrainWare',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BrainWare — Software Gestionale Retail con AI',
    description: 'Gestisci il tuo negozio con intelligenza artificiale. POS, inventario, dipendenti e analytics in un\'unica piattaforma.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700&family=DM+Sans:wght@400;500;600&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const PRODUCTS_DATA = [
  { name: "Accendino MM", category: "accessories", stock: 22 },
  { name: "Accendino no logo", category: "accessories", stock: 76 },
  { name: "Actitube filtri pack of 10 pcs", category: "accessories", stock: 34 },
  { name: "Amnesia 2g", category: "flowers", stock: 0 },
  { name: "Amnesia 3g", category: "flowers", stock: 0 },
  { name: "Amnesia 5g", category: "flowers", stock: 0 },
  { name: "Amnesia Sfuso", category: "flowers", stock: 0 },
  { name: "Bob my Box", category: "accessories", stock: 10 },
  { name: "Bong Big", category: "accessories", stock: 0 },
  { name: "Bong Small", category: "accessories", stock: 0 },
  { name: "Box da 3 Pre-roll", category: "accessories", stock: 24 },
  { name: "Brain-E (Happy Caps) DISPLAY", category: "food", stock: 0 },
  { name: "Bubble Hash 10g", category: "hashish", stock: 19 },
  { name: "Bubble Hash 2g", category: "hashish", stock: 0 },
  { name: "Bubble Hash 3g", category: "hashish", stock: 0 },
  { name: "bubble hash Sfuso", category: "hashish", stock: 0 },
  { name: "Cappello MM", category: "clothes", stock: 0 },
  { name: "Cartine MM", category: "accessories", stock: 0 },
  { name: "cartine no logo", category: "accessories", stock: 70 },
  { name: "Cassata Kush 2g", category: "flowers", stock: 0 },
  { name: "Cassata Kush 3g", category: "flowers", stock: 0 },
  { name: "Cassata Kush 5g", category: "flowers", stock: 0 },
  { name: "Cassata Kush Sfuso", category: "flowers", stock: 0 },
  { name: "CBD 15MG Cookies Pouche", category: "food", stock: 0 },
  { name: "CBD Anti-Aging Cream", category: "cosmetics", stock: 0 },
  { name: "CBD Brownie", category: "food", stock: 0 },
  { name: "CBD Day Cream", category: "cosmetics", stock: 0 },
  { name: "CBD Eye Gel", category: "cosmetics", stock: 0 },
  { name: "CBD Eye Gel Roller", category: "cosmetics", stock: 0 },
  { name: "CBD Face Serum", category: "cosmetics", stock: 0 },
  { name: "CBD Foot Cream", category: "cosmetics", stock: 0 },
  { name: "CBD heating Balm", category: "cosmetics", stock: 0 },
  { name: "CBD Lip Balm", category: "cosmetics", stock: 0 },
  { name: "CBD Night Cream", category: "cosmetics", stock: 0 },
  { name: "CBD Nose Spray", category: "cosmetics", stock: 0 },
  { name: "CBD tea", category: "food", stock: 0 },
  { name: "charas 2g", category: "hashish", stock: 0 },
  { name: "charas 3g", category: "hashish", stock: 0 },
  { name: "charas 5g", category: "hashish", stock: 0 },
  { name: "charas Sfuso", category: "hashish", stock: 0 },
  { name: "Cherry Pie 2g", category: "flowers", stock: 12 },
  { name: "Cherry Pie 3g", category: "flowers", stock: 8 },
  { name: "Cherry Pie 5g", category: "flowers", stock: 12 },
  { name: "Cherry Pie Sfuso", category: "flowers", stock: 0 },
  { name: "Clipper Accendino", category: "accessories", stock: 28 },
  { name: "Color Changing Pipe", category: "accessories", stock: 0 },
  { name: "Cookies 2g", category: "flowers", stock: 0 },
  { name: "Cookies 3g", category: "flowers", stock: 0 },
  { name: "Cookies 5g", category: "flowers", stock: 2 },
  { name: "Cookies Sfuso", category: "flowers", stock: 0 },
  { name: "Crema corpo Cbd lenisan", category: "cosmetics", stock: 13 },
  { name: "Crema viso Cbd lenisan", category: "cosmetics", stock: 0 },
  { name: "Critical 2g", category: "flowers", stock: 0 },
  { name: "Critical 3g", category: "flowers", stock: 0 },
  { name: "Critical 5g", category: "flowers", stock: 0 },
  { name: "Critical Sfuso", category: "flowers", stock: 0 },
  { name: "crumble 2g", category: "hashish", stock: 0 },
  { name: "crumble 3g", category: "hashish", stock: 0 },
  { name: "crumble 5g", category: "hashish", stock: 0 },
  { name: "crumble Sfuso", category: "hashish", stock: 0 },
  { name: "Cyclones Hemp cones (blunt)", category: "accessories", stock: 0 },
  { name: "dance-e (Happy Caps) DISPLAY", category: "food", stock: 0 },
  { name: "Dermopurificante cane Verdesativa", category: "cosmetics", stock: 1 },
  { name: "Dip Device 510 battery", category: "vape", stock: 0 },
  { name: "Dry sift 10g", category: "hashish", stock: 0 },
  { name: "dry sift 2g", category: "hashish", stock: 0 },
  { name: "dry sift 3g", category: "hashish", stock: 0 },
  { name: "dry sift Sfuso", category: "hashish", stock: 0 },
  { name: "Energy-E (Happy Caps) DISPLAY", category: "food", stock: 0 },
  { name: "Euphory-E (Happy Caps) DISPLAY", category: "food", stock: 10 },
  { name: "Felpa L", category: "clothes", stock: 0 },
  { name: "Felpa M", category: "clothes", stock: 0 },
  { name: "Felpa S", category: "clothes", stock: 0 },
  { name: "Felpa XL", category: "clothes", stock: 0 },
  { name: "Felpa XXL", category: "clothes", stock: 0 },
  { name: "Felpa Zip L", category: "clothes", stock: 0 },
  { name: "Felpa Zip M", category: "clothes", stock: 0 },
  { name: "Felpa Zip S", category: "clothes", stock: 0 },
  { name: "Felpa Zip XL", category: "clothes", stock: 0 },
  { name: "Felpa Zip XXL", category: "clothes", stock: 0 },
  { name: "Filter Tips", category: "accessories", stock: 28 },
  { name: "Gel lubrificante Cbd lenisan", category: "cosmetics", stock: 1 },
  { name: "Gelato 2g", category: "flowers", stock: 0 },
  { name: "Gelato 3g", category: "flowers", stock: 0 },
  { name: "Gelato 5g", category: "flowers", stock: 5 },
  { name: "Gelato Sfuso", category: "flowers", stock: 0 },
  { name: "Gorilla Mandarine 2g", category: "flowers", stock: 0 },
  { name: "Gorilla Mandarine 3g", category: "flowers", stock: 0 },
  { name: "Gorilla Mandarine 5g", category: "flowers", stock: 0 },
  { name: "Gorilla Mandarine Sfuso", category: "flowers", stock: 0 },
  { name: "Grinder Card", category: "accessories", stock: 0 },
  { name: "Grinder MM", category: "accessories", stock: 29 },
  { name: "Grinder no logo", category: "accessories", stock: 11 },
  { name: "Grinder Raw", category: "accessories", stock: 0 },
  { name: "Heavenly-E (Happy Caps) DISPLAY", category: "food", stock: 14 },
  { name: "Honey with hemp 65g", category: "food", stock: 0 },
  { name: "ice o lator 10g", category: "hashish", stock: 0 },
  { name: "ice o lator 2g", category: "hashish", stock: 0 },
  { name: "ice o lator 3g", category: "hashish", stock: 0 },
  { name: "ice o lator Sfuso", category: "hashish", stock: 0 },
  { name: "Igienizzante cane Verdesativa", category: "cosmetics", stock: 1 },
  { name: "Incenso", category: "accessories", stock: 0 },
  { name: "Kit Pipe + Grinder", category: "accessories", stock: 11 },
  { name: "Latte Corpo Verdesativa", category: "cosmetics", stock: 2 },
  { name: "Latte Detergente Verdesativa", category: "cosmetics", stock: 0 },
  { name: "Lemon Hash 10g", category: "hashish", stock: 10 },
  { name: "Lemon hash 2g", category: "hashish", stock: -1 },
  { name: "Lemon hash 3g", category: "hashish", stock: 0 },
  { name: "Lemon hash Sfuso", category: "hashish", stock: 0 },
  { name: "Lions's Name gummies", category: "food", stock: 13 },
  { name: "Lolly Bubbly Billy", category: "food", stock: 0 },
  { name: "Magic oil lenisan", category: "cosmetics", stock: 0 },
  { name: "Mango 2g", category: "flowers", stock: 0 },
  { name: "Mango 3g", category: "flowers", stock: 19 },
  { name: "Mango 5g", category: "flowers", stock: 8 },
  { name: "Mango Sfuso", category: "flowers", stock: 0 },
  { name: "Metal Pipe", category: "accessories", stock: 0 },
  { name: "OG Kush 2G", category: "flowers", stock: 16 },
  { name: "OG Kush 3G", category: "flowers", stock: 19 },
  { name: "OG Kush 5G", category: "flowers", stock: 16 },
  { name: "OG Kush Sfuso", category: "flowers", stock: 0 },
  { name: "OIL hemp 10%", category: "oils", stock: 11 },
  { name: "OIL hemp 20%", category: "oils", stock: 17 },
  { name: "OIL hemp 30%", category: "oils", stock: 11 },
  { name: "OIL Lemon 10%", category: "oils", stock: 9 },
  { name: "OIL menta 10%", category: "oils", stock: 15 },
  { name: "OIL orange 10%", category: "oils", stock: 25 },
  { name: "OIL pet 10%", category: "oils", stock: 0 },
  { name: "Omaggio 1g", category: "flowers", stock: 0 },
  { name: "Party-E (Happy Caps) DISPLAY", category: "food", stock: 0 },
  { name: "Pax Maintenance Kit", category: "accessories", stock: 1 },
  { name: "Pax Mini", category: "vape", stock: 3 },
  { name: "Pax plus", category: "vape", stock: 3 },
  { name: "Pax Puck Press", category: "accessories", stock: 7 },
  { name: "Pax Water pipe adaptor", category: "accessories", stock: 1 },
  { name: "piattini pax", category: "accessories", stock: 0 },
  { name: "Piattini Raw", category: "accessories", stock: 13 },
  { name: "Plants for pet CBD Calming Balm Stick 12g", category: "cosmetics", stock: 0 },
  { name: "Plants for pet CBD Fortifying Balm Stick 12g", category: "cosmetics", stock: 0 },
  { name: "Plants for pet CBD Repair Balm Stick 12g", category: "cosmetics", stock: 0 },
  { name: "Porta Pre-roll", category: "accessories", stock: 0 },
  { name: "Pre-roll", category: "accessories", stock: 2 },
  { name: "Premium Hemp cones (blunt)", category: "accessories", stock: 29 },
  { name: "RAW Drawstring Bag Black", category: "accessories", stock: 0 },
  { name: "recover-e (Happy Caps) DISPLAY", category: "food", stock: 0 },
  { name: "relax-e (Happy Caps) DISPLAY", category: "food", stock: 0 },
  { name: "Remedy Cannabis Gummies MM", category: "food", stock: 0 },
  { name: "Runtz 2g", category: "flowers", stock: 0 },
  { name: "Runtz 3g", category: "flowers", stock: 0 },
  { name: "Runtz 5g", category: "flowers", stock: 0 },
  { name: "Runtz Sfuso", category: "flowers", stock: 0 },
  { name: "Scarpe", category: "clothes", stock: 0 },
  { name: "Semi Amnesia AUTO pack 3", category: "seeds", stock: 7 },
  { name: "Semi Banana Punch AUTO pack 3", category: "seeds", stock: 6 },
  { name: "semi Cookies FEM pack 3", category: "seeds", stock: 7 },
  { name: "Semi Critical Kush auto pack 3", category: "seeds", stock: 7 },
  { name: "Semi Dosidos AUTO pack 3", category: "seeds", stock: 7 },
  { name: "Semi Gelato FAST pack 3", category: "seeds", stock: 7 },
  { name: "Semi Gorilla FAST pack 3", category: "seeds", stock: 0 },
  { name: "Semi Lemon Haze fast pack 3", category: "seeds", stock: 4 },
  { name: "Semi Mimosa FAST pack 3", category: "seeds", stock: 5 },
  { name: "Semi OG Kush FEM pack 3", category: "seeds", stock: 11 },
  { name: "Semi RUNTZ FEM pack 3", category: "seeds", stock: 5 },
  { name: "Semi Strawberry OG auto pack 3", category: "seeds", stock: 6 },
  { name: "Semi Super Skunk FAST pack 3", category: "seeds", stock: 12 },
  { name: "Semi White Widow", category: "seeds", stock: 1 },
  { name: "sex-e (Happy Caps) DISPLAY", category: "food", stock: 0 },
  { name: "Shampoo", category: "cosmetics", stock: 0 },
  { name: "Shampoo Antiforfora Verdesativa", category: "cosmetics", stock: 1 },
  { name: "Skittles 2g", category: "flowers", stock: 0 },
  { name: "Skittles 3g", category: "flowers", stock: 0 },
  { name: "Skittles 5g", category: "flowers", stock: 0 },
  { name: "Skittles Sfuso", category: "flowers", stock: 0 },
  { name: "Smart stach (grinder smart)", category: "accessories", stock: 0 },
  { name: "Sour Diesel 2g", category: "flowers", stock: 4 },
  { name: "Sour Diesel 3g", category: "flowers", stock: 10 },
  { name: "Sour Diesel 5g", category: "flowers", stock: 12 },
  { name: "space-e (Happy Caps) DISPLAY", category: "food", stock: 0 },
  { name: "Spaghetti Cheese 2g", category: "flowers", stock: 0 },
  { name: "Spaghetti Cheese 3g", category: "flowers", stock: 0 },
  { name: "Spaghetti Cheese 5g", category: "flowers", stock: 0 },
  { name: "Spaghetti Cheese Sfuso", category: "flowers", stock: 0 },
  { name: "Spiral Pipe", category: "accessories", stock: 0 },
  { name: "Strawberry 2g", category: "flowers", stock: 0 },
  { name: "Strawberry 3g", category: "flowers", stock: 0 },
  { name: "Strawberry 5g", category: "flowers", stock: 0 },
  { name: "Strawberry Sfuso", category: "flowers", stock: 0 },
  { name: "Strong Cannabis Gummies MM", category: "food", stock: 28 },
  { name: "Strong Sleep Gummies MM", category: "food", stock: 4 },
  { name: "SUPER LEMON HAZE 2g", category: "flowers", stock: 1 },
  { name: "SUPER LEMON HAZE 3g", category: "flowers", stock: 4 },
  { name: "SUPER LEMON HAZE 5g", category: "flowers", stock: 2 },
  { name: "SUPER LEMON HAZE SFUSO", category: "flowers", stock: 0 },
  { name: "SuperSkunk 2g", category: "flowers", stock: 0 },
  { name: "SuperSkunk 3g", category: "flowers", stock: 8 },
  { name: "SuperSkunk 5g", category: "flowers", stock: 12 },
  { name: "SuperSkunk sfuso", category: "flowers", stock: 0 },
  { name: "Tappetini Raw Black", category: "accessories", stock: 0 },
  { name: "The Dude Cartridge", category: "vape", stock: 0 },
  { name: "trip-e (Happy Caps) DISPLAY", category: "food", stock: 0 },
  { name: "Tshirt L", category: "clothes", stock: 0 },
  { name: "Tshirt M", category: "clothes", stock: 0 },
  { name: "Tshirt Nera S", category: "clothes", stock: 0 },
  { name: "Tshirt S", category: "clothes", stock: 0 },
  { name: "Tshirt XL", category: "clothes", stock: 0 },
  { name: "Tshirt XXL", category: "clothes", stock: 0 },
  { name: "Vape Disposable 2ml", category: "vape", stock: 15 },
  { name: "Vape Kit MamaMary", category: "vape", stock: 10 },
  { name: "Vegan Brownie", category: "food", stock: 0 },
  { name: "Wax CBD 66% 1 g", category: "accessories", stock: 0 },
  { name: "Wax H4 66% 1 g", category: "accessories", stock: 0 },
  { name: "White Widow 2g", category: "flowers", stock: 0 },
  { name: "White Widow 3g", category: "flowers", stock: 0 },
  { name: "White Widow 5g", category: "flowers", stock: 0 },
  { name: "White Widow Sfuso", category: "flowers", stock: 0 },
]

export default function BulkLoadPage() {
  const router = useRouter()
  const supabase = createClient()
  const [storeId, setStoreId] = useState<string | null>(null)
  const [storeName, setStoreName] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('users').select('store_id, role, stores(name)').eq('id', user.id).single()
      if (profile?.role !== 'owner') { router.push('/login'); return }
      setStoreId(profile.store_id)
      setStoreName((profile.stores as any)?.name || 'Store')
    }
    load()
  }, [])

  async function handleLoad() {
    if (!storeId) return
    if (!confirm(`⚠️ ATTENZIONE: Questo cancellerà TUTTI i prodotti esistenti nello store "${storeName}" e li ricaricherà con i dati corretti.\n\nContinuare?`)) return
    setStatus('loading')
    try {
      const res = await fetch('/api/bulk-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: storeId, products: PRODUCTS_DATA }),
      })
      const data = await res.json()
      setResult(data)
      setStatus(data.errors > 0 ? 'error' : 'done')
    } catch (err: any) {
      setResult({ error: err.message })
      setStatus('error')
    }
  }

  const withStock = PRODUCTS_DATA.filter(p => p.stock > 0).length
  const categories = [...new Set(PRODUCTS_DATA.map(p => p.category))]

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', padding: 'var(--space-xl)' }}>
      <h2 style={{ marginBottom: 'var(--space-lg)' }}>📦 Caricamento Prodotti + Stock (v2)</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 'var(--space-xl)' }}>
        Questa pagina <strong>sostituisce completamente</strong> i prodotti nello store <strong>{storeName}</strong> con la lista corretta.
      </p>

      <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>Riepilogo dati</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div><div style={{ fontSize: 28, fontWeight: 700 }}>{PRODUCTS_DATA.length}</div><div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Prodotti totali</div></div>
          <div><div style={{ fontSize: 28, fontWeight: 700 }}>{withStock}</div><div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Con stock &gt; 0</div></div>
          <div><div style={{ fontSize: 28, fontWeight: 700 }}>{categories.length}</div><div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Categorie</div></div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {categories.map(c => (
            <span key={c} className="badge badge-gray" style={{ fontSize: 11 }}>
              {c} ({PRODUCTS_DATA.filter(p => p.category === c).length})
            </span>
          ))}
        </div>
      </div>

      <div style={{ background: 'var(--warning-light)', border: '1px solid var(--warning)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', marginBottom: 'var(--space-lg)', fontSize: 13 }}>
        ⚠️ <strong>Prerequisito:</strong> Prima di procedere, vai nella <strong>Dashboard Supabase → SQL Editor</strong> ed esegui:<br/>
        <code style={{ display: 'block', background: 'rgba(0,0,0,0.05)', padding: 8, borderRadius: 4, marginTop: 8, fontSize: 12, whiteSpace: 'pre-wrap' }}>
{`ALTER TABLE products ALTER COLUMN category TYPE text;`}
        </code>
        <div style={{ marginTop: 6, color: 'var(--text-tertiary)', fontSize: 11 }}>Questo rimuove il vincolo ENUM e permette categorie come seeds, cosmetics, food, ecc.</div>
      </div>

      {status === 'idle' && (
        <button onClick={handleLoad} className="btn btn-primary btn-full" style={{ padding: '14px 24px', fontSize: 16, fontWeight: 700 }}>
          🚀 Sostituisci e carica {PRODUCTS_DATA.length} prodotti in &quot;{storeName}&quot;
        </button>
      )}

      {status === 'loading' && (
        <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-secondary)' }}>
          ⏳ Caricamento in corso... attendere...
        </div>
      )}

      {status === 'done' && result && (
        <div style={{ background: 'var(--success-light)', border: '1px solid var(--brand-primary)', borderRadius: 'var(--radius-md)', padding: 'var(--space-lg)', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Caricamento completato!</div>
          <div style={{ fontSize: 14, color: 'var(--brand-primary-dark)' }}>
            Creati: <strong>{result.created}</strong> · Errori: {result.errors}
          </div>
          <button onClick={() => router.push('/owner/products')} className="btn btn-primary" style={{ marginTop: 16 }}>
            Vai a Gestione Prodotti →
          </button>
        </div>
      )}

      {status === 'error' && result && (
        <div style={{ background: 'var(--danger-light)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)', padding: 'var(--space-lg)' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>❌ Errori nel caricamento</div>
          <div style={{ fontSize: 13 }}>Creati: {result.created} · Errori: {result.errors}</div>
          {result.errorDetails?.map((e: any, i: number) => (
            <div key={i} style={{ fontSize: 12, marginTop: 4, color: 'var(--danger)' }}>{JSON.stringify(e)}</div>
          ))}
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
            Se vedi errori tipo &quot;invalid input value for enum&quot;, devi prima eseguire il comando SQL sopra in Supabase.
          </div>
        </div>
      )}
    </div>
  )
}

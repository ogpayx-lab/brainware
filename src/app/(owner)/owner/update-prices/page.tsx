'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const PRICE_DATA = [
  { name: "Accendino MM", price: 2 },
  { name: "Accendino no logo", price: 2 },
  { name: "Actitube filtri pack of 10 pcs", price: 3 },
  { name: "Bob my Box", price: 5 },
  { name: "Bong Big", price: 40 },
  { name: "Bong Small", price: 20 },
  { name: "Box da 3 Pre-roll", price: 40 },
  { name: "Cartine MM", price: 2 },
  { name: "cartine no logo", price: 3 },
  { name: "Clipper Accendino", price: 3 },
  { name: "Color Changing Pipe", price: 30 },
  { name: "Cyclones Hemp cones (blunt)", price: 3 },
  { name: "Grinder Card", price: 8 },
  { name: "Grinder MM", price: 5 },
  { name: "Grinder no logo", price: 5 },
  { name: "Grinder Raw", price: 35 },
  { name: "Incenso", price: 3 },
  { name: "Kit Pipe + Grinder", price: 15 },
  { name: "Metal Pipe", price: 10 },
  { name: "Pax Maintenance Kit", price: 25 },
  { name: "Pax Puck Press", price: 25 },
  { name: "Pax Water pipe adaptor", price: 25 },
  { name: "piattini pax", price: 15 },
  { name: "Piattini Raw", price: 10 },
  { name: "Porta Pre-roll", price: 1.5 },
  { name: "Pre-roll", price: 20 },
  { name: "RAW Drawstring Bag Black", price: 10 },
  { name: "Smart stach (grinder smart)", price: 40 },
  { name: "Spiral Pipe", price: 30 },
  { name: "Tappetini Raw Black", price: 8 },
  { name: "Wax CBD 66% 1 g", price: 40 },
  { name: "Wax H4 66% 1 g", price: 50 },
  { name: "Filter Tips", price: 3 },
  { name: "Premium Hemp cones (blunt)", price: 5 },
  { name: "Felpa L", price: 45 },
  { name: "Felpa M", price: 45 },
  { name: "Felpa S", price: 45 },
  { name: "Felpa XL", price: 45 },
  { name: "Felpa XXL", price: 45 },
  { name: "Felpa Zip L", price: 45 },
  { name: "Felpa Zip M", price: 45 },
  { name: "Felpa Zip S", price: 45 },
  { name: "Felpa Zip XL", price: 45 },
  { name: "Felpa Zip XXL", price: 45 },
  { name: "Scarpe", price: 100 },
  { name: "Tshirt L", price: 35 },
  { name: "Tshirt M", price: 35 },
  { name: "Tshirt Nera S", price: 35 },
  { name: "Tshirt S", price: 35 },
  { name: "Tshirt XL", price: 35 },
  { name: "Tshirt XXL", price: 35 },
  { name: "Cappello MM", price: 50 },
  { name: "CBD Anti-Aging Cream", price: 30 },
  { name: "CBD Day Cream", price: 30 },
  { name: "CBD Eye Gel", price: 21 },
  { name: "CBD Eye Gel Roller", price: 25 },
  { name: "CBD Face Serum", price: 30 },
  { name: "CBD Foot Cream", price: 30 },
  { name: "CBD heating Balm", price: 27 },
  { name: "CBD Lip Balm", price: 15 },
  { name: "CBD Night Cream", price: 30 },
  { name: "CBD Nose Spray", price: 27 },
  { name: "Crema corpo Cbd lenisan", price: 25 },
  { name: "Crema viso Cbd lenisan", price: 25 },
  { name: "Dermopurificante cane Verdesativa", price: 34 },
  { name: "Gel lubrificante Cbd lenisan", price: 25 },
  { name: "Igienizzante cane Verdesativa", price: 34 },
  { name: "Latte Corpo Verdesativa", price: 15 },
  { name: "Latte Detergente Verdesativa", price: 12 },
  { name: "Magic oil lenisan", price: 35 },
  { name: "Plants for pet CBD Calming Balm Stick 12g", price: 15 },
  { name: "Plants for pet CBD Fortifying Balm Stick 12g", price: 15 },
  { name: "Plants for pet CBD Repair Balm Stick 12g", price: 15 },
  { name: "Shampoo", price: 15 },
  { name: "Shampoo Antiforfora Verdesativa", price: 8 },
  { name: "Amnesia 2g", price: 25 },
  { name: "Amnesia 3g", price: 30 },
  { name: "Amnesia 5g", price: 50 },
  { name: "Amnesia Sfuso", price: 0 },
  { name: "Cassata Kush 2g", price: 25 },
  { name: "Cassata Kush 3g", price: 30 },
  { name: "Cassata Kush 5g", price: 50 },
  { name: "Cassata Kush Sfuso", price: 0 },
  { name: "Cherry Pie 2g", price: 25 },
  { name: "Cherry Pie 3g", price: 30 },
  { name: "Cherry Pie 5g", price: 50 },
  { name: "Cherry Pie Sfuso", price: 0 },
  { name: "Cookies 2g", price: 25 },
  { name: "Cookies 3g", price: 30 },
  { name: "Cookies 5g", price: 50 },
  { name: "Cookies Sfuso", price: 0 },
  { name: "Critical 2g", price: 25 },
  { name: "Critical 3g", price: 30 },
  { name: "Critical 5g", price: 50 },
  { name: "Critical Sfuso", price: 0 },
  { name: "Gelato 2g", price: 25 },
  { name: "Gelato 3g", price: 30 },
  { name: "Gelato 5g", price: 50 },
  { name: "Gelato Sfuso", price: 0 },
  { name: "Gorilla Mandarine 2g", price: 25 },
  { name: "Gorilla Mandarine 3g", price: 30 },
  { name: "Gorilla Mandarine 5g", price: 50 },
  { name: "Gorilla Mandarine Sfuso", price: 0 },
  { name: "Mango 2g", price: 25 },
  { name: "Mango 3g", price: 30 },
  { name: "Mango 5g", price: 50 },
  { name: "Mango Sfuso", price: 0 },
  { name: "OG Kush 2G", price: 25 },
  { name: "OG Kush 3G", price: 30 },
  { name: "OG Kush 5G", price: 50 },
  { name: "OG Kush Sfuso", price: 0 },
  { name: "Omaggio 1g", price: 0 },
  { name: "Runtz 2g", price: 25 },
  { name: "Runtz 3g", price: 30 },
  { name: "Runtz 5g", price: 50 },
  { name: "Runtz Sfuso", price: 0 },
  { name: "Skittles 2g", price: 25 },
  { name: "Skittles 3g", price: 30 },
  { name: "Skittles 5g", price: 50 },
  { name: "Skittles Sfuso", price: 0 },
  { name: "Sour Diesel 2g", price: 25 },
  { name: "Sour Diesel 3g", price: 30 },
  { name: "Sour Diesel 5g", price: 50 },
  { name: "Spaghetti Cheese 2g", price: 25 },
  { name: "Spaghetti Cheese 3g", price: 30 },
  { name: "Spaghetti Cheese 5g", price: 50 },
  { name: "Spaghetti Cheese Sfuso", price: 0 },
  { name: "Strawberry 2g", price: 25 },
  { name: "Strawberry 3g", price: 30 },
  { name: "Strawberry 5g", price: 50 },
  { name: "Strawberry Sfuso", price: 0 },
  { name: "SUPER LEMON HAZE 2g", price: 25 },
  { name: "SUPER LEMON HAZE 3g", price: 30 },
  { name: "SUPER LEMON HAZE 5g", price: 50 },
  { name: "SUPER LEMON HAZE SFUSO", price: 0 },
  { name: "SuperSkunk 2g", price: 25 },
  { name: "SuperSkunk 3g", price: 30 },
  { name: "SuperSkunk 5g", price: 50 },
  { name: "SuperSkunk sfuso", price: 0 },
  { name: "White Widow 2g", price: 25 },
  { name: "White Widow 3g", price: 30 },
  { name: "White Widow 5g", price: 50 },
  { name: "White Widow Sfuso", price: 0 },
  { name: "Brain-E (Happy Caps) DISPLAY", price: 15 },
  { name: "CBD 15MG Cookies Pouche", price: 25 },
  { name: "CBD Brownie", price: 15 },
  { name: "CBD tea", price: 10 },
  { name: "dance-e (Happy Caps) DISPLAY", price: 15 },
  { name: "Energy-E (Happy Caps) DISPLAY", price: 15 },
  { name: "Euphory-E (Happy Caps) DISPLAY", price: 15 },
  { name: "Heavenly-E (Happy Caps) DISPLAY", price: 15 },
  { name: "Honey with hemp 65g", price: 25 },
  { name: "Lions's Name gummies", price: 25 },
  { name: "Lolly Bubbly Billy", price: 3 },
  { name: "Party-E (Happy Caps) DISPLAY", price: 15 },
  { name: "recover-e (Happy Caps) DISPLAY", price: 15 },
  { name: "relax-e (Happy Caps) DISPLAY", price: 15 },
  { name: "Remedy Cannabis Gummies MM", price: 25 },
  { name: "sex-e (Happy Caps) DISPLAY", price: 15 },
  { name: "space-e (Happy Caps) DISPLAY", price: 15 },
  { name: "Strong Cannabis Gummies MM", price: 40 },
  { name: "Strong Sleep Gummies MM", price: 25 },
  { name: "trip-e (Happy Caps) DISPLAY", price: 15 },
  { name: "Vegan Brownie", price: 15 },
  { name: "Bubble Hash 10g", price: 130 },
  { name: "Bubble Hash 2g", price: 30 },
  { name: "Bubble Hash 3g", price: 35 },
  { name: "bubble hash Sfuso", price: 0 },
  { name: "charas 2g", price: 25 },
  { name: "charas 3g", price: 35 },
  { name: "charas 5g", price: 50 },
  { name: "charas Sfuso", price: 0 },
  { name: "crumble 2g", price: 25 },
  { name: "crumble 3g", price: 35 },
  { name: "crumble 5g", price: 50 },
  { name: "crumble Sfuso", price: 0 },
  { name: "Dry sift 10g", price: 130 },
  { name: "dry sift 2g", price: 30 },
  { name: "dry sift 3g", price: 35 },
  { name: "dry sift Sfuso", price: 0 },
  { name: "ice o lator 10g", price: 130 },
  { name: "ice o lator 2g", price: 30 },
  { name: "ice o lator 3g", price: 35 },
  { name: "ice o lator Sfuso", price: 0 },
  { name: "Lemon Hash 10g", price: 130 },
  { name: "Lemon hash 2g", price: 30 },
  { name: "Lemon hash 3g", price: 35 },
  { name: "Lemon hash Sfuso", price: 0 },
  { name: "OIL hemp 10%", price: 35 },
  { name: "OIL hemp 20%", price: 55 },
  { name: "OIL hemp 30%", price: 75 },
  { name: "OIL Lemon 10%", price: 35 },
  { name: "OIL menta 10%", price: 35 },
  { name: "OIL orange 10%", price: 35 },
  { name: "OIL pet 10%", price: 35 },
  { name: "Semi Amnesia AUTO pack 3", price: 30 },
  { name: "Semi Banana Punch AUTO pack 3", price: 30 },
  { name: "semi Cookies FEM pack 3", price: 30 },
  { name: "Semi Critical Kush auto pack 3", price: 30 },
  { name: "Semi Dosidos AUTO pack 3", price: 30 },
  { name: "Semi Gelato FAST pack 3", price: 30 },
  { name: "Semi Gorilla FAST pack 3", price: 30 },
  { name: "Semi Lemon Haze fast pack 3", price: 30 },
  { name: "Semi Mimosa FAST pack 3", price: 30 },
  { name: "Semi OG Kush FEM pack 3", price: 30 },
  { name: "Semi RUNTZ FEM pack 3", price: 30 },
  { name: "Semi Strawberry OG auto pack 3", price: 30 },
  { name: "Semi Super Skunk FAST pack 3", price: 30 },
  { name: "Semi White Widow", price: 30 },
  { name: "Dip Device 510 battery", price: 10 },
  { name: "Pax Mini", price: 129 },
  { name: "Pax plus", price: 199 },
  { name: "The Dude Cartridge", price: 90 },
  { name: "Vape Disposable 2ml", price: 100 },
  { name: "Vape Kit MamaMary", price: 75 },
]

export default function UpdatePricesPage() {
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

  async function handleUpdate() {
    if (!storeId) return
    setStatus('loading')
    try {
      const res = await fetch('/api/update-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: storeId, prices: PRICE_DATA }),
      })
      const data = await res.json()
      setResult(data)
      setStatus('done')
    } catch (err: any) {
      setResult({ error: err.message })
      setStatus('error')
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: 'var(--space-xl)' }}>
      <h2 style={{ marginBottom: 'var(--space-lg)' }}>💰 Aggiorna Prezzi</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 'var(--space-xl)' }}>
        Aggiorna SOLO i prezzi di {PRICE_DATA.length} prodotti nello store <strong>{storeName}</strong>.
        NON aggiunge né cancella prodotti. Solo update prezzi.
      </p>

      {status === 'idle' && (
        <button onClick={handleUpdate} className="btn btn-primary btn-full" style={{ padding: '14px', fontSize: 16, fontWeight: 700 }}>
          💰 Aggiorna {PRICE_DATA.length} prezzi
        </button>
      )}

      {status === 'loading' && (
        <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-secondary)' }}>
          ⏳ Aggiornamento prezzi...
        </div>
      )}

      {status === 'done' && result && (
        <div style={{ background: 'var(--success-light)', border: '1px solid var(--brand-primary)', borderRadius: 'var(--radius-md)', padding: 'var(--space-lg)', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Prezzi aggiornati!</div>
          <div style={{ fontSize: 14 }}>
            Aggiornati: <strong>{result.updated}</strong> · Non trovati: {result.notFound} · Errori: {result.errors}
          </div>
          {result.notFoundList?.length > 0 && (
            <div style={{ marginTop: 12, fontSize: 12, textAlign: 'left', background: 'rgba(0,0,0,0.05)', padding: 12, borderRadius: 8, maxHeight: 200, overflowY: 'auto' }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Prodotti non trovati nello store:</div>
              {result.notFoundList.map((n: string, i: number) => (
                <div key={i} style={{ color: 'var(--text-tertiary)' }}>• {n}</div>
              ))}
            </div>
          )}
          <button onClick={() => router.push('/owner/products')} className="btn btn-primary" style={{ marginTop: 16 }}>
            Vai a Gestione Prodotti →
          </button>
        </div>
      )}

      {status === 'error' && (
        <div style={{ background: 'var(--danger-light)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)', padding: 'var(--space-lg)' }}>
          ❌ Errore: {result?.error || JSON.stringify(result)}
        </div>
      )}
    </div>
  )
}

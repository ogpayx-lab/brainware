import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CYBERETNA_BASE = 'http://80.211.151.71:9099'
const CYBERETNA_EMAIL = process.env.CYBERETNA_EMAIL || ''
const CYBERETNA_PASSWORD = process.env.CYBERETNA_PASSWORD || ''

// Machine mapping: CyberEtna serialId → BrainWare vending_machine name
const MACHINE_MAP: Record<string, { serialId: string; machineId: number }> = {
  'Cavour': { serialId: 'b38a4bce-bb64-4b1a-868e-32f67525dd6b', machineId: 2513 },
  'MMStore': { serialId: 'f78db209-236a-4b1e-bc20-91b21362d82c', machineId: 92 },
}

// ---- Login to CyberEtna ----
async function cyberEtnaLogin(): Promise<string | null> {
  try {
    const formData = new URLSearchParams()
    formData.append('username', CYBERETNA_EMAIL)
    formData.append('password', CYBERETNA_PASSWORD)

    const res = await fetch(`${CYBERETNA_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
      redirect: 'manual',
    })

    // Extract JSESSIONID from Set-Cookie header
    const cookies = res.headers.getSetCookie?.() || []
    for (const c of cookies) {
      const match = c.match(/JSESSIONID=([^;]+)/)
      if (match) return match[1]
    }

    // Fallback: check all headers
    const setCookie = res.headers.get('set-cookie') || ''
    const match = setCookie.match(/JSESSIONID=([^;]+)/)
    return match ? match[1] : null
  } catch (e) {
    console.error('CyberEtna login failed:', e)
    return null
  }
}

// ---- Fetch a page with session cookie ----
async function fetchPage(path: string, sessionId: string): Promise<string> {
  const res = await fetch(`${CYBERETNA_BASE}${path}`, {
    headers: { Cookie: `JSESSIONID=${sessionId}` },
  })
  return res.text()
}

// ---- Parse products from HTML ----
function parseProducts(html: string): { name: string; price: number; motor: number; imgUrl: string }[] {
  const products: { name: string; price: number; motor: number; imgUrl: string }[] = []
  // Match table rows: <tr> with columns IMG, Nome, Prezzo, Motore
  // Parse product rows from table - split by <tr> and extract data
  const rows = html.split('<tr').slice(1) // skip header
  for (const row of rows) {
    const nameMatch = row.match(/<td[^>]*>\s*([A-Z][A-Z0-9 ]+)\s*<\/td>/)
    const priceMatch = row.match(/<td[^>]*>\s*([\d]+[,.]\d+)\s*<\/td>/)
    const motorMatch = row.match(/<td[^>]*>\s*(\d{1,2})\s*<\/td>/)
    const imgMatch = row.match(/src="([^"]+)"/) 
    if (nameMatch && priceMatch) {
      products.push({
        imgUrl: imgMatch ? imgMatch[1] : '',
        name: nameMatch[1].trim(),
        price: parseFloat(priceMatch[1].replace(',', '.')),
        motor: motorMatch ? parseInt(motorMatch[1]) : 0,
      })
    }
  }
  return products
}

// ---- Parse telemetry data from HTML ----
function parseTelemetry(html: string): { totalDispensed: number; dates: string[]; volumes: number[]; revenue: number[] } {
  let totalDispensed = 0
  const totalMatch = html.match(/(\d+)\s*<\/h3>\s*<p[^>]*>Erogazioni/i) || html.match(/<h3[^>]*>(\d+)<\/h3>/i)
  if (totalMatch) totalDispensed = parseInt(totalMatch[1])

  // Extract chart data from JavaScript variables
  const dates: string[] = []
  const volumes: number[] = []
  const revenue: number[] = []

  const datesMatch = html.match(/yAxisDataD\s*=\s*\[([^\]]*)\]/)
  if (datesMatch) {
    datesMatch[1].split(',').forEach(d => {
      const cleaned = d.trim().replace(/['"]/g, '')
      if (cleaned) dates.push(cleaned)
    })
  }

  const volumesMatch = html.match(/xAxisDataV\s*=\s*\[([^\]]*)\]/)
  if (volumesMatch) {
    volumesMatch[1].split(',').forEach(v => {
      const n = parseInt(v.trim())
      if (!isNaN(n)) volumes.push(n)
    })
  }

  const revenueMatch = html.match(/xAxisDataG\s*=\s*\[([^\]]*)\]/)
  if (revenueMatch) {
    revenueMatch[1].split(',').forEach(r => {
      const n = parseFloat(r.trim())
      if (!isNaN(n)) revenue.push(n)
    })
  }

  return { totalDispensed, dates, volumes, revenue }
}

// ---- Parse machine connection status from homepage HTML ----
function parseMachineStatus(html: string): Record<string, boolean> {
  const status: Record<string, boolean> = {}
  // Check for each machine name and its SI/NO status
  for (const name of Object.keys(MACHINE_MAP)) {
    const idx = html.indexOf(name)
    if (idx > -1) {
      // Look for SI/NO near the machine name
      const nearby = html.substring(idx, idx + 500)
      status[name] = nearby.includes('>SI<') || nearby.includes('>SI </') 
    }
  }
  return status
}

// ---- SYNC endpoint ----
export async function POST(request: NextRequest) {
  try {
    const { storeId, action } = await request.json()
    if (!storeId) return NextResponse.json({ error: 'storeId required' }, { status: 400 })

    // Login to CyberEtna
    const sessionId = await cyberEtnaLogin()
    if (!sessionId) {
      return NextResponse.json({ error: 'Login CyberEtna fallito' }, { status: 401 })
    }

    const results: any = { synced: [], errors: [] }

    // Get all BrainWare vending machines for this store
    const { data: machines } = await supabase
      .from('vending_machines')
      .select('*')
      .eq('store_id', storeId)

    if (!machines || machines.length === 0) {
      return NextResponse.json({ error: 'Nessuna macchina trovata in BrainWare' }, { status: 404 })
    }

    // Fetch machine list page to get connection status
    const homePage = await fetchPage('/machine/home', sessionId)

    for (const machine of machines) {
      const mapping = MACHINE_MAP[machine.name]
      if (!mapping) {
        results.errors.push({ machine: machine.name, error: 'Nessun mapping CyberEtna trovato' })
        continue
      }

      try {
        // 1. Sync connection status
        const isConnected = homePage.includes(`<td>${machine.name}</td>`) &&
          homePage.includes('SI')

        await supabase.from('vending_machines').update({
          status: isConnected ? 'online' : 'offline',
        }).eq('id', machine.id)

        // 2. Sync products (if action includes products)
        if (!action || action === 'all' || action === 'products') {
          const productsHtml = await fetchPage(`/products?serialId=${mapping.serialId}`, sessionId)
          const cyberProducts = parseProducts(productsHtml)

          for (const cp of cyberProducts) {
            // Find matching product in BrainWare catalog
            const { data: bwProduct } = await supabase
              .from('products')
              .select('id')
              .eq('store_id', storeId)
              .ilike('name', `%${cp.name}%`)
              .limit(1)
              .single()

            if (bwProduct) {
              // Upsert into vending_machine_products
              const { data: existing } = await supabase
                .from('vending_machine_products')
                .select('id, qty_loaded, qty_remaining')
                .eq('vending_machine_id', machine.id)
                .eq('product_id', bwProduct.id)
                .single()

              if (existing) {
                await supabase.from('vending_machine_products').update({
                  vending_price: cp.price,
                }).eq('id', existing.id)
              } else {
                await supabase.from('vending_machine_products').insert({
                  vending_machine_id: machine.id,
                  product_id: bwProduct.id,
                  qty_loaded: 0,
                  qty_remaining: 0,
                  vending_price: cp.price,
                })
              }
            }
          }
          results.synced.push({ machine: machine.name, products: cyberProducts.length })
        }

        // 3. Sync telemetry (sales data)
        if (!action || action === 'all' || action === 'telemetry') {
          const telemetryHtml = await fetchPage(`/machine/info?machineId=${mapping.machineId}`, sessionId)
          const telemetry = parseTelemetry(telemetryHtml)

          // Store latest telemetry in vending_machines table
          await supabase.from('vending_machines').update({
            total_dispensed: telemetry.totalDispensed,
            last_sync_at: new Date().toISOString(),
          }).eq('id', machine.id)

          results.synced.push({
            machine: machine.name,
            totalDispensed: telemetry.totalDispensed,
            dataPoints: telemetry.dates.length,
          })
        }

      } catch (machineErr: any) {
        results.errors.push({ machine: machine.name, error: machineErr.message })
      }
    }

    return NextResponse.json({ success: true, ...results })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ---- GET: Check CyberEtna connection status ----
export async function GET(request: NextRequest) {
  try {
    const sessionId = await cyberEtnaLogin()
    if (!sessionId) {
      return NextResponse.json({ connected: false, error: 'Login failed' })
    }

    const homePage = await fetchPage('/machine/home', sessionId)
    const hasCavour = homePage.includes('Cavour')
    const hasMMStore = homePage.includes('MMStore')
    const cavourOnline = homePage.includes('Cavour') && homePage.includes('>SI<')

    return NextResponse.json({
      connected: true,
      machines: {
        Cavour: { found: hasCavour, online: cavourOnline },
        MMStore: { found: hasMMStore },
      },
    })
  } catch (e: any) {
    return NextResponse.json({ connected: false, error: e.message })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function getShopifyCredentials(token: string) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return null
  const { data: profile } = await supabaseAdmin.from('users').select('store_id').eq('id', user.id).single()
  if (!profile?.store_id) return null
  const { data: dbConfig } = await supabaseAdmin.from('shopify_config').select('*').eq('store_id', profile.store_id).single()
  const shopifyDomain = dbConfig?.shopify_domain || process.env.SHOPIFY_STORE_DOMAIN
  const accessToken = dbConfig?.access_token || process.env.SHOPIFY_ACCESS_TOKEN
  if (!accessToken || !shopifyDomain) return null
  return { shopifyDomain, accessToken }
}

// GET - Recupera ordini e altri dati
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  const creds = await getShopifyCredentials(authHeader.replace('Bearer ', ''))
  if (!creds) return NextResponse.json({ error: 'Non autorizzato o Shopify non configurato', not_configured: true }, { status: 200 })

  const endpoint = req.nextUrl.searchParams.get('endpoint') || 'orders.json?status=any&limit=50'
  try {
    const res = await fetch(`https://${creds.shopifyDomain}/admin/api/2024-01/${endpoint}`, {
      headers: { 'X-Shopify-Access-Token': creds.accessToken, 'Content-Type': 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `Shopify API error: ${res.status}`, detail: err }, { status: res.status })
    }
    return NextResponse.json({ ...(await res.json()), _domain: creds.shopifyDomain })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST - Evade un ordine (crea fulfillment)
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  const creds = await getShopifyCredentials(authHeader.replace('Bearer ', ''))
  if (!creds) return NextResponse.json({ error: 'Shopify non configurato' }, { status: 400 })

  const { orderId, trackingCompany, trackingNumber, notifyCustomer } = await req.json()
  if (!orderId) return NextResponse.json({ error: 'orderId mancante' }, { status: 400 })

  try {
    // Step 1: Recupera i fulfillment_orders per l'ordine
    const foRes = await fetch(
      `https://${creds.shopifyDomain}/admin/api/2024-01/orders/${orderId}/fulfillment_orders.json`,
      { headers: { 'X-Shopify-Access-Token': creds.accessToken }, cache: 'no-store' }
    )
    if (!foRes.ok) return NextResponse.json({ error: `Errore nel recupero fulfillment orders: ${foRes.status}` }, { status: foRes.status })
    const { fulfillment_orders } = await foRes.json()
    const openFO = fulfillment_orders?.filter((fo: any) => fo.status === 'open' || fo.status === 'in_progress')
    if (!openFO?.length) return NextResponse.json({ error: 'Nessun articolo da evadere per questo ordine' }, { status: 400 })

    // Step 2: Crea il fulfillment
    const fulfillmentBody: any = {
      fulfillment: {
        line_items_by_fulfillment_order: openFO.map((fo: any) => ({ fulfillment_order_id: fo.id })),
        notify_customer: notifyCustomer ?? true,
      }
    }
    if (trackingNumber || trackingCompany) {
      fulfillmentBody.fulfillment.tracking_info = {
        company: trackingCompany || null,
        number: trackingNumber || null,
      }
    }

    const fulfillRes = await fetch(
      `https://${creds.shopifyDomain}/admin/api/2024-01/fulfillments.json`,
      {
        method: 'POST',
        headers: { 'X-Shopify-Access-Token': creds.accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify(fulfillmentBody),
      }
    )
    if (!fulfillRes.ok) {
      const err = await fulfillRes.text()
      return NextResponse.json({ error: `Shopify fulfillment error: ${fulfillRes.status}`, detail: err }, { status: fulfillRes.status })
    }
  const result = await fulfillRes.json()
    return NextResponse.json({ success: true, fulfillment: result.fulfillment })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'

// One-time setup: creates Stripe products and prices
// POST /api/stripe/setup?secret=brainware-stripe-setup
export async function POST(req: Request) {
  const url = new URL(req.url)
  if (url.searchParams.get('secret') !== 'brainware-stripe-setup') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const stripe = getStripe()
    // 1. Create Products
    const starterProduct = await stripe.products.create({
      name: 'BrainWare Starter',
      description: '1 store — POS, Inventario, Turni, Analytics base',
      metadata: { plan: 'starter' },
    })
    const growthProduct = await stripe.products.create({
      name: 'BrainWare Growth',
      description: 'Fino a 3 store — Analytics avanzati, Supporto prioritario',
      metadata: { plan: 'growth' },
    })
    const businessProduct = await stripe.products.create({
      name: 'BrainWare Business',
      description: 'Fino a 10 store — Shopify, Onboarding dedicato',
      metadata: { plan: 'business' },
    })
    const aiProduct = await stripe.products.create({
      name: 'BrainWare AI Assistant',
      description: 'Assistente AI intelligente — pay per use',
      metadata: { plan: 'ai_usage' },
    })

    // 2. Create Prices
    const starterPrice = await stripe.prices.create({
      product: starterProduct.id,
      unit_amount: 4900, currency: 'eur',
      recurring: { interval: 'month' },
      metadata: { plan: 'starter' },
    })
    const growthPrice = await stripe.prices.create({
      product: growthProduct.id,
      unit_amount: 9900, currency: 'eur',
      recurring: { interval: 'month' },
      metadata: { plan: 'growth' },
    })
    const businessPrice = await stripe.prices.create({
      product: businessProduct.id,
      unit_amount: 14900, currency: 'eur',
      recurring: { interval: 'month' },
      metadata: { plan: 'business' },
    })

    // 3. Create Billing Meter for AI usage
    const meter = await (stripe as any).billing.meters.create({
      display_name: 'AI Requests',
      event_name: 'ai_request',
      default_aggregation: { formula: 'sum' },
    })

    // 4. AI metered price — €0.10 per request, backed by meter
    const aiPrice = await stripe.prices.create({
      product: aiProduct.id,
      unit_amount: 10, currency: 'eur',
      recurring: { interval: 'month', meter: meter.id, usage_type: 'metered' },
      metadata: { plan: 'ai_usage' },
    } as any)

    return NextResponse.json({
      success: true,
      products: {
        starter: { product: starterProduct.id, price: starterPrice.id },
        growth: { product: growthProduct.id, price: growthPrice.id },
        business: { product: businessProduct.id, price: businessPrice.id },
        ai: { product: aiProduct.id, price: aiPrice.id },
      },
      message: 'Save these price IDs in your .env.local!',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

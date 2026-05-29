import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'

export async function POST(req: Request) {
  const url = new URL(req.url)
  if (url.searchParams.get('secret') !== 'brainware-stripe-setup') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const step = url.searchParams.get('step') || 'all'

  try {
    const stripe = getStripe()

    if (step === 'plans' || step === 'all') {
      // Create subscription products + prices
      const starter = await stripe.products.create({ name: 'BrainWare Starter', metadata: { plan: 'starter' } })
      const growth = await stripe.products.create({ name: 'BrainWare Growth', metadata: { plan: 'growth' } })
      const business = await stripe.products.create({ name: 'BrainWare Business', metadata: { plan: 'business' } })

      const starterPrice = await stripe.prices.create({ product: starter.id, unit_amount: 4900, currency: 'eur', recurring: { interval: 'month' } })
      const growthPrice = await stripe.prices.create({ product: growth.id, unit_amount: 9900, currency: 'eur', recurring: { interval: 'month' } })
      const businessPrice = await stripe.prices.create({ product: business.id, unit_amount: 14900, currency: 'eur', recurring: { interval: 'month' } })

      if (step === 'plans') {
        return NextResponse.json({
          success: true,
          starter: starterPrice.id,
          growth: growthPrice.id,
          business: businessPrice.id,
          message: 'Plans created! Now run with step=ai to create metered AI pricing.',
        })
      }
    }

    if (step === 'ai' || step === 'all') {
      // Create AI product
      const aiProduct = await stripe.products.create({ name: 'BrainWare AI Assistant', metadata: { plan: 'ai_usage' } })

      // Create Billing Meter
      const meter = await (stripe as any).billing.meters.create({
        display_name: 'AI Requests',
        event_name: 'ai_request',
        default_aggregation: { formula: 'sum' },
      })

      // Create metered price backed by meter
      const aiPrice = await stripe.prices.create({
        product: aiProduct.id,
        unit_amount: 10,
        currency: 'eur',
        recurring: { interval: 'month', meter: meter.id, usage_type: 'metered' },
      } as any)

      if (step === 'ai') {
        return NextResponse.json({
          success: true,
          ai_price: aiPrice.id,
          meter_id: meter.id,
        })
      }
    }

    return NextResponse.json({ success: true, message: 'All products created!' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack?.slice(0, 300) }, { status: 500 })
  }
}

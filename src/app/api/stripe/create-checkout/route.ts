import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe()
    const { planId, userId } = await req.json()

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Get user info
    const { data: user } = await supabase.from('users').select('id, full_name, store_id').eq('id', userId).single()
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Check if customer exists
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single()

    let customerId = existingSub?.stripe_customer_id

    if (!customerId) {
      // Create Stripe customer
      const customer = await stripe.customers.create({
        name: user.full_name,
        metadata: { user_id: userId, store_id: user.store_id },
      })
      customerId = customer.id
    }

    // Price IDs from env
    const priceMap: Record<string, string> = {
      starter: process.env.STRIPE_PRICE_STARTER!,
      growth: process.env.STRIPE_PRICE_GROWTH!,
      business: process.env.STRIPE_PRICE_BUSINESS!,
    }

    const planPrice = priceMap[planId]
    if (!planPrice) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

    const aiPrice = process.env.STRIPE_PRICE_AI_USAGE

    // Create checkout session with plan + optional metered AI
    const line_items: any[] = [{ price: planPrice, quantity: 1 }]
    if (aiPrice) line_items.push({ price: aiPrice }) // metered — no quantity

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items,
      subscription_data: {
        trial_period_days: 30,
        metadata: { user_id: userId, store_id: user.store_id, plan: planId },
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://brain-ware.ai'}/onboarding?step=store&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://brain-ware.ai'}/#pricing`,
      metadata: { user_id: userId, plan: planId },
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

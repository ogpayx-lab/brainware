import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'No signature' }, { status: 400 })

  const body = await req.text()
  let event
  const stripe = getStripe()

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as any
      const userId = session.metadata?.user_id
      const plan = session.metadata?.plan
      const customerId = session.customer
      const subscriptionId = session.subscription

      if (userId && plan) {
        // Get subscription details
        const sub = await stripe.subscriptions.retrieve(subscriptionId)

        await supabase.from('subscriptions').upsert({
          user_id: userId,
          store_id: session.metadata?.store_id,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          plan,
          status: sub.status === 'trialing' ? 'trialing' : 'active',
          current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          ai_requests_count: 0,
        }, { onConflict: 'user_id' })
      }
      break
    }

    case 'invoice.paid': {
      const invoice = event.data.object as any
      const subscriptionId = invoice.subscription
      if (subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId)
        const userId = sub.metadata?.user_id
        if (userId) {
          await supabase.from('subscriptions').update({
            status: 'active',
            current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            ai_requests_count: 0, // reset monthly counter
          }).eq('user_id', userId)
        }
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as any
      const userId = sub.metadata?.user_id
      if (userId) {
        await supabase.from('subscriptions').update({
          status: 'cancelled',
        }).eq('user_id', userId)
      }
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as any
      const userId = sub.metadata?.user_id
      if (userId) {
        await supabase.from('subscriptions').update({
          status: sub.status,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        }).eq('user_id', userId)
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}

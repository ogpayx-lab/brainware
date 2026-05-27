import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  typescript: true,
})

// Plan configuration
export const PLANS = {
  starter: { name: 'Starter', price: 4900, stores: 1 },
  growth:  { name: 'Growth',  price: 9900, stores: 3 },
  business:{ name: 'Business',price: 14900, stores: 10 },
} as const

export type PlanId = keyof typeof PLANS

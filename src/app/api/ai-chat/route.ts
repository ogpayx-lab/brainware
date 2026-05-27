import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const { messages, context, userId } = await req.json()

    // Try providers in order with automatic fallback
    const providers: { name: string; key?: string; fn: (key: string, msgs: any[], ctx: string) => Promise<NextResponse> }[] = [
      { name: 'Anthropic', key: process.env.ANTHROPIC_API_KEY, fn: callAnthropic },
      { name: 'OpenAI', key: process.env.OPENAI_API_KEY, fn: callOpenAI },
      { name: 'Gemini', key: process.env.GEMINI_API_KEY, fn: callGemini },
    ]

    let lastError = ''
    for (const provider of providers) {
      if (!provider.key) continue
      try {
        const result = await provider.fn(provider.key, messages, context)
        const body = await result.clone().json()
        // If quota exhausted or error, try next provider
        if (body.quotaExhausted || (result.status >= 400 && result.status !== 200)) {
          lastError = body.error || `${provider.name} error ${result.status}`
          console.log(`[AI] ${provider.name} failed (${result.status}), trying next...`)
          continue
        }

        // Track AI usage for billing (fire and forget)
        if (userId) trackAiUsage(userId).catch(err => console.error('[AI Billing]', err.message))

        return result
      } catch (err: any) {
        lastError = err.message || `${provider.name} error`
        console.log(`[AI] ${provider.name} threw error, trying next...`)
        continue
      }
    }

    return NextResponse.json({ error: lastError || 'Nessuna API key AI configurata.' }, { status: 500 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Errore interno' }, { status: 500 })
  }
}

async function trackAiUsage(userId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Increment counter in DB
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id, stripe_subscription_id, ai_requests_count')
    .eq('user_id', userId)
    .single()

  if (sub) {
    await supabase.from('subscriptions')
      .update({ ai_requests_count: (sub.ai_requests_count || 0) + 1 })
      .eq('id', sub.id)

    // Report usage to Stripe metered billing
    if (sub.stripe_subscription_id && process.env.STRIPE_SECRET_KEY) {
      try {
        const Stripe = (await import('stripe')).default
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
        const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
        const meteredItem = subscription.items.data.find(
          (item: any) => item.price?.recurring?.usage_type === 'metered'
        )
        if (meteredItem) {
          await stripe.subscriptionItems.createUsageRecord(meteredItem.id, {
            quantity: 1, timestamp: 'now', action: 'increment',
          })
        }
      } catch (e: any) {
        console.error('[Stripe Usage]', e.message)
      }
    }
  }
}


async function callAnthropic(apiKey: string, messages: any[], context: string) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: context,
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Anthropic error: ${response.status} - ${err}`)
  }

  const data = await response.json()
  const reply = data.content?.[0]?.text ?? 'Nessuna risposta.'
  return NextResponse.json({ reply })
}

async function callOpenAI(apiKey: string, messages: any[], context: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 2000,
      messages: [
        { role: 'system', content: context },
        ...messages.map((m: any) => ({ role: m.role, content: m.content })),
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI error: ${response.status} - ${err}`)
  }

  const data = await response.json()
  const reply = data.choices?.[0]?.message?.content ?? 'Nessuna risposta.'
  return NextResponse.json({ reply })
}

async function callGemini(apiKey: string, messages: any[], context: string) {
  const contents = messages.map((m: any) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: context }] },
        contents,
        generationConfig: { maxOutputTokens: 2000 },
      }),
    }
  )

  if (!response.ok) {
    const status = response.status
    try {
      const errData = await response.json()
      const errStatus = errData?.error?.status || ''

      if (status === 429 || errStatus === 'RESOURCE_EXHAUSTED') {
        return NextResponse.json({
          error: '⏳ Quota AI giornaliera esaurita. Il servizio gratuito ha un limite di richieste al giorno. Riprova domani oppure contatta il supporto per un piano premium.',
          quotaExhausted: true,
        }, { status: 429 })
      }

      return NextResponse.json({
        error: `Errore AI (${status}): ${errData?.error?.message || 'Errore sconosciuto'}`,
      }, { status })
    } catch {
      return NextResponse.json({ error: `Errore AI: servizio temporaneamente non disponibile (${status})` }, { status })
    }
  }

  const data = await response.json()
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Nessuna risposta.'
  return NextResponse.json({ reply })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Demo credentials (stored server-side only)
const DEMO_EMAIL = 'demo@brain-ware.ai'
const DEMO_PASSWORD = 'Demo2026!'

export async function POST(req: NextRequest) {
  try {
    const { view } = await req.json() // 'owner' or 'employee'

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Sign in as demo user
    const { data, error } = await supabase.auth.signInWithPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    })

    if (error || !data.session) {
      return NextResponse.json({
        error: 'Demo non disponibile. Contatta il supporto.',
        details: error?.message,
      }, { status: 500 })
    }

    // Switch role based on view selection
    const targetRole = view === 'employee' ? 'employee' : 'owner'
    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      data.session.access_token
    )
    await authClient.from('users').update({ role: targetRole }).eq('id', data.user.id)

    // Return session tokens — the client will set them
    return NextResponse.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      redirect: view === 'employee' ? '/employee/shift/open' : '/owner/dashboard',
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

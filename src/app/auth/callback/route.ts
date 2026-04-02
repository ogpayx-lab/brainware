import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Auth callback route - handles Supabase PKCE code exchange.
 * Supabase redirects here after email link click with ?code=xxx
 * We exchange the code for a session then redirect to the target page.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone()
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/auth/reset-password'
  const type = url.searchParams.get('type')
  const errorParam = url.searchParams.get('error')
  const errorCode = url.searchParams.get('error_code')

  // Pass errors directly to the target page
  if (errorParam || errorCode) {
    const target = new URL(next, url.origin)
    url.searchParams.forEach((v, k) => target.searchParams.set(k, v))
    return NextResponse.redirect(target)
  }

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Session established server-side via cookies — redirect to reset page
      const target = new URL('/auth/reset-password', url.origin)
      target.searchParams.set('session_ready', '1')
      if (type) target.searchParams.set('type', type)
      return NextResponse.redirect(target)
    }

    // Exchange failed: redirect with error
    const target = new URL('/auth/reset-password', url.origin)
    target.searchParams.set('error', 'access_denied')
    target.searchParams.set('error_code', 'otp_expired')
    target.searchParams.set('error_description', error.message)
    return NextResponse.redirect(target)
  }

  // No code: redirect to login
  return NextResponse.redirect(new URL('/login', url.origin))
}

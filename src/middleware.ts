import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: do not add logic between createServerClient and getUser()
  // See: https://supabase.com/docs/guides/auth/server-side/nextjs
  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // Public paths - always allow
  if (
    path === '/' ||
    path === '/login' ||
    path === '/signup' ||
    path === '/onboarding' ||
    path === '/privacy' ||
    path === '/terms' ||
    path === '/demo' ||
    path === '/demo-showcase' ||
    path.startsWith('/auth/') ||
    path.startsWith('/superadmin/login') ||
    path.startsWith('/api/')
  ) {
    return supabaseResponse
  }

  // Owner/employee pages: let the page component handle auth
  if (path.startsWith('/owner/') || path.startsWith('/employee/')) {
    return supabaseResponse
  }

  // All other protected routes: require session
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|csv)$).*)',
  ],
}

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

export async function POST(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()

  // Verify owner via Authorization header
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { data: profile } = await supabaseAdmin.from('users').select('role,store_id').eq('id', user.id).single()
  if (profile?.role !== 'owner') return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const { email, password, storeId, storeName } = await req.json()
  if (!email || !password || !storeId) {
    return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'Password deve avere almeno 6 caratteri' }, { status: 400 })
  }

  // Create auth user for the store
  const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm, no email verification needed
    user_metadata: {
      full_name: storeName || 'Store Account',
      store_id: storeId,
      role: 'employee',
    },
  })

  if (createError) {
    if (createError.message.includes('already been registered') || createError.message.includes('already exists')) {
      return NextResponse.json({ error: 'Email già in uso' }, { status: 409 })
    }
    return NextResponse.json({ error: createError.message }, { status: 500 })
  }

  // Create user profile
  if (authData?.user) {
    await supabaseAdmin.from('users').upsert({
      id: authData.user.id,
      full_name: storeName || 'Store Account',
      role: 'employee',
      store_id: storeId,
      is_active: true,
    })
  }

  return NextResponse.json({ success: true, userId: authData?.user?.id })
}

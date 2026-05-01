import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const { email, password, full_name, store_id, role, pin } = await req.json()

  if (!email || !password || !store_id) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Create auth user via admin API (proper way)
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: full_name || email.split('@')[0] },
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  // Update public.users (trigger already created the row)
  const { error: updateError } = await admin
    .from('users')
    .update({
      full_name: full_name || email.split('@')[0],
      role: role || 'employee',
      store_id,
      pin: pin || '0000',
      is_active: true,
    })
    .eq('id', authUser.user.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, userId: authUser.user.id })
}

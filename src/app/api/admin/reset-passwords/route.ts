import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret')
  
  if (secret !== 'reset-mm-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const newPassword = 'SistemaMM!!!'

  // Get [STORE] user IDs directly from users table + auth
  const { data: storeUsers, error: qErr } = await supabaseAdmin
    .from('users')
    .select('id, full_name')
    .like('full_name', '[STORE]%')

  if (qErr) {
    return NextResponse.json({ error: qErr.message })
  }

  const results: any[] = []

  for (const u of (storeUsers || [])) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(u.id, {
      password: newPassword,
    })
    results.push({ name: u.full_name, id: u.id, success: !error, error: error?.message })
  }

  return NextResponse.json({ total: results.length, results })
}

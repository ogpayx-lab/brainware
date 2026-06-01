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

  const emails = [
    'malta.dispensary@gmail.com',
    'malta.vapeshop.mm@gmail.com',
    'brancaccio.dispensary@gmail.com',
    'cavour.mamamary@gmail.com',
    'mktg.mamamary@gmail.com',
    'sistina.mamamary@gmail.com',
  ]

  const newPassword = 'SistemaMM!!!'
  const results: any[] = []

  for (const email of emails) {
    // Find user by email
    const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers()
    if (listErr) {
      results.push({ email, error: listErr.message })
      continue
    }
    
    const user = users.find(u => u.email === email)
    if (!user) {
      results.push({ email, error: 'User not found' })
      continue
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: newPassword,
    })

    results.push({ email, success: !error, error: error?.message })
  }

  return NextResponse.json({ results })
}

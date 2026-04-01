import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { data: profile } = await supabaseAdmin.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'owner') return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const { userId, action } = await req.json()
  if (!userId || !action) return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 })

  if (action === 'ban') {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: '876600h', // ~100 anni = ban permanente
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else if (action === 'unban') {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: 'none',
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    return NextResponse.json({ error: 'Azione non valida' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}

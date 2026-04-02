import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

// Client con service role per operazioni admin
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  // Verifica via Authorization header (più affidabile dei cookie nelle route handlers)
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  // Verifica che sia owner
  const { data: profile } = await supabaseAdmin.from('users').select('role,store_id').eq('id', user.id).single()
  if (profile?.role !== 'owner') return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const { employeeName, employeeEmail, role, storeId, resend } = await req.json()
  if (!employeeName || !employeeEmail || !storeId) {
    return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://brainware-vq7o.vercel.app'
  const redirectTo = `${siteUrl}/auth/reset-password`

  // RESEND: usa resetPasswordForEmail per utenti già registrati
  if (resend) {
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { error } = await supabaseClient.auth.resetPasswordForEmail(employeeEmail, { redirectTo })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // NUOVO INVITO via inviteUserByEmail
  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    employeeEmail,
    {
      data: {
        full_name: employeeName,
        store_id: storeId,
        role: role || 'employee',
      },
      redirectTo,
    }
  )

  if (inviteError) {
    // Se l'utente esiste già, prova a recuperarlo
    if (inviteError.message.includes('already been registered')) {
      return NextResponse.json({ error: 'Email già registrata', already_exists: true }, { status: 409 })
    }
    return NextResponse.json({ error: inviteError.message }, { status: 500 })
  }

  // Crea il profilo utente nella tabella users
  if (inviteData?.user) {
    await supabaseAdmin.from('users').upsert({
      id: inviteData.user.id,
      full_name: employeeName,
      role: role || 'employee',
      store_id: storeId,
      is_active: true,
    })
  }

  return NextResponse.json({ success: true, userId: inviteData?.user?.id })
}

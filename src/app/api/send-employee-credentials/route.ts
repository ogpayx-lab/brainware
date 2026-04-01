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
  // Verifica che chi chiama sia un owner autenticato
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role,store_id').eq('id', user.id).single()
  if (profile?.role !== 'owner') return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const { employeeName, employeeEmail, role, storeId } = await req.json()
  if (!employeeName || !employeeEmail || !storeId) {
    return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 })
  }

  // Invita l'utente via Supabase — usa il tuo SMTP/Resend già configurato
  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    employeeEmail,
    {
      data: {
        full_name: employeeName,
        store_id: storeId,
        role: role || 'employee',
      },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://brainware-vq7o.vercel.app'}/auth/reset-password`,
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

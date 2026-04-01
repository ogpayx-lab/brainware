import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  // Solo owner autenticati possono chiamare questa route
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role, stores(name)').eq('id', user.id).single()
  if (profile?.role !== 'owner') return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const { employeeName, employeeEmail, password } = await req.json()
  if (!employeeName || !employeeEmail || !password) {
    return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 })
  }

  const storeName = (profile.stores as any)?.name || 'BrainWare'
  const loginUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://brainware-vq7o.vercel.app'}/login`

  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'BrainWare <noreply@resend.dev>',
    to: [employeeEmail],
    subject: `🎉 Benvenuto in BrainWare — Le tue credenziali di accesso`,
    html: `
<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F6F7F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    
    <!-- Header -->
    <div style="background:#22C55E;padding:32px;text-align:center;">
      <div style="width:56px;height:56px;background:white;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;color:#22C55E;margin-bottom:12px;">B</div>
      <h1 style="margin:0;color:white;font-size:24px;font-weight:700;">Benvenuto in BrainWare!</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">${storeName}</p>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="margin:0 0 20px;font-size:16px;color:#111827;">
        Ciao <strong>${employeeName}</strong>! 👋<br>
        Il tuo account è stato creato. Ecco le tue credenziali di accesso alla dashboard.
      </p>

      <!-- Credentials box -->
      <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:24px;margin-bottom:24px;">
        <div style="margin-bottom:16px;">
          <div style="font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">📧 Email</div>
          <div style="font-size:15px;font-weight:600;color:#111827;font-family:monospace;background:white;padding:10px 14px;border-radius:8px;border:1px solid #E5E7EB;">${employeeEmail}</div>
        </div>
        <div>
          <div style="font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">🔑 Password</div>
          <div style="font-size:15px;font-weight:600;color:#111827;font-family:monospace;background:white;padding:10px 14px;border-radius:8px;border:1px solid #E5E7EB;">${password}</div>
        </div>
      </div>

      <!-- CTA Button -->
      <div style="text-align:center;margin-bottom:24px;">
        <a href="${loginUrl}" style="display:inline-block;background:#22C55E;color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;">
          Accedi alla Dashboard →
        </a>
      </div>

      <!-- Info box -->
      <div style="background:#FFFBEB;border:1px solid #FCD34D;border-radius:10px;padding:16px;font-size:13px;color:#92400E;">
        <strong>⚠️ Importante:</strong> Ti consigliamo di cambiare la password al primo accesso. 
        Vai su <strong>Profilo → Cambia Password</strong> dopo il login.
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#F9FAFB;border-top:1px solid #F3F4F6;padding:20px 32px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9CA3AF;">
        BrainWare · Piattaforma di gestione negozio<br>
        Questo messaggio è stato inviato automaticamente da ${storeName}
      </p>
    </div>
  </div>
</body>
</html>
    `,
  })

  if (error) {
    console.error('Resend error:', error)
    return NextResponse.json({ error: 'Errore invio email: ' + error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, emailId: data?.id })
}

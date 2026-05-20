import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const RESEND_KEY = process.env.RESEND_API_KEY
  if (!RESEND_KEY) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
  }

  const { to, customerName, cardNumber, storeName, points } = await req.json()
  if (!to || !customerName || !cardNumber || !storeName) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#0F172A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:40px 24px;">
    
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:48px;margin-bottom:8px;">✦</div>
      <h1 style="color:white;font-size:24px;margin:0 0 4px;">${storeName}</h1>
      <p style="color:#94A3B8;font-size:14px;letter-spacing:0.1em;margin:0;">MEMBERSHIP CARD</p>
    </div>

    <!-- Welcome -->
    <div style="background:#1E293B;border-radius:16px;padding:24px;margin-bottom:24px;border:1px solid #334155;">
      <h2 style="color:white;font-size:20px;margin:0 0 8px;">Welcome, ${customerName}! 🎉</h2>
      <p style="color:#CBD5E1;font-size:14px;line-height:1.6;margin:0;">
        Thank you for joining our membership program. Your card is now active and ready to use!
      </p>
    </div>

    <!-- Card -->
    <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);border-radius:20px;padding:28px;margin-bottom:24px;box-shadow:0 8px 40px rgba(0,0,0,0.4);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
        <div>
          <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;color:rgba(255,255,255,0.5);margin-bottom:4px;">MEMBERSHIP CARD</div>
          <div style="font-size:20px;font-weight:800;color:white;">${storeName}</div>
        </div>
      </div>
      <div style="font-size:18px;font-weight:700;color:white;letter-spacing:0.04em;margin-bottom:4px;">${customerName.toUpperCase()}</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.5);letter-spacing:0.08em;margin-bottom:20px;">${cardNumber}</div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;">
        <div>
          <div style="font-size:10px;color:rgba(255,255,255,0.4);letter-spacing:0.06em;">MEMBER SINCE</div>
          <div style="font-size:13px;color:white;margin-top:2px;">${new Date().toLocaleDateString('en-GB')}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:28px;font-weight:800;color:#22C55E;">${points || 0}</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.4);letter-spacing:0.06em;">POINTS</div>
        </div>
      </div>
    </div>

    <!-- How it works -->
    <div style="background:#1E293B;border-radius:16px;padding:24px;margin-bottom:24px;border:1px solid #334155;">
      <h3 style="color:white;font-size:16px;margin:0 0 16px;">🎁 How It Works</h3>
      <div style="color:#CBD5E1;font-size:14px;line-height:1.8;">
        <div>✅ Earn <strong style="color:#22C55E;">1 point</strong> for every <strong>€10</strong> spent</div>
        <div>✅ Get a <strong style="color:#22C55E;">free gift</strong> every <strong>10 points</strong></div>
        <div>✅ Show your phone number at checkout</div>
      </div>
    </div>

    <!-- Card number reminder -->
    <div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);border-radius:12px;padding:16px;text-align:center;margin-bottom:24px;">
      <div style="font-size:12px;color:#94A3B8;margin-bottom:4px;">YOUR CARD NUMBER</div>
      <div style="font-size:20px;font-weight:800;color:#22C55E;letter-spacing:0.05em;">${cardNumber}</div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;color:#64748B;font-size:12px;line-height:1.6;">
      <p>Save this email for your records.</p>
      <p style="margin-top:8px;">© ${new Date().getFullYear()} ${storeName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${storeName} <membership@resend.dev>`,
        to: [to],
        subject: `🎉 Your ${storeName} Membership Card`,
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      return NextResponse.json({ error: err.message || 'Email send failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

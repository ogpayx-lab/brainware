'use server'
import { createAdminClient } from '@/lib/supabase/admin'

type OnboardingStep1Data = {
  ragione_sociale: string
  piva: string
  indirizzo: string
  telefono: string
  plan: string
  userId: string
}

type OnboardingStep2Data = {
  storeId: string
  userId: string
  storeName: string
  storeCity: string
  storeAddress: string
  brandName: string
  logoLetter: string
  primaryColor: string
  piva: string
}

export async function setupOrganizationAndStore(data: OnboardingStep1Data) {
  if (!data.userId) return { error: 'UserId mancante' }

  // Verifica env vars
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'CONFIG: SUPABASE_SERVICE_ROLE_KEY non impostata su Vercel' }
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { error: 'CONFIG: NEXT_PUBLIC_SUPABASE_URL non impostata' }
  }

  try {
    const admin = createAdminClient()

    // 1. Crea organizzazione
    const slug =
      data.ragione_sociale.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') +
      '-' +
      Date.now()

    const { data: org, error: orgError } = await admin
      .from('organizations')
      .insert({ name: data.ragione_sociale, slug, plan: data.plan })
      .select('id')
      .single()

    if (orgError || !org) {
      console.error('Org insert error:', orgError)
      return { error: 'Errore organizzazione: ' + (orgError?.message ?? 'unknown') }
    }

    // 2. Crea store
    const { data: storeRow, error: storeError } = await admin
      .from('stores')
      .insert({ name: data.ragione_sociale + ' Store', organization_id: org.id })
      .select('id')
      .single()

    if (storeError || !storeRow) {
      console.error('Store insert error:', storeError)
      return { error: 'Errore negozio: ' + (storeError?.message ?? 'unknown') }
    }

    // 3. Crea configurazioni store
    const [brandRes, cfgRes, bonusRes] = await Promise.all([
      admin.from('brand_config').insert({
        store_id: storeRow.id,
        brand_name: data.ragione_sociale,
        logo_letter: data.ragione_sociale[0]?.toUpperCase() || 'B',
      }),
      admin.from('store_config').insert({ store_id: storeRow.id }),
      admin.from('bonus_config').insert({ store_id: storeRow.id }),
    ])

    if (brandRes.error) console.warn('brand_config warning:', brandRes.error.message)
    if (cfgRes.error) console.warn('store_config warning:', cfgRes.error.message)
    if (bonusRes.error) console.warn('bonus_config warning:', bonusRes.error.message)

    // 4. Upsert profilo utente come owner
    const { error: userError } = await admin.from('users').upsert({
      id: data.userId,
      store_id: storeRow.id,
      full_name: data.ragione_sociale,
      role: 'owner',
    })

    if (userError) {
      console.error('User upsert error:', userError)
      return { error: 'Errore profilo: ' + userError.message }
    }

    return { storeId: storeRow.id }
  } catch (err: any) {
    console.error('ONBOARDING FATAL:', err)
    return { error: 'Errore server: ' + (err?.message ?? String(err)) }
  }
}

export async function updateStoreAndBrand(data: OnboardingStep2Data) {
  if (!data.userId || !data.storeId) return { error: 'Dati mancanti' }

  try {
    const admin = createAdminClient()

    const { error: storeError } = await admin
      .from('stores')
      .update({
        name: data.storeName,
        city: data.storeCity || null,
        address: data.storeAddress || null,
      })
      .eq('id', data.storeId)

    if (storeError) {
      return { error: 'Errore negozio: ' + storeError.message }
    }

    const { error: brandError } = await admin
      .from('brand_config')
      .update({
        brand_name: data.brandName,
        logo_letter: data.logoLetter,
        primary_color: data.primaryColor,
        piva: data.piva,
      })
      .eq('store_id', data.storeId)

    if (brandError) {
      return { error: 'Errore brand: ' + brandError.message }
    }

    return { ok: true }
  } catch (err: any) {
    console.error('STEP2 FATAL:', err)
    return { error: 'Errore server step 2: ' + (err?.message ?? String(err)) }
  }
}

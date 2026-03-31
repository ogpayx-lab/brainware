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

  // Usa direttamente il client admin (service role bypassa RLS)
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
    return { error: 'Errore creazione organizzazione: ' + orgError?.message }
  }

  // 2. Crea store
  const { data: storeRow, error: storeError } = await admin
    .from('stores')
    .insert({ name: data.ragione_sociale + ' Store', organization_id: org.id })
    .select('id')
    .single()

  if (storeError || !storeRow) {
    console.error('Store insert error:', storeError)
    return { error: 'Errore creazione negozio: ' + storeError?.message }
  }

  // 3. Crea brand_config, store_config, bonus_config
  await admin.from('brand_config').insert({
    store_id: storeRow.id,
    brand_name: data.ragione_sociale,
    logo_letter: data.ragione_sociale[0]?.toUpperCase() || 'B',
  })
  await admin.from('store_config').insert({ store_id: storeRow.id })
  await admin.from('bonus_config').insert({ store_id: storeRow.id })

  // 4. Upsert profilo utente come owner
  const { error: userError } = await admin.from('users').upsert({
    id: data.userId,
    store_id: storeRow.id,
    full_name: data.ragione_sociale,
    role: 'owner',
  })

  if (userError) {
    console.error('User upsert error:', userError)
    return { error: 'Errore impostazione profilo: ' + userError?.message }
  }

  return { storeId: storeRow.id }
}

export async function updateStoreAndBrand(data: OnboardingStep2Data) {
  if (!data.userId || !data.storeId) return { error: 'Dati mancanti' }

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
    return { error: 'Errore aggiornamento negozio: ' + storeError?.message }
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
    return { error: 'Errore aggiornamento brand: ' + brandError?.message }
  }

  return { ok: true }
}

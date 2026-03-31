import { createClient } from '@supabase/supabase-js'

// Admin client — usa la Service Role Key, bypassa RLS
// DA USARE SOLO in Server Actions / Route Handlers, MAI nel client browser
export const createAdminClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )

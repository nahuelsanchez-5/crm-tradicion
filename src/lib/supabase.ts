import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!

/**
 * Cliente para usar en Client Components (browser).
 * Usa la publishable key — respeta las políticas RLS de Supabase.
 */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabasePublishableKey)
}

/**
 * Cliente para usar en Server Components y Server Actions.
 * Usa la secret key — tiene acceso completo, bypassea RLS.
 * ⚠️  Nunca exponer esta instancia al browser.
 */
export function createServerClient() {
  return createSupabaseClient(supabaseUrl, supabaseSecretKey)
}

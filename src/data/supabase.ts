// Conexión con el servidor. Hay tres formas de correr la app:
// - Con Supabase (la web publicada): cuenta y cola reales.
// - Con el servidor de ensayo (scripts/servidor-ensayo.mjs): la misma base de
//   datos corriendo en la computadora, para probar con varios usuarios a la vez.
// - Sin servidor (modo demostración): todo simulado y guardado en el dispositivo.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
/** Dirección del proyecto de Supabase (vacía si no hay). */
export const SUPABASE_URL = (url ?? '').replace(/\/+$/, '')
const clave = import.meta.env.VITE_SUPABASE_KEY as string | undefined

/** Dirección del servidor de ensayo, si se está usando. */
export const ENSAYO_URL = (import.meta.env.VITE_ENSAYO_URL as string | undefined) ?? ''
export const ENSAYO = ENSAYO_URL !== ''

export const supabase: SupabaseClient | null = url && clave && !ENSAYO
  ? createClient(url, clave, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } })
  : null

/** true cuando hay servidor: la cuenta y la cola son reales. */
export const REAL = supabase !== null || ENSAYO

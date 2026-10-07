// Conexión con Supabase (ingreso con Discord, perfiles y fotos).
// Sin los datos del proyecto, la app funciona en modo demostración:
// ingreso simulado y todo guardado en el dispositivo.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const clave = import.meta.env.VITE_SUPABASE_KEY as string | undefined

export const supabase: SupabaseClient | null = url && clave
  ? createClient(url, clave, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } })
  : null

/** true cuando el ingreso y el perfil son reales (hay servidor). */
export const REAL = supabase !== null

// Cuenta real: ingreso con Discord, perfil y foto guardados en Supabase.
// Todas las funciones devuelven el texto del problema para mostrarle al usuario.
import type { Region } from '../domain/types'
import { supabase } from './supabase'

/** Perfil tal como lo devuelve el servidor (función mi_perfil). */
export interface FilaPerfil {
  id: string
  username: string
  nick: string
  region: Region[]
  foto_url: string | null
  codigo: string
  onboarding: boolean
  referido_por: string | null
  /** Nick de quien lo invitó. */
  invito: string | null
}

const SIN_CONEXION = 'No pudimos conectar con el servidor. Revisá tu internet e intentá de nuevo.'
const SIN_BASE = 'Falta configurar la base de datos de HaxMatch.'

function problema(error: { message?: string; code?: string } | null): string {
  if (!error) return SIN_CONEXION
  // La función todavía no existe en la base: falta ejecutar el SQL.
  if (error.code === 'PGRST202' || error.code === '42883') return SIN_BASE
  if (/fetch|network|load failed/i.test(error.message ?? '')) return SIN_CONEXION
  return error.message || SIN_CONEXION
}

// ---- Código de un amigo: se valida antes de ir a Discord y se usa al terminar el registro ----

const PENDIENTE = 'haxmatch-codigo-amigo'

export function codigoPendiente(): { codigo: string; nick: string } | null {
  try {
    const d = JSON.parse(localStorage.getItem(PENDIENTE) ?? 'null')
    return d && typeof d.codigo === 'string' && typeof d.nick === 'string' ? d : null
  } catch {
    return null
  }
}

export function guardarCodigoPendiente(d: { codigo: string; nick: string } | null) {
  try {
    if (d) localStorage.setItem(PENDIENTE, JSON.stringify(d))
    else localStorage.removeItem(PENDIENTE)
  } catch {
    // Sin almacenamiento, el código no sobrevive a la vuelta de Discord.
  }
}

/** Nick del dueño del código, o null si el código no existe. */
export async function quienInvita(codigo: string): Promise<{ nick: string | null; error?: string }> {
  if (!supabase) return { nick: null, error: SIN_CONEXION }
  const { data, error } = await supabase.rpc('quien_invita', { p_codigo: codigo })
  if (error) return { nick: null, error: problema(error) }
  return { nick: typeof data === 'string' ? data : null }
}

// ---- Sesión ----

/** Manda al usuario a Discord. Si todo va bien, la página se va y vuelve ya con la sesión iniciada. */
export async function ingresarConDiscord(): Promise<string | null> {
  if (!supabase) return SIN_CONEXION
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: { redirectTo: `${window.location.origin}/` },
  })
  return error ? problema(error) : null
}

export async function salir(): Promise<void> {
  await supabase?.auth.signOut()
}

// ---- Perfil ----

export async function miPerfil(): Promise<{ perfil?: FilaPerfil; error?: string }> {
  if (!supabase) return { error: SIN_CONEXION }
  const { data, error } = await supabase.rpc('mi_perfil')
  if (error || !data) return { error: problema(error) }
  return { perfil: data as FilaPerfil }
}

export async function completarRegistro(nick: string, region: Region[], codigo?: string): Promise<{ perfil?: FilaPerfil; error?: string }> {
  if (!supabase) return { error: SIN_CONEXION }
  const { data, error } = await supabase.rpc('completar_registro', { p_nick: nick, p_region: region, p_codigo: codigo ?? null })
  if (error || !data) return { error: problema(error) }
  return { perfil: data as FilaPerfil }
}

// ---- Foto de perfil ----

const CARPETA = 'avatares'

/** Sube la foto (JPEG ya recortado) y la deja como foto del perfil. Devuelve su dirección pública. */
export async function subirFoto(uid: string, dataUrl: string): Promise<{ url?: string; error?: string }> {
  if (!supabase) return { error: SIN_CONEXION }
  try {
    const archivo = await (await fetch(dataUrl)).blob()
    const ruta = `${uid}/foto.jpg`
    const subida = await supabase.storage.from(CARPETA).upload(ruta, archivo, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' })
    if (subida.error) return { error: `No pudimos subir la foto. ${problema(subida.error)}` }
    // El archivo siempre se llama igual: la marca de tiempo evita que quede la foto vieja en caché.
    const url = `${supabase.storage.from(CARPETA).getPublicUrl(ruta).data.publicUrl}?v=${Date.now()}`
    const { error } = await supabase.from('profiles').update({ foto_url: url }).eq('id', uid)
    if (error) return { error: problema(error) }
    return { url }
  } catch {
    return { error: SIN_CONEXION }
  }
}

export async function quitarFoto(uid: string): Promise<string | null> {
  if (!supabase) return SIN_CONEXION
  const { error } = await supabase.from('profiles').update({ foto_url: null }).eq('id', uid)
  if (error) return problema(error)
  // Si el archivo no se llega a borrar no pasa nada: ya no se usa y la próxima foto lo pisa.
  await supabase.storage.from(CARPETA).remove([`${uid}/foto.jpg`])
  return null
}

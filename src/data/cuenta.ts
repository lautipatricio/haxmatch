// Cuenta real: ingreso con Discord, perfil y foto guardados en el servidor.
// Todas las funciones devuelven el texto del problema para mostrarle al usuario.
import type { Region } from '../domain/types'
import { ENSAYO, supabase } from './supabase'
import { problema, rpc, usuarioDeEnsayo } from './transporte'

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
  const r = await rpc<string | null>('quien_invita', { p_codigo: codigo })
  if (r.error) return { nick: null, error: r.error }
  return { nick: typeof r.data === 'string' ? r.data : null }
}

// ---- Sesión ----

const CLAVE_ENSAYO = 'haxmatch-ensayo-entro'
const oyentes: Array<(uid: string | null) => void> = []
const entroEnEnsayo = () => { try { return sessionStorage.getItem(CLAVE_ENSAYO) === '1' } catch { return false } }

/** Avisa quién tiene la sesión abierta (o null), al empezar y cada vez que cambia. */
export function escucharSesion(aviso: (uid: string | null) => void) {
  if (ENSAYO) {
    oyentes.push(aviso)
    aviso(entroEnEnsayo() ? usuarioDeEnsayo() : null)
    return
  }
  supabase?.auth.onAuthStateChange((_evento, sesion) => aviso(sesion?.user.id ?? null))
}

/** Manda al usuario a Discord. Si todo va bien, la página se va y vuelve ya con la sesión iniciada. */
export async function ingresarConDiscord(): Promise<string | null> {
  if (ENSAYO) {
    try { sessionStorage.setItem(CLAVE_ENSAYO, '1') } catch { /* sigue en memoria */ }
    oyentes.forEach((o) => o(usuarioDeEnsayo()))
    return null
  }
  if (!supabase) return SIN_CONEXION
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: { redirectTo: `${window.location.origin}/` },
  })
  return error ? problema(error) : null
}

export async function salir(): Promise<void> {
  if (ENSAYO) {
    try { sessionStorage.removeItem(CLAVE_ENSAYO) } catch { /* nada que limpiar */ }
    oyentes.forEach((o) => o(null))
    return
  }
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  // Sin conexión no se puede avisar al servidor: al menos se cierra en este dispositivo.
  if (error) await supabase.auth.signOut({ scope: 'local' })
}

/** Credencial de la sesión abierta, para identificarse ante la parte de servidor de la web. */
export async function tokenDeSesion(): Promise<string | null> {
  if (ENSAYO) return entroEnEnsayo() ? `ensayo:${usuarioDeEnsayo()}` : null
  if (!supabase) return null
  return (await supabase.auth.getSession()).data.session?.access_token ?? null
}

// ---- Perfil ----

export async function miPerfil(): Promise<{ perfil?: FilaPerfil; error?: string }> {
  const r = await rpc<FilaPerfil>('mi_perfil')
  return r.data ? { perfil: r.data } : { error: r.error ?? SIN_CONEXION }
}

export async function completarRegistro(nick: string, region: Region[], codigo?: string): Promise<{ perfil?: FilaPerfil; error?: string }> {
  const r = await rpc<FilaPerfil>('completar_registro', { p_nick: nick, p_region: region, p_codigo: codigo ?? null })
  return r.data ? { perfil: r.data } : { error: r.error ?? SIN_CONEXION }
}

// ---- Foto de perfil ----

const CARPETA = 'avatares'

/** Sube la foto (JPEG ya recortado) y la deja como foto del perfil. Devuelve su dirección pública. */
export async function subirFoto(uid: string, dataUrl: string): Promise<{ url?: string; error?: string }> {
  // El servidor de ensayo no guarda archivos: la foto queda en el dispositivo.
  if (ENSAYO) return { url: dataUrl }
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
  if (ENSAYO) return null
  if (!supabase) return SIN_CONEXION
  const { error } = await supabase.from('profiles').update({ foto_url: null }).eq('id', uid)
  if (error) return problema(error)
  // Si el archivo no se llega a borrar no pasa nada: ya no se usa y la próxima foto lo pisa.
  await supabase.storage.from(CARPETA).remove([`${uid}/foto.jpg`])
  return null
}

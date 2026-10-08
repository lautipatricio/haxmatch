// Cuentas de Kick: quién tiene Kick vinculado y quién está en vivo. La vinculación
// pasa por la parte de servidor de la web (/api/kick/...), que es la única que
// conoce la clave de Kick. Acá solo se pide y se muestra.
import type { Usuario } from '../domain/types'
import { tokenDeSesion } from './cuenta'
import { colorDe } from './servidor'
import { YO } from './seed'
import { SUPABASE_URL } from './supabase'
import { SIN_BASE, rpc } from './transporte'

export interface CanalKick {
  userId: string
  /** Nombre de usuario en Kick. */
  usuario: string
  /** Dirección del canal: kick.com/<slug>. */
  slug: string
  enVivo: boolean
  titulo: string | null
  vivoDesde: number | null
}

interface FilaKick {
  user_id: string; usuario: string; slug: string; en_vivo: boolean; titulo: string | null; vivo_desde: string | null
  nick: string; username: string; foto: string | null; nivel: number | null
}

export const enlaceKick = (slug: string) => `https://kick.com/${encodeURIComponent(slug)}`

/** La base todavía no tiene el paso 9: no se vuelve a preguntar. */
let sinPaso = false

/** Los jugadores con Kick vinculado (y sus datos, para mostrarlos aunque no estén en la cola). null si no se pudo saber. */
export async function leerKick(miId: string): Promise<{ canales: Record<string, CanalKick>; usuarios: Record<string, Usuario> } | null> {
  if (sinPaso) return null
  const r = await rpc<FilaKick[]>('kick_canales')
  if (r.error === SIN_BASE) sinPaso = true
  if (!r.data) return null
  const id = (u: string) => (u === miId ? YO : u)
  const canales: Record<string, CanalKick> = {}
  const usuarios: Record<string, Usuario> = {}
  for (const f of r.data) {
    const uid = id(f.user_id)
    canales[uid] = { userId: uid, usuario: f.usuario, slug: f.slug, enVivo: f.en_vivo === true, titulo: f.titulo, vivoDesde: f.vivo_desde ? Date.parse(f.vivo_desde) : null }
    usuarios[uid] = {
      id: uid, username: f.nick, discord: f.username, nivel: f.nivel ?? null, color: colorDe(f.user_id),
      foto: f.foto !== null && SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/avatares/${f.user_id}/foto.jpg?v=${encodeURIComponent(f.foto)}` : null,
    }
  }
  return { canales, usuarios }
}

export const desvincularKick = async (): Promise<string | null> => (await rpc('kick_desvincular')).error ?? null

/** Manda al usuario a Kick a dar el permiso. Devuelve el problema, si no se pudo empezar. */
export async function irAKick(): Promise<string | null> {
  const sesion = await tokenDeSesion()
  if (!sesion) return 'Primero entrá con Discord.'
  try {
    const r = await fetch('/api/kick/entrar', { method: 'POST', headers: { Authorization: `Bearer ${sesion}` }, cache: 'no-store' })
    const d = await r.json() as { url?: string; error?: string }
    if (!r.ok || !d.url || !d.url.startsWith('https://id.kick.com/')) return d.error ?? 'No pudimos empezar la vinculación. Probá de nuevo.'
    window.location.assign(d.url)
    return null
  } catch {
    return 'No pudimos conectar con el servidor. Revisá tu internet e intentá de nuevo.'
  }
}

/** Qué decirle al usuario cuando vuelve de Kick (?kick=...). */
export const RESULTADO_KICK: Record<string, { ok: boolean; texto: string }> = {
  ok: { ok: true, texto: 'Kick vinculado. Los demás ven la K verde de Kick al lado de tu nombre y cuando estás en vivo.' },
  cancelado: { ok: false, texto: 'No se vinculó: no diste el permiso en Kick.' },
  vencido: { ok: false, texto: 'La vinculación tardó demasiado o se abrió en otro navegador. Probá de nuevo.' },
  ocupada: { ok: false, texto: 'Esa cuenta de Kick ya está vinculada a otro usuario de HaxMatch.' },
  error: { ok: false, texto: 'No pudimos vincular tu cuenta de Kick. Probá de nuevo.' },
}

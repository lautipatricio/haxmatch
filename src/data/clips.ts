// Clips reales: los videos de TikTok de los usuarios que vincularon su cuenta.
// La vinculación en sí pasa por la parte de servidor de la web (/api/tiktok/...),
// que es la única que conoce la clave de TikTok. Acá solo se pide y se muestra.
import type { Reel, Usuario } from '../domain/types'
import { tokenDeSesion } from './cuenta'
import { YO } from './seed'
import { SUPABASE_URL } from './supabase'
import { rpc } from './transporte'

interface FilaReel {
  id: string; tiktok_id: string; titulo: string; hashtags: string[]; duracion: number | null
  enlace: string | null; publicado_at: string; reacciones: number
}
interface EstadoClips {
  feed: Array<FilaReel & { user_id: string; nick: string; username: string; foto: string | null; reaccione: boolean }>
  mios: Array<FilaReel & { visible: boolean; inicial: boolean }>
  tiktok: { vinculada: boolean; nombre: string | null; sincronizada_at: string | null; error: string | null } | null
}

export interface TikTokInfo {
  /** Nombre de la cuenta de TikTok vinculada. */
  nombre: string | null
  sincronizadaAt: number | null
  /** TikTok dejó de darnos acceso: hay que volver a vincular. */
  error: string | null
}

export interface ClipsLocal {
  reels: Reel[]
  misReacciones: string[]
  usuarios: Record<string, Usuario>
  tiktok: TikTokInfo | null
}

function colorDe(id: string): string {
  const colores = ['#5B8C7A', '#8C7A5B', '#7A5B8C', '#5B6F8C', '#8C5B62', '#6F8C5B', '#8C6A5B', '#5B8C8A', '#8C825B']
  let n = 0
  for (const c of id) n = (n * 31 + c.charCodeAt(0)) >>> 0
  return colores[n % colores.length]
}

export async function leerClips(miId: string): Promise<{ clips?: ClipsLocal; error?: string }> {
  const r = await rpc<EstadoClips>('clips')
  if (!r.data) return { error: r.error }
  const e = r.data
  const id = (u: string) => (u === miId ? YO : u)
  const usuarios: Record<string, Usuario> = {}
  const porId = new Map<string, Reel>()
  const base = (f: FilaReel): Omit<Reel, 'userId' | 'visible' | 'reacciones'> => ({
    id: f.id, origen: 'tiktok', titulo: f.titulo, hashtags: f.hashtags ?? [], publicadoAt: Date.parse(f.publicado_at),
    tiktokId: f.tiktok_id, enlace: f.enlace ?? undefined, duracion: f.duracion ?? undefined,
  })
  for (const f of e.feed ?? []) {
    const foto = f.foto !== null && SUPABASE_URL
      ? `${SUPABASE_URL}/storage/v1/object/public/avatares/${f.user_id}/foto.jpg?v=${encodeURIComponent(f.foto)}`
      : null
    usuarios[id(f.user_id)] = { id: id(f.user_id), username: f.nick, discord: f.username, nivel: null, color: colorDe(f.user_id), foto }
    // En pantalla se muestra "las de los demás + la mía", así que acá va sin la mía.
    porId.set(f.id, { ...base(f), userId: id(f.user_id), visible: true, reacciones: f.reacciones - (f.reaccione ? 1 : 0) })
  }
  for (const m of e.mios ?? []) {
    const enFeed = porId.get(m.id)
    porId.set(m.id, { ...base(m), userId: YO, visible: m.visible, inicial: m.inicial, reacciones: enFeed?.reacciones ?? m.reacciones })
  }
  return {
    clips: {
      reels: [...porId.values()],
      misReacciones: (e.feed ?? []).filter((f) => f.reaccione).map((f) => f.id),
      usuarios,
      tiktok: e.tiktok ? { nombre: e.tiktok.nombre, sincronizadaAt: e.tiktok.sincronizada_at ? Date.parse(e.tiktok.sincronizada_at) : null, error: e.tiktok.error } : null,
    },
  }
}

const hacer = async (nombre: string, args: Record<string, unknown> = {}): Promise<string | null> =>
  (await rpc(nombre, args)).error ?? null

export const clipsApi = {
  visible: (reel: string, visible: boolean) => hacer('reel_visible', { p_reel: reel, p_visible: visible }),
  reaccionar: (reel: string, marcar: boolean) => hacer('reaccionar', { p_reel: reel, p_marcar: marcar }),
  actualizar: () => hacer('tiktok_actualizar'),
  desvincular: () => hacer('tiktok_desvincular'),
}

/** ¿La web ya tiene cargadas las claves de TikTok? */
export async function tiktokHabilitado(): Promise<boolean> {
  try {
    const r = await fetch('/api/tiktok/estado', { cache: 'no-store' })
    return ((await r.json()) as { configurado?: boolean }).configurado === true
  } catch {
    return false
  }
}

/**
 * Empieza la vinculación: si todo va bien, la página se va a TikTok y vuelve
 * sola a "Mis videos". Devuelve el problema si no se pudo empezar.
 */
export async function irATikTok(): Promise<string | null> {
  const sesion = await tokenDeSesion()
  if (!sesion) return 'Primero entrá con Discord.'
  try {
    const r = await fetch('/api/tiktok/entrar', { method: 'POST', headers: { Authorization: `Bearer ${sesion}` }, cache: 'no-store' })
    const d = await r.json() as { url?: string; error?: string }
    if (!r.ok || !d.url || !d.url.startsWith('https://www.tiktok.com/')) return d.error ?? 'No pudimos empezar la vinculación. Probá de nuevo.'
    window.location.assign(d.url)
    return null
  } catch {
    return 'No pudimos conectar con el servidor. Revisá tu internet e intentá de nuevo.'
  }
}

/** Qué decirle al usuario cuando vuelve de TikTok (?tiktok=...). */
export const RESULTADO_TIKTOK: Record<string, { ok: boolean; texto: string }> = {
  ok: { ok: true, texto: 'TikTok vinculado. Importamos tus videos: los que tienen #haxball o #haxmatch ya están en Clips.' },
  cancelado: { ok: false, texto: 'No se vinculó: no diste el permiso en TikTok.' },
  vencido: { ok: false, texto: 'La vinculación tardó demasiado o se abrió en otro navegador. Probá de nuevo.' },
  ocupada: { ok: false, texto: 'Esa cuenta de TikTok ya está vinculada a otro usuario de HaxMatch.' },
  permiso: { ok: false, texto: 'Para mostrar tus clips hace falta el permiso de ver tus videos. Probá de nuevo y dejalo marcado.' },
  error: { ok: false, texto: 'No pudimos vincular tu cuenta de TikTok. Probá de nuevo.' },
}

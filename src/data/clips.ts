// Clips reales: los videos de TikTok de los usuarios que vincularon su cuenta.
// La vinculación en sí pasa por la parte de servidor de la web (/api/tiktok/...),
// que es la única que conoce la clave de TikTok. Acá solo se pide y se muestra.
import type { ClipLink, Reel, Usuario } from '../domain/types'
import { tokenDeSesion } from './cuenta'
import { YO } from './seed'
import { SUPABASE_URL } from './supabase'
import { SIN_BASE, rpc } from './transporte'

interface FilaReel {
  id: string; tiktok_id: string; titulo: string; hashtags: string[]; duracion: number | null
  enlace: string | null; portada?: string | null; publicado_at: string; reacciones: number
}
interface EstadoClips {
  feed: Array<FilaReel & { user_id: string; nick: string; username: string; foto: string | null; reaccione: boolean; nivel?: number | null }>
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

let conNiveles = true
let sinNiveles = 0

export async function leerClips(miId: string): Promise<{ clips?: ClipsLocal; error?: string }> {
  // Con el paso 5 viene además el nivel de cada autor. Sin él, los clips andan igual.
  let r = conNiveles ? await rpc<EstadoClips>('clips_completo') : { error: SIN_BASE } as { data?: EstadoClips; error?: string }
  if (r.error === SIN_BASE) {
    conNiveles = ++sinNiveles % 10 === 0
    r = await rpc<EstadoClips>('clips')
  }
  if (!r.data) return { error: r.error }
  const e = r.data
  const id = (u: string) => (u === miId ? YO : u)
  const usuarios: Record<string, Usuario> = {}
  const porId = new Map<string, Reel>()
  const base = (f: FilaReel): Omit<Reel, 'userId' | 'visible' | 'reacciones'> => ({
    id: f.id, origen: 'tiktok', titulo: f.titulo, hashtags: f.hashtags ?? [], publicadoAt: Date.parse(f.publicado_at),
    tiktokId: f.tiktok_id, enlace: f.enlace ?? undefined, duracion: f.duracion ?? undefined,
    portada: f.portada?.startsWith('https://') ? f.portada : undefined,
  })
  for (const f of e.feed ?? []) {
    const foto = f.foto !== null && SUPABASE_URL
      ? `${SUPABASE_URL}/storage/v1/object/public/avatares/${f.user_id}/foto.jpg?v=${encodeURIComponent(f.foto)}`
      : null
    usuarios[id(f.user_id)] = { id: id(f.user_id), username: f.nick, discord: f.username, nivel: typeof f.nivel === 'number' ? f.nivel : null, color: colorDe(f.user_id), foto }
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
  /**
   * Le pide a TikTok los videos nuevos de las cuentas vinculadas. Devuelve a cuántas
   * se les pidió (después hay que esperar unos segundos y volver a leer), o el problema.
   */
  refrescar: async (): Promise<{ pedidas: number; error?: string }> => {
    const r = await rpc<number>('clips_refrescar')
    // Si la base todavía no tiene esta función, se sigue con lo que hay.
    if (r.error) return r.error === SIN_BASE ? { pedidas: 0 } : { pedidas: 0, error: r.error }
    return { pedidas: Number(r.data) || 0 }
  },
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

// ---------- Clips subidos por link (paso 13) ----------

interface FilaLink {
  id: string; user_id: string; plataforma: 'tiktok' | 'youtube'; video_id: string; enlace: string; titulo: string
  estado: ClipLink['estado']; motivo: string | null; creado_at: string; revisado_at: string | null
  nick: string; username: string; foto: string | null; nivel: number | null; reacciones: number; reaccione: boolean
}
interface EstadoLinks { feed: FilaLink[]; mios: FilaLink[]; recientes?: FilaLink[] | null }

export interface LinksLocal {
  /** Los aprobados, listos para el feed. */
  reels: Reel[]
  misReacciones: string[]
  mios: ClipLink[]
  /** Solo para quien administra: los últimos publicados (para poder quitarlos). null si no administro. */
  recientes: ClipLink[] | null
  usuarios: Record<string, Usuario>
}

const aLink = (f: FilaLink, id: (u: string) => string): ClipLink => ({
  id: f.id, userId: id(f.user_id), plataforma: f.plataforma, videoId: f.video_id, enlace: f.enlace, titulo: f.titulo,
  estado: f.estado, motivo: f.motivo, creadoAt: Date.parse(f.creado_at), revisadoAt: f.revisado_at ? Date.parse(f.revisado_at) : null,
})

/** Un clip aprobado, como va en el feed. */
export function reelDeLink(c: ClipLink, reacciones: number): Reel {
  return {
    id: c.id, userId: c.userId, origen: 'link', titulo: c.titulo, hashtags: [], visible: true,
    publicadoAt: c.revisadoAt ?? c.creadoAt, reacciones, enlace: c.enlace,
    ...(c.plataforma === 'tiktok' ? { tiktokId: c.videoId } : { youtubeId: c.videoId }),
  }
}

/** Si la base todavía no tiene el paso 13, devuelve vacío sin error. */
export async function leerLinks(miId: string): Promise<LinksLocal | null> {
  const r = await rpc<EstadoLinks>('clips_link')
  if (!r.data) return null
  const id = (u: string) => (u === miId ? YO : u)
  const usuarios: Record<string, Usuario> = {}
  const anotar = (f: FilaLink) => {
    const foto = f.foto !== null && SUPABASE_URL
      ? `${SUPABASE_URL}/storage/v1/object/public/avatares/${f.user_id}/foto.jpg?v=${encodeURIComponent(f.foto)}`
      : null
    if (f.user_id !== miId) usuarios[f.user_id] = { id: f.user_id, username: f.nick, discord: f.username, nivel: typeof f.nivel === 'number' ? f.nivel : null, color: colorDe(f.user_id), foto }
  }
  const e = r.data
  for (const f of [...(e.feed ?? []), ...(e.recientes ?? [])]) anotar(f)
  return {
    // Como en los de TikTok, la reacción propia se suma en pantalla.
    reels: (e.feed ?? []).map((f) => reelDeLink(aLink(f, id), f.reacciones - (f.reaccione ? 1 : 0))),
    misReacciones: (e.feed ?? []).filter((f) => f.reaccione).map((f) => f.id),
    mios: (e.mios ?? []).map((f) => aLink(f, id)),
    recientes: e.recientes ? e.recientes.map((f) => aLink(f, id)) : null,
    usuarios,
  }
}

export const linksApi = {
  subir: async (enlace: string, titulo: string): Promise<{ error?: string }> => {
    const r = await rpc('subir_clip', { p_enlace: enlace, p_titulo: titulo })
    return r.error ? { error: r.error === SIN_BASE ? 'Subir clips todavía no está disponible.' : r.error } : {}
  },
  borrar: (id: string) => hacer('borrar_clip', { p_id: id }),
  quitar: (id: string, motivo: string) => hacer('admin_quitar_clip', { p_id: id, p_motivo: motivo || null }),
  reaccionar: (id: string, marcar: boolean) => hacer('reaccionar_clip', { p_id: id, p_marcar: marcar }),
}

/** Abre un link corto de TikTok (el del botón Compartir del celular) y devuelve el link completo del video. */
export async function abrirLinkCorto(url: string): Promise<{ url?: string; error?: string }> {
  try {
    const r = await fetch('/api/clips/abrir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }), cache: 'no-store' })
    const d = await r.json() as { url?: string; error?: string }
    if (r.ok && d.url) return { url: d.url }
    return { error: d.error ?? 'No pudimos abrir ese link. Abrí el video y copiá su link completo.' }
  } catch {
    return { error: 'No pudimos abrir ese link. Abrí el video y copiá su link completo.' }
  }
}

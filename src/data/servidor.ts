// La cola real: qué pide la app al servidor y cómo traduce lo que recibe a la
// forma que usan las pantallas. Las reglas viven en el servidor (supabase/02_cola.sql);
// acá solo se llama a sus funciones.
import type { Busqueda, Cancha, Formato, Match, Mensaje, Posicion, Region, Usuario } from '../domain/types'
import { YO } from './seed'
import { SUPABASE_URL } from './supabase'
import { rpc } from './transporte'

// ---- Lo que devuelve estado_cola ----

interface FilaBusqueda {
  id: string; user_id: string; modo: 'jugador' | 'sala'
  formato: Formato[] | null; posicion: Posicion[]; cancha: Cancha[]; region: Region[]
  nombre_sala: string | null; faltan: number | null; completa_at: string | null
  creada_at: string; expira_at: string | null; estado: 'activa' | 'agrupada'
  lider_id: string | null; equipo_listo: boolean; match_id: string | null
  rechazados: string[]; avisar: boolean | null
}
interface FilaMensaje {
  id: string; de: string; a: string; texto: string; creado_at: string
  estado: Mensaje['estado']; auto: boolean; con: string[]
}
interface FilaMatch {
  id: string; creado_por: string; cancha: Cancha; nombre_sala: string
  creado_at: string; contado_at: string | null
  participantes: Array<{
    user_id: string; equipo: 'A' | 'B'; confirmado_at: string | null; entro_at: string | null
    descarto: boolean; salio_at: string | null
  }>
}
export interface EstadoCola {
  ahora: string
  busquedas: FilaBusqueda[]
  mensajes: FilaMensaje[]
  matches: FilaMatch[]
  /** foto: versión de la foto de perfil, o null si no tiene. */
  usuarios: Array<{ id: string; nick: string; username: string; foto: string | null }>
  resumen: Resumen | null
}

/** Totales del perfil: partidos que contaron y partidos anotados que no se jugaron. */
export interface Resumen {
  jugados: number
  perdidos: number
}

export interface ColaLocal {
  usuarios: Record<string, Usuario>
  busquedas: Busqueda[]
  mensajes: Mensaje[]
  matches: Match[]
  resumen: Resumen
  /** Diferencia entre el reloj del servidor y el del dispositivo. */
  desfaseMs: number
}

const ms = (t: string | null): number | null => (t ? Date.parse(t) : null)
/** Tiempo de gracia para responder el cartel de los 15 minutos (igual que en el servidor). */
export const GRACIA_MS = 2 * 60 * 1000

/** Color de fondo del avatar para quien no tiene foto, siempre el mismo para cada usuario. */
function colorDe(id: string): string {
  const colores = ['#5B8C7A', '#8C7A5B', '#7A5B8C', '#5B6F8C', '#8C5B62', '#6F8C5B', '#8C6A5B', '#5B8C8A', '#8C825B']
  let n = 0
  for (const c of id) n = (n * 31 + c.charCodeAt(0)) >>> 0
  return colores[n % colores.length]
}

/**
 * Traduce el estado del servidor a la forma local. En las pantallas "yo" siempre
 * es el mismo id, así que el id real del usuario se reemplaza por ese.
 */
export function aLocal(e: EstadoCola, miId: string): ColaLocal {
  const id = (u: string) => (u === miId ? YO : u)
  const ahora = Date.parse(e.ahora)

  const usuarios: Record<string, Usuario> = {}
  for (const u of e.usuarios) {
    // La dirección de la foto se arma acá, con la carpeta del usuario: del servidor solo llega la versión.
    const foto = u.foto !== null && SUPABASE_URL
      ? `${SUPABASE_URL}/storage/v1/object/public/avatares/${u.id}/foto.jpg?v=${encodeURIComponent(u.foto)}`
      : null
    usuarios[id(u.id)] = { id: id(u.id), username: u.nick, discord: u.username, nivel: null, color: colorDe(u.id), foto }
  }

  const porId = new Map(e.busquedas.map((b) => [b.id, b]))
  const sumadosA = (b: FilaBusqueda) => e.busquedas.filter((x) => x.lider_id === b.id && x.estado === 'agrupada')
  const miFila = e.busquedas.find((b) => b.user_id === miId)
  // Si me sumé a la búsqueda de otro, esa es la búsqueda que manda.
  const miLider = miFila?.estado === 'agrupada' && miFila.lider_id ? porId.get(miFila.lider_id) : undefined

  const busquedas: Busqueda[] = e.busquedas.map((b) => {
    const base: Busqueda = {
      id: b.id,
      userId: id(b.user_id),
      modo: b.modo,
      formato: b.formato,
      posicion: b.posicion,
      cancha: b.cancha,
      region: b.region,
      nombreSala: b.nombre_sala ?? undefined,
      faltan: b.faltan ?? undefined,
      completaAt: ms(b.completa_at),
      creadaAt: Date.parse(b.creada_at),
      expiraAt: ms(b.expira_at),
      estado: b.estado,
      grupo: sumadosA(b).map((x) => id(x.user_id)),
      equipoListo: b.equipo_listo,
      matchId: b.match_id ?? undefined,
      rechazados: b.rechazados.map(id),
      avisar: b.avisar,
    }
    if (miLider && b.id === miFila?.id) {
      // Para mí, la búsqueda del grupo se ve como propia: mismo reloj y mismos datos,
      // con quien la armó y los demás sumados como compañeros.
      return {
        ...base,
        estado: 'activa',
        liderId: id(miLider.user_id),
        formato: miLider.formato,
        cancha: miLider.cancha,
        region: miLider.region,
        creadaAt: Date.parse(miLider.creada_at),
        expiraAt: ms(miLider.expira_at),
        equipoListo: false,
        grupo: [id(miLider.user_id), ...sumadosA(miLider).filter((x) => x.user_id !== miId).map((x) => id(x.user_id))],
      }
    }
    // Quien armó mi grupo ya está conmigo: no aparece en la lista de jugadores.
    if (miLider && b.id === miLider.id) return { ...base, estado: 'agrupada' }
    // Mi búsqueda cumplió su tiempo: se ofrece renovar mientras dura la gracia.
    if (b.user_id === miId && b.estado === 'activa' && b.modo === 'jugador' && base.expiraAt !== null && base.expiraAt <= ahora) {
      return { ...base, ofertaHasta: base.expiraAt + GRACIA_MS }
    }
    return base
  })

  // Cuando la app me acerca a una sala, yo no escribí nada: ese pedido solo lo ve el dueño de la sala.
  const mensajes: Mensaje[] = e.mensajes.filter((m) => !(m.auto && m.de === miId)).map((m) => ({
    id: m.id, de: id(m.de), a: id(m.a), texto: m.texto, at: Date.parse(m.creado_at),
    estado: m.estado, auto: m.auto, con: m.con.map(id),
  }))

  const matches: Match[] = e.matches.map((m) => ({
    id: m.id,
    creadoPor: id(m.creado_por),
    formato: null,
    cancha: m.cancha,
    nombreSala: m.nombre_sala,
    createdAt: Date.parse(m.creado_at),
    contadoAt: ms(m.contado_at),
    descartado: m.participantes.find((p) => p.user_id === miId)?.descarto ?? false,
    participantes: m.participantes.map((p) => ({
      userId: id(p.user_id), equipo: p.equipo, confirmadoAt: ms(p.confirmado_at), entroAt: ms(p.entro_at),
      salioAt: ms(p.salio_at),
    })),
  }))

  const resumen = { jugados: Number(e.resumen?.jugados ?? 0), perdidos: Number(e.resumen?.perdidos ?? 0) }
  return { usuarios, busquedas, mensajes, matches, resumen, desfaseMs: ahora - Date.now() }
}

// ---- Llamadas ----

export async function leerCola(): Promise<{ estado?: EstadoCola; error?: string }> {
  const r = await rpc<EstadoCola>('estado_cola')
  return r.data ? { estado: r.data } : { error: r.error }
}

/** Cada acción devuelve el texto del problema, o null si salió bien. */
const hacer = async (nombre: string, args: Record<string, unknown> = {}): Promise<string | null> =>
  (await rpc(nombre, args)).error ?? null

export const cola = {
  crearBusqueda: (d: {
    modo: 'jugador' | 'sala'; formato: Formato[] | null; posicion: Posicion[]; cancha: Cancha[]; region: Region[]
    duracion: '15min' | 'match'; nombreSala?: string; faltan?: number
  }) => hacer('crear_busqueda', {
    p_modo: d.modo, p_formato: d.formato, p_posicion: d.posicion, p_cancha: d.cancha, p_region: d.region,
    p_duracion: d.duracion, p_nombre_sala: d.nombreSala ?? null, p_faltan: d.faltan ?? null,
  }),
  cancelar: () => hacer('cancelar_busqueda'),
  responderAviso: (avisar: boolean) => hacer('responder_aviso', { p_avisar: avisar }),
  renovar: () => hacer('renovar_busqueda'),
  enviarMensaje: (a: string) => hacer('enviar_mensaje', { p_a: a }),
  responderMensaje: (id: string, aceptar: boolean) => hacer('responder_mensaje', { p_id: id, p_aceptar: aceptar }),
  marcarEntro: (usuario: string) => hacer('marcar_entro', { p_user: usuario }),
  marcarSalio: (usuario: string, match?: string) => hacer('marcar_salio', { p_user: usuario, p_match: match ?? null }),
  confirmar: (match: string) => hacer('confirmar_match', { p_match: match }),
  descartar: (match: string) => hacer('descartar_match', { p_match: match }),
  convertirEnSala: (nombre: string, faltan: number, entreNosotros: boolean) =>
    hacer('convertir_en_sala', { p_nombre: nombre, p_faltan: faltan, p_entre_nosotros: entreNosotros }),
  reportar: (usuario: string, motivo: string, detalle: string) =>
    hacer('reportar', { p_user: usuario, p_motivo: motivo, p_detalle: detalle }),
}

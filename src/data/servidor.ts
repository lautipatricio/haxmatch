// La cola real: qué pide la app al servidor y cómo traduce lo que recibe a la
// forma que usan las pantallas. Las reglas viven en el servidor (supabase/02_cola.sql);
// acá solo se llama a sus funciones.
import type { Busqueda, Cancha, EventoPuntos, Formato, Match, Mensaje, MensajeChat, Posicion, PuntosServidor, Referido, Region, TipoPunto, Usuario } from '../domain/types'
import { YO } from './seed'
import { SUPABASE_URL } from './supabase'
import { SIN_BASE, rpc } from './transporte'

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
  /** Solo lo manda el servidor desde que las salas invitan (paso 2 actualizado). */
  dijo_no?: boolean
  rechazo_at?: string | null
}
interface FilaMatch {
  /** null si quien creó la sala borró su cuenta. */
  id: string; creado_por: string | null; cancha: Cancha; nombre_sala: string
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
  usuarios: FilaUsuario[]
  resumen: Resumen | null
  /** Amigos y solicitudes. relacion: amigo, enviada (la mandé yo) o recibida. */
  amigos?: Array<FilaUsuario & { relacion: 'amigo' | 'enviada' | 'recibida' }>
  /** Mis puntos y mis referidos (paso 5). Si la base todavía no lo tiene, no viene. */
  puntos?: {
    total: number | null; racha: number; conteos: Partial<Record<TipoPunto, number>>; de_referidos: number
    eventos: Array<{ id: number; tipo: TipoPunto; puntos: number; referencia: string; dato: string | null; creado_at: string }>
    referidos: Array<FilaUsuario & { amistosos: number; puntos: number | null }>
  }
  /** Quiénes tienen la app abierta ahora (paso 3 actualizado). */
  conectados?: string[]
}
/** nivel: solo viene con el paso 5. */
interface FilaUsuario { id: string; nick: string; username: string; foto: string | null; nivel?: number | null }

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
  amigos: string[]
  /** Solicitudes de amistad que me mandaron. */
  solicitudes: string[]
  /** Solicitudes que mandé y todavía no respondieron. */
  enviadas: string[]
  /** Diferencia entre el reloj del servidor y el del dispositivo. */
  desfaseMs: number
  /** Puntos según el servidor. null si la base todavía no los lleva (entonces se calculan en el dispositivo). */
  puntos: PuntosServidor | null
  /** Movimientos de puntos de los últimos días. */
  eventos: EventoPuntos[]
  referidos: Referido[]
  conectados: string[]
}

const ms = (t: string | null): number | null => (t ? Date.parse(t) : null)
/** Tiempo de gracia para responder el cartel de los 15 minutos (igual que en el servidor). */
export const GRACIA_MS = 2 * 60 * 1000

/** Color de fondo del avatar para quien no tiene foto, siempre el mismo para cada usuario. */
export function colorDe(id: string): string {
  const colores = ['#5B8C7A', '#8C7A5B', '#7A5B8C', '#5B6F8C', '#8C5B62', '#6F8C5B', '#8C6A5B', '#5B8C8A', '#8C825B']
  let n = 0
  for (const c of id) n = (n * 31 + c.charCodeAt(0)) >>> 0
  return colores[n % colores.length]
}

/** La foto de otro usuario: del servidor solo llega la versión; la dirección se arma con su carpeta. */
function fotoDe(id: string, version: string | null): string | null {
  return version !== null && SUPABASE_URL
    ? `${SUPABASE_URL}/storage/v1/object/public/avatares/${id}/foto.jpg?v=${encodeURIComponent(version)}`
    : null
}

/**
 * Traduce el estado del servidor a la forma local. En las pantallas "yo" siempre
 * es el mismo id, así que el id real del usuario se reemplaza por ese.
 */
export function aLocal(e: EstadoCola, miId: string): ColaLocal {
  const id = (u: string) => (u === miId ? YO : u)
  const ahora = Date.parse(e.ahora)

  const usuarios: Record<string, Usuario> = {}
  for (const u of [...e.usuarios, ...(e.amigos ?? []), ...(e.puntos?.referidos ?? [])]) {
    const foto = fotoDe(u.id, u.foto)
    usuarios[id(u.id)] = { id: id(u.id), username: u.nick, discord: u.username, nivel: typeof u.nivel === 'number' ? u.nivel : null, color: colorDe(u.id), foto }
  }
  const conRelacion = (r: 'amigo' | 'enviada' | 'recibida') => (e.amigos ?? []).filter((a) => a.relacion === r).map((a) => a.id)

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

  // Los pedidos que armaba la app sola (antes de que las salas invitaran) no los escribió nadie: solo los ve el dueño de la sala.
  const mensajes: Mensaje[] = e.mensajes.filter((m) => !(m.auto && m.de === miId)).map((m) => ({
    id: m.id, de: id(m.de), a: id(m.a), texto: m.texto, at: Date.parse(m.creado_at),
    estado: m.estado, auto: m.auto, con: m.con.map(id), dijoNo: m.dijo_no,
    rechazoAt: m.rechazo_at ? Date.parse(m.rechazo_at) : m.rechazo_at === null ? null : undefined,
  }))

  const matches: Match[] = e.matches.map((m) => ({
    id: m.id,
    creadoPor: m.creado_por ? id(m.creado_por) : '',
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
  const p = e.puntos
  return {
    usuarios, busquedas, mensajes, matches, resumen,
    amigos: conRelacion('amigo'), solicitudes: conRelacion('recibida'), enviadas: conRelacion('enviada'),
    desfaseMs: ahora - Date.now(),
    puntos: p ? { total: Number(p.total ?? 0), racha: Number(p.racha ?? 0), conteos: p.conteos ?? {}, deReferidos: Number(p.de_referidos ?? 0) } : null,
    eventos: (p?.eventos ?? []).map((x) => ({
      id: `p${x.id}`, userId: YO, tipo: x.tipo, puntos: x.puntos, fecha: Date.parse(x.creado_at), referencia: x.referencia,
      // En un amistoso, el dato es el rival; en una racha, cuántos días.
      rival: x.dato ?? undefined,
    })),
    referidos: (p?.referidos ?? []).map((r) => ({
      userId: r.id, amistosos: Number(r.amistosos), acreditado: r.puntos !== null, puntos: r.puntos ?? undefined,
    })),
    conectados: (e.conectados ?? []).map(id),
  }
}

// ---- Llamadas ----

/** Las funciones que devuelven el estado, de la más completa a la más básica. */
const ESTADOS = ['estado_completo', 'estado', 'estado_cola'] as const
let desdeCual = 0
let pedidosDeEstado = 0

export async function leerCola(): Promise<{ estado?: EstadoCola; error?: string }> {
  // Se avisa si la app está a la vista: con la app en segundo plano, lo que pase llega como notificación.
  const visible = typeof document === 'undefined' || document.visibilityState === 'visible'
  // Se pide la versión más completa que tenga la base. Si le falta un paso (puntos, o
  // amigos y avisos), la app sigue con lo que hay y cada tanto vuelve a probar la completa.
  if (++pedidosDeEstado % 40 === 0) desdeCual = 0
  for (;;) {
    const nombre = ESTADOS[desdeCual]
    const r = await rpc<EstadoCola>(nombre, nombre === 'estado_cola' ? {} : { p_visible: visible })
    if (r.error === SIN_BASE && desdeCual < ESTADOS.length - 1) {
      desdeCual++
      continue
    }
    return r.data ? { estado: r.data } : { error: r.error }
  }
}

/** Bloqueos guardados en el servidor y estado de la cuenta (paso 6). null si la base todavía no lo tiene. */
export async function leerSeguridad(): Promise<{ bloqueados: Usuario[]; suspension: string | null } | null> {
  const r = await rpc<{ bloqueados: FilaUsuario[]; suspension: string | null }>('seguridad')
  if (!r.data) return null
  return {
    bloqueados: (r.data.bloqueados ?? []).map((u) => ({
      id: u.id, username: u.nick, discord: u.username, nivel: null, color: colorDe(u.id),
      foto: fotoDe(u.id, u.foto),
    })),
    suspension: r.data.suspension ?? null,
  }
}

/** La base todavía no sabe mostrar el perfil de otro (falta el paso 7): no se vuelve a preguntar. */
let sinFicha = false

/**
 * Lo que se ve del perfil de otro jugador: cuántos amistosos jugó y su nivel.
 * null si no se pudo saber (sin conexión, base sin actualizar, o hay un bloqueo entre los dos).
 */
export async function leerFicha(userId: string): Promise<{ jugados: number; nivel: number | null } | null> {
  if (sinFicha) return null
  const r = await rpc<{ jugados: number; nivel: number | null } | null>('ficha_jugador', { p_user: userId })
  if (r.error === SIN_BASE) sinFicha = true
  if (!r.data) return null
  return { jugados: Number(r.data.jugados) || 0, nivel: r.data.nivel ?? null }
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
  bloquear: (user: string) => hacer('bloquear', { p_user: user }),
  desbloquear: (user: string) => hacer('desbloquear', { p_user: user }),
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
  pedirAmistad: (usuario: string) => hacer('pedir_amistad', { p_user: usuario }),
  responderAmistad: (usuario: string, aceptar: boolean) => hacer('responder_amistad', { p_user: usuario, p_aceptar: aceptar }),
  quitarAmigo: (usuario: string) => hacer('quitar_amigo', { p_user: usuario }),
  guardarSuscripcion: (endpoint: string, p256dh: string, auth: string) =>
    hacer('guardar_suscripcion', { p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth }),
  quitarSuscripcion: (endpoint: string) => hacer('quitar_suscripcion', { p_endpoint: endpoint }),
}

// ---- Chat general (paso 8) ----

interface FilaChat {
  id: number; user_id: string; texto: string; creado_at: string
  nick: string; username: string; foto: string | null; nivel: number | null
}

/** Los mensajes de las últimas 24 horas, con sus autores. */
export async function leerChat(miId: string): Promise<{ mensajes?: MensajeChat[]; usuarios?: Record<string, Usuario>; error?: string }> {
  const r = await rpc<FilaChat[]>('chat_leer')
  if (!r.data) return { error: r.error === SIN_BASE ? 'El chat todavía no está habilitado.' : r.error }
  const id = (u: string) => (u === miId ? YO : u)
  const usuarios: Record<string, Usuario> = {}
  for (const f of r.data) {
    usuarios[id(f.user_id)] = { id: id(f.user_id), username: f.nick, discord: f.username, nivel: f.nivel ?? null, color: colorDe(f.user_id), foto: fotoDe(f.user_id, f.foto) }
  }
  return {
    mensajes: r.data.map((f) => ({ id: String(f.id), userId: id(f.user_id), texto: f.texto, at: Date.parse(f.creado_at) })),
    usuarios,
  }
}

export const chat = {
  enviar: (texto: string) => hacer('chat_enviar', { p_texto: texto }),
  borrar: (id: string) => hacer('chat_borrar', { p_id: Number(id) }),
}

// ---- Ajustes propios y panel de administración (paso 8) ----

/** Si administro y si muestro que estoy conectado. null si la base todavía no tiene el paso 8. */
export async function leerAjustes(): Promise<{ admin: boolean; mostrarConectado: boolean; nickCambiadoAt: number | null } | null> {
  const r = await rpc<{ admin: boolean; mostrar_conectado: boolean; nick_cambiado_at?: string | null }>('mis_ajustes')
  return r.data
    ? {
        admin: r.data.admin === true, mostrarConectado: r.data.mostrar_conectado !== false,
        nickCambiadoAt: r.data.nick_cambiado_at ? Date.parse(r.data.nick_cambiado_at) : null,
      }
    : null
}

/** Cambiar mi nick. Las reglas (15 días, que no lo use otro) las controla la base. */
export async function cambiarNick(nick: string): Promise<{ nick?: string; error?: string }> {
  const r = await rpc<{ nick: string }>('cambiar_nick', { p_nick: nick })
  if (r.error === SIN_BASE) return { error: 'Todavía no se puede cambiar el nick. Probá más tarde.' }
  return r.data ? { nick: r.data.nick } : { error: r.error ?? 'No pudimos cambiar tu nick. Probá de nuevo.' }
}

export const guardarMostrarConectado = (mostrar: boolean) => hacer('guardar_mostrar_conectado', { p_mostrar: mostrar })

export interface PersonaPanel { id: string; nick: string; username: string; foto?: string | null; conectado?: boolean; creadoAt?: number }
export interface Panel {
  registrados: number; nuevosHoy: number; nuevos7: number; activosHoy: number; activos7: number
  conectados: number; buscando: number; amistososHoy: number; amistosos: number; mensajesChat: number
  ultimos: PersonaPanel[]
  reportados: Array<PersonaPanel & {
    reportes: number; deDistintos: number; motivos: string; ultimo: number; suspendidoHasta: number | null
    detalle: Array<{ cuando: number; motivo: string; detalle: string }>
  }>
  suspendidos: Array<PersonaPanel & { hasta: number; motivo: string | null }>
}

interface FilaPanel {
  registrados: number; nuevos_hoy: number; nuevos_7_dias: number; activos_hoy: number; activos_7_dias: number
  conectados: number; buscando: number; amistosos_hoy: number; amistosos: number; mensajes_chat: number
  ultimos: Array<{ id: string; nick: string; username: string; creado_at: string; foto: string | null; conectado: boolean }>
  reportados: Array<{
    id: string; nick: string; username: string; reportes: number; de_distintos: number; motivos: string; ultimo: string
    suspendido_hasta: string | null; detalle: Array<{ cuando: string; motivo: string; detalle: string }>
  }>
  suspendidos: Array<{ id: string; nick: string; username: string; hasta: string; motivo: string | null }>
}

/** Los números y las listas del panel. Solo responde si administro. */
export async function leerPanel(): Promise<{ panel?: Panel; error?: string }> {
  const r = await rpc<FilaPanel>('admin_resumen')
  if (!r.data) return { error: r.error === SIN_BASE ? 'Falta el paso 8 de la base de datos.' : r.error }
  const d = r.data
  // "infinity" (suspensión sin fecha de fin) no es una fecha: queda como Infinity.
  const fecha = (t: string) => (t === 'infinity' ? Infinity : Date.parse(t))
  return {
    panel: {
      registrados: Number(d.registrados), nuevosHoy: Number(d.nuevos_hoy), nuevos7: Number(d.nuevos_7_dias),
      activosHoy: Number(d.activos_hoy), activos7: Number(d.activos_7_dias), conectados: Number(d.conectados),
      buscando: Number(d.buscando), amistososHoy: Number(d.amistosos_hoy), amistosos: Number(d.amistosos),
      mensajesChat: Number(d.mensajes_chat),
      ultimos: d.ultimos.map((u) => ({ id: u.id, nick: u.nick, username: u.username, foto: fotoDe(u.id, u.foto), conectado: u.conectado, creadoAt: Date.parse(u.creado_at) })),
      reportados: d.reportados.map((u) => ({
        id: u.id, nick: u.nick, username: u.username, reportes: Number(u.reportes), deDistintos: Number(u.de_distintos),
        motivos: u.motivos, ultimo: Date.parse(u.ultimo), suspendidoHasta: u.suspendido_hasta ? fecha(u.suspendido_hasta) : null,
        detalle: u.detalle.map((x) => ({ cuando: Date.parse(x.cuando), motivo: x.motivo, detalle: x.detalle })),
      })),
      suspendidos: d.suspendidos.map((u) => ({ id: u.id, nick: u.nick, username: u.username, hasta: fecha(u.hasta), motivo: u.motivo })),
    },
  }
}

export async function suspenderDesdePanel(userId: string, dias: number, motivo: string): Promise<{ texto?: string; error?: string }> {
  const r = await rpc<string>('admin_suspender', { p_user: userId, p_dias: dias, p_motivo: motivo })
  return r.error ? { error: r.error } : { texto: r.data ?? 'Listo.' }
}

export async function levantarDesdePanel(userId: string): Promise<{ texto?: string; error?: string }> {
  const r = await rpc<string>('admin_levantar', { p_user: userId })
  return r.error ? { error: r.error } : { texto: r.data ?? 'Listo.' }
}

/** Agregar a un amigo por su usuario de Discord. Devuelve cómo quedó, o el problema. */
/** Agregar a un amigo por su nick o su usuario de Discord (sin el paso 10 en la base, solo Discord). */
export async function pedirAmistadPorUsuario(usuario: string): Promise<{ nick?: string; estado?: 'enviada' | 'amigos'; error?: string }> {
  let r = await rpc<{ nick: string; estado: 'enviada' | 'amigos' }>('pedir_amistad_por_nombre', { p_texto: usuario })
  if (r.error === SIN_BASE) r = await rpc<{ nick: string; estado: 'enviada' | 'amigos' }>('pedir_amistad_por_usuario', { p_username: usuario })
  return r.data ? r.data : { error: r.error ?? 'No pudimos mandar la solicitud. Probá de nuevo.' }
}

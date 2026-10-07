// Estado de la app. Hay dos formas de funcionar y las pantallas no notan la diferencia:
// - Con servidor: la cuenta, la cola, los grupos, las salas y los partidos son
//   reales. La app pide el estado al servidor y cada acción llama a una función suya.
// - Demostración: todo vive en el dispositivo y los demás jugadores están simulados.
// Los puntos, los clips, los amigos y los referidos todavía se guardan en el dispositivo.
import { create } from 'zustand'
import {
  AMISTOSOS_REFERIDO, MINUTOS_DISPONIBLE, MINUTOS_OFERTA, bonusRacha, compatibles, conectoHoy, equipoCompleto,
  matchCuenta, nivelDe, prioridadParaSala, PUNTOS, puntosAmistoso, puntosReaccion, puntosReel, puntosReferido,
  rachaActual, rivalDe, totalPuntos,
} from '../domain/rules'
import type {
  Busqueda, Cancha, Duracion, EventoPuntos, Formato, Match, Mensaje, Modo, MotivoReporte,
  Notif, Participante, Posicion, Reel, Referido, Region, Reporte, TipoNotif, TipoPunto, Usuario,
} from '../domain/types'
import {
  codigoPendiente, completarRegistro, escucharSesion, guardarCodigoPendiente, ingresarConDiscord, miPerfil, quienInvita,
  quitarFoto, salir, subirFoto, type FilaPerfil,
} from './cuenta'
import { sincronizarAvisos, soltarAvisos } from './push'
import { GRACIA_MS, aLocal, cola, leerCola, pedirAmistadPorUsuario, type ColaLocal, type Resumen } from './servidor'
import { REAL } from './supabase'
import { alCambiar } from './transporte'
import {
  BOT, CODIGOS, SEED_AMIGOS, SEED_EVENTOS, SEED_REFERIDOS, SEED_SOLICITUDES, USUARIOS, YO,
  seedBusquedas, seedMatches, seedMisVideos, seedNotifs, seedReels,
} from './seed'

const SEG = 1000
const DIA = 24 * 60 * 60 * SEG
const CLAVE = 'haxmatch-demo-v8'

export interface Perfil {
  /** Id de la cuenta en el servidor. No existe en modo demostración. */
  id?: string
  /** Nick de quien lo invitó con su código. */
  invitoNick?: string | null
  /** Usuario de Discord. */
  username: string
  /** Nombre que eligió para mostrar en la app. */
  nick: string
  /** Foto de perfil elegida de la galería. Sin foto se muestra la inicial. */
  foto?: string | null
  /** Regiones del perfil: puede elegir varias. La posición se elige en cada búsqueda. */
  region: Region[]
  codigo: string
  referidoPor: string | null
  onboarding: boolean
}

type Programado =
  | { at: number; tipo: 'respuesta_bot'; mensajeId: string }
  | { at: number; tipo: 'mensaje_entrante'; busquedaId: string }
  | { at: number; tipo: 'emparejar'; busquedaId: string }
  | { at: number; tipo: 'confirma_bot'; matchId: string; userId: string }
  | { at: number; tipo: 'acepta_solicitud'; userId: string }

export interface Toast {
  id: string
  texto: string
  detalle?: string
  /** Mensaje entrante: muestra Aceptar y Rechazar. */
  mensajeId?: string
  to?: string
  toLabel?: string
}

interface Datos {
  perfil: Perfil | null
  /** Con servidor: de qué cuenta son los datos guardados en este dispositivo. */
  cuentaId: string | null
  /** Con servidor: totales del perfil. */
  resumen: Resumen | null
  offsetDias: number
  usuarios: Record<string, Usuario>
  amigos: string[]
  solicitudes: string[]
  solicitudesEnviadas: string[]
  bloqueados: string[]
  busquedas: Busqueda[]
  matches: Match[]
  mensajes: Mensaje[]
  eventos: EventoPuntos[]
  reels: Reel[]
  misReacciones: string[]
  tiktok: boolean
  notifs: Notif[]
  referidos: Referido[]
  reportes: Reporte[]
  programados: Programado[]
}

export interface NuevaBusqueda {
  modo: Modo
  formato: Formato[] | null
  posicion: Posicion[]
  cancha: Cancha[]
  region: Region[]
  duracion: Duracion
  nombreSala?: string
  faltan?: number
}

interface Acciones {
  ahora: () => number
  tick: () => void
  cerrarToast: (id: string) => void
  limpiarIrA: () => void

  /** Con código de un amigo, primero lo valida. Devuelve el problema, o null si entró. */
  entrarConDiscord: (codigoAmigo?: string) => Promise<string | null>
  completarOnboarding: (d: { nick: string; region: Region[] }) => Promise<string | null>
  /** Con servidor: mira si ya hay una sesión abierta y queda atento a los cambios. */
  iniciarSesion: () => void
  /** Cambia la foto de perfil. null la quita. */
  cambiarFoto: (foto: string | null) => Promise<string | null>
  cerrarSesion: () => void
  reiniciar: () => void
  avanzarDia: () => void

  /** Con servidor: vuelve a pedir el estado de la cola. */
  refrescar: () => Promise<void>
  /** Con servidor: mantiene la cola al día mientras la app está abierta. Devuelve cómo cortar. */
  conectarCola: () => () => void

  crearBusqueda: (d: NuevaBusqueda) => Promise<string | null>
  cancelarBusqueda: () => void
  responderAviso: (avisar: boolean) => void
  /** Cartel de los 15 minutos: 15 minutos más. */
  renovarBusqueda: () => void
  /** El grupo arma su sala: para buscar rival, para seguir buscando gente o para jugar entre ellos. */
  convertirEnSala: (d: { nombreSala: string; faltan: number; entreNosotros?: boolean }) => Promise<string | null>

  enviarMensaje: (aUserId: string) => void
  responderMensaje: (mensajeId: string, aceptar: boolean) => void
  /** Demo: corre ya el emparejamiento automático. */
  emparejarAhora: () => void
  /** Demo: adelanta la búsqueda hasta que se cumplen los 15 minutos. */
  simularQuinceMinutos: () => void

  /** Dueño de la sala: "Ya entró X a la sala". */
  marcarEntro: (userId: string) => void
  /** Dueño de la sala: "Se salió". Libera el lugar. */
  marcarSalio: (userId: string, matchId?: string) => void

  confirmarMatch: (matchId: string) => void
  descartarMatch: (matchId: string) => void

  reaccionar: (reelId: string) => void
  vincularTikTok: () => void
  alternarVisible: (reelId: string) => void
  simularVideoNuevo: () => void

  /** Agregar a un amigo por su usuario de Discord. */
  enviarSolicitud: (username: string) => Promise<{ ok: boolean; texto: string }>
  /** Agregar a un amigo desde su ficha. Devuelve el problema, o null. */
  pedirAmistad: (userId: string) => Promise<string | null>
  responderSolicitud: (userId: string, aceptar: boolean) => void
  /** Dejar de ser amigos, o retirar una solicitud que mandé. */
  quitarAmigo: (userId: string) => void
  /** Abre la ficha de un jugador (para agregarlo como amigo o reportarlo). */
  abrirFicha: (userId: string) => void
  cerrarFicha: () => void

  reportar: (d: { reportado: string; motivo: MotivoReporte; detalle: string }) => Promise<string | null>
  alternarBloqueo: (userId: string) => void

  marcarLeidas: () => void
  simularAmistosoReferido: (userId: string) => void
}

interface Efimero {
  /** Con servidor: todavía no se sabe si hay una sesión abierta. */
  cargandoSesion: boolean
  /** Ya llegó el primer estado de la cola (en demostración, siempre). */
  colaLista: boolean
  /** No se pudo leer la cola: texto del problema. */
  errorCola: string | null
  /** Diferencia entre el reloj del servidor y el del dispositivo. */
  desfaseMs: number
  toasts: Toast[]
  irA: string | null
  /** Jugador cuya ficha está abierta. */
  ficha: string | null
}

export type Store = Datos & Efimero & Acciones

let contador = 0
const id = (p: string) => `${p}_${Date.now().toString(36)}${(contador++).toString(36)}`

function datosIniciales(ahora: number): Datos {
  return {
    perfil: null,
    cuentaId: null,
    resumen: null,
    offsetDias: 0,
    // Los usuarios de muestra quedan solo como autores de los clips de muestra.
    usuarios: USUARIOS,
    // Con servidor no hay jugadores inventados: la cola arranca vacía y la llena el servidor.
    amigos: REAL ? [] : SEED_AMIGOS,
    solicitudes: REAL ? [] : SEED_SOLICITUDES,
    solicitudesEnviadas: [],
    bloqueados: [],
    busquedas: REAL ? [] : seedBusquedas(ahora),
    matches: REAL ? [] : seedMatches(ahora),
    mensajes: [],
    eventos: SEED_EVENTOS,
    reels: seedReels(ahora),
    misReacciones: [],
    tiktok: false,
    notifs: REAL ? [] : seedNotifs(ahora),
    referidos: REAL ? [] : SEED_REFERIDOS,
    reportes: [],
    programados: [],
  }
}

const CAMPOS: Array<keyof Datos> = [
  'perfil', 'cuentaId', 'resumen', 'offsetDias', 'usuarios', 'amigos', 'solicitudes', 'solicitudesEnviadas', 'bloqueados',
  'busquedas', 'matches', 'mensajes', 'eventos', 'reels', 'misReacciones', 'tiktok', 'notifs',
  'referidos', 'reportes', 'programados',
]

function leerGuardado(): Datos | null {
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (!crudo) return null
    const d = JSON.parse(crudo) as Datos
    return d && Array.isArray(d.busquedas) && Array.isArray(d.eventos) ? d : null
  } catch {
    return null
  }
}

function guardar(s: Store) {
  try {
    const d: Record<string, unknown> = {}
    for (const c of CAMPOS) d[c] = s[c]
    localStorage.setItem(CLAVE, JSON.stringify(d))
  } catch {
    // Sin almacenamiento (modo privado, vista previa): la demo sigue en memoria.
  }
}

// ---------- Ayudas que arman cambios de estado ----------

type Cambio = Partial<Datos & Efimero>

function conNotif(s: Store, ahora: number, tipo: TipoNotif, titulo: string, detalle: string, ref?: string): Notif[] {
  return [{ id: id('n'), tipo, titulo, detalle, at: ahora, leida: false, ref }, ...s.notifs]
}

function conToast(s: Store, t: Omit<Toast, 'id'>): Toast[] {
  return [...s.toasts, { id: id('t'), ...t }].slice(-2)
}

/** Agrega un evento de puntos y avisa si subió de nivel. */
function sumar(
  s: Store, ahora: number, tipo: TipoPunto, puntos: number, referencia: string, rival?: string,
): Pick<Datos, 'eventos' | 'notifs'> {
  const antes = nivelDe(totalPuntos(s.eventos, YO))
  const eventos = [...s.eventos, { id: id('e'), userId: YO, tipo, puntos, fecha: ahora, referencia, rival }]
  const despues = nivelDe(totalPuntos(eventos, YO))
  const notifs = despues > antes
    ? conNotif(s, ahora, 'nivel', `Subiste a Nivel ${despues}`, 'Seguí activo para llegar al próximo')
    : s.notifs
  return { eventos, notifs }
}

function miBusqueda(s: Datos): Busqueda | undefined {
  return s.busquedas.find((b) => b.userId === YO && b.estado === 'activa')
}

/** Los que ocupan un lugar en una sala, sin contar al dueño ni a los que ya se fueron. */
export function enSala(m: Match | undefined, dueno: string = YO): Participante[] {
  return (m?.participantes ?? []).filter((p) => p.userId !== dueno && !p.salioAt)
}

/** Cuántos jugadores van juntos en una búsqueda. */
export function cuantosSon(b: Busqueda | undefined): number {
  return 1 + (b?.grupo?.length ?? 0)
}

function enumerar(s: Store, ids: string[]): string {
  const n = ids.map((u) => s.usuarios[u]?.username ?? 'Jugador')
  return n.length <= 1 ? n[0] ?? '' : `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`
}

/** Programa (o reprograma) la próxima pasada del emparejamiento automático. */
function conEmparejar(programados: Programado[], busquedaId: string, at: number): Programado[] {
  return [...programados.filter((p) => !(p.tipo === 'emparejar' && p.busquedaId === busquedaId)), { at, tipo: 'emparejar', busquedaId }]
}

/** Devuelve a la cola a los jugadores que estaban sumados a una búsqueda que terminó sin match. */
function soltarGrupo(busquedas: Busqueda[], mia: Busqueda, estado: 'cancelada' | 'vencida'): Busqueda[] {
  const grupo = mia.grupo ?? []
  // Si un sumado ya venía con su propio grupo, esos siguen con él.
  const deOtros = new Set(busquedas.filter((b) => grupo.includes(b.userId)).flatMap((b) => b.grupo ?? []))
  return busquedas.map((b) => {
    if (b.id === mia.id) return { ...b, estado }
    if (b.estado === 'agrupada' && grupo.includes(b.userId) && !deOtros.has(b.userId)) return { ...b, estado: 'activa' as const }
    return b
  })
}

/**
 * Dos jugadores que buscan partido se juntan: no hay match todavía, siguen
 * buscando juntos con un solo reloj (el de quien mandó el mensaje).
 * Si el otro ya venía en grupo, se suma el grupo entero.
 */
function agrupar(s: Store, ahora: number, otroId: string, invito: 'yo' | 'otro'): Cambio {
  const suya = s.busquedas.find((b) => b.userId === otroId && b.estado === 'activa')
  const nombre = s.usuarios[otroId]?.username ?? 'El jugador'
  if (!suya) return { toasts: conToast(s, { texto: `${nombre} ya no está buscando` }) }
  const mia = miBusqueda(s)
  const nuevos = [otroId, ...(suya.grupo ?? [])]
  let busquedas = s.busquedas.map((b) => (b.id === suya.id ? { ...b, estado: 'agrupada' as const } : b))
  if (mia) {
    const grupo = [...(mia.grupo ?? []), ...nuevos]
    busquedas = busquedas.map((b) => (b.id !== mia.id ? b : {
      ...b,
      grupo,
      // Quien arma el grupo crea la sala cuando ya son un equipo completo.
      equipoListo: invito === 'yo' && equipoCompleto(b.formato, 1 + grupo.length),
      // Si me sumo a la búsqueda de otro, paso a usar su reloj.
      ...(invito === 'otro' ? { creadaAt: suya.creadaAt, expiraAt: suya.expiraAt, ofertaHasta: null } : {}),
    }))
  } else {
    // No estaba buscando: entro directo a la búsqueda del otro.
    busquedas = [{
      ...suya, id: id('b'), userId: YO, estado: 'activa', grupo: nuevos, avisar: null,
      posicion: ['Polifuncional'],
    }, ...busquedas]
  }
  const quienes = enumerar(s, nuevos)
  const texto = invito === 'yo'
    ? `${quienes} ${nuevos.length > 1 ? 'se sumaron' : 'se sumó'} a tu búsqueda`
    : `Te sumaste a la búsqueda de ${nombre}`
  return {
    busquedas,
    notifs: conNotif(s, ahora, 'respuesta', texto, 'Siguen buscando juntos'),
    toasts: conToast(s, { texto, detalle: 'Siguen buscando juntos, con el mismo reloj.' }),
    irA: mia ? null : '/buscando',
  }
}

/**
 * Entro (solo o con mi grupo) a la sala de otro. La sala sigue buscando
 * si todavía le quedan lugares.
 */
function crearMatch(
  s: Store, ahora: number,
  d: { sala: Busqueda; otros: string[]; cancha: Cancha; auto?: boolean },
): Cambio {
  const matchId = id('m')
  const creador = d.sala.userId
  const match: Match = {
    id: matchId,
    creadoPor: creador,
    formato: null,
    cancha: d.cancha,
    nombreSala: d.sala.nombreSala ?? '',
    createdAt: ahora,
    participantes: [
      { userId: creador, equipo: 'A', confirmadoAt: null },
      ...d.otros.map((userId) => ({ userId, equipo: 'B' as const, confirmadoAt: null })),
    ],
    contadoAt: null,
  }
  const quedan = Math.max(0, (d.sala.faltan ?? d.otros.length) - d.otros.length)
  const nombre = s.usuarios[creador]?.username ?? 'la sala'
  return {
    matches: [match, ...s.matches],
    busquedas: s.busquedas.map((b) => {
      if (b.id === d.sala.id) return { ...b, faltan: quedan, estado: quedan === 0 ? 'match' as const : b.estado }
      // El match cierra la búsqueda de todos los que entran.
      if ((b.estado === 'activa' || b.estado === 'agrupada') && d.otros.includes(b.userId)) return { ...b, estado: 'match' as const }
      return b
    }),
    notifs: conNotif(s, ahora, 'match', `Match listo con ${nombre}`, 'Entrá a la sala y confirmá', matchId),
    toasts: d.auto ? conToast(s, { texto: `La app te conectó con la sala de ${nombre}` }) : s.toasts,
    irA: `/match/${matchId}`,
  }
}

/**
 * Jugadores que ocupan un lugar de mi sala. Todos los que entran a una misma
 * sala quedan en un solo partido, y la sala sigue buscando si le faltan más.
 */
function ocupar(s: Store, ahora: number, ids: string[], equipo: 'A' | 'B' = 'B'): Cambio {
  const mia = miBusqueda(s)
  if (!mia || mia.modo !== 'sala') return {}
  const existente = s.matches.find((m) => m.id === mia.matchId)
  const matchId = existente?.id ?? id('m')
  const nuevos = ids.map((userId) => ({ userId, equipo, confirmadoAt: null, entroAt: null }))
  const matches = existente
    ? s.matches.map((m) => (m.id === matchId ? { ...m, participantes: [...m.participantes, ...nuevos] } : m))
    : [{
        id: matchId, creadoPor: YO, formato: null, cancha: elegir<Cancha>(mia.cancha, undefined),
        nombreSala: mia.nombreSala ?? '', createdAt: ahora, contadoAt: null,
        participantes: [{ userId: YO, equipo: 'A' as const, confirmadoAt: null }, ...nuevos],
      }, ...s.matches]
  const faltan = equipo === 'B' ? Math.max(0, (mia.faltan ?? 0) - ids.length) : mia.faltan
  return {
    matches,
    busquedas: s.busquedas.map((b) => {
      // Al llenarse la sala se frena el reloj: ya no se busca a nadie.
      if (b.id === mia.id) return { ...b, faltan, matchId, completaAt: faltan === 0 ? b.completaAt ?? ahora : null }
      if ((b.estado === 'activa' || b.estado === 'agrupada') && ids.includes(b.userId)) return { ...b, estado: 'match' as const }
      return b
    }),
    notifs: conNotif(s, ahora, 'respuesta', `${enumerar(s, ids)} ${ids.length > 1 ? 'van' : 'va'} a entrar a tu sala`, faltan ? `Te faltan ${faltan}` : 'Sala completa'),
  }
}

/** Si el partido ya cumple la regla de confirmación, lo cuenta y suma los puntos. */
function evaluarMatch(s: Store, ahora: number, matches: Match[], matchId: string): Cambio {
  const m = matches.find((x) => x.id === matchId)
  if (!m || m.contadoAt !== null || !matchCuenta(m)) return { matches }
  const contados = matches.map((x) => (x.id === matchId ? { ...x, contadoAt: ahora } : x))
  if (!m.participantes.some((p) => p.userId === YO)) return { matches: contados }
  const rival = rivalDe(m, YO)
  const puntos = puntosAmistoso(s.eventos, YO, rival, ahora)
  return {
    matches: contados,
    ...sumar(s, ahora, 'amistoso', puntos, matchId, rival),
    toasts: conToast(s, puntos > 0
      ? { texto: `Amistoso confirmado · +${puntos} puntos` }
      : { texto: 'Amistoso confirmado', detalle: 'Hoy ya llegaste al tope de puntos por amistosos.' }),
  }
}

function textoInvitacion(b: Busqueda | undefined): string {
  if (b?.modo === 'sala') return '¿Te sumás a mi sala?'
  const concretos = (b?.formato ?? []).filter((f) => f !== 'Cualquiera')
  return concretos.length === 1 ? `¿Jugamos un ${concretos[0]}?` : '¿Jugamos?'
}

/**
 * Con qué opción se arma el match: la primera que les sirve a los dos.
 * "Cualquiera" acepta lo que haya elegido el otro.
 */
function elegir<T extends string>(a: readonly T[] | null | undefined, b: readonly T[] | null | undefined): T | 'Cualquiera' {
  const concretas = (x: readonly T[] | null | undefined) => (x ?? []).filter((v) => v !== 'Cualquiera')
  const ca = concretas(a)
  const cb = concretas(b)
  if (ca.length && cb.length) return ca.find((v) => cb.includes(v)) ?? ca[0]
  return ca[0] ?? cb[0] ?? 'Cualquiera'
}

/**
 * Emparejamiento automático. La app conecta sola, sin mensajes:
 * - Si busco partido: me mete en una sala donde entro (solo o con mi grupo).
 *   Prefiere la sala a la que le faltan justo los que somos.
 * - Si tengo sala: me acerca gente para que la acepte. Primero un grupo del
 *   tamaño justo, después jugadores sueltos, después grupos más chicos.
 * Devuelve null si no encontró nada.
 */
function emparejar(s: Store, ahora: number): Cambio | null {
  const mia = miBusqueda(s)
  if (!mia) return null
  const libres = s.busquedas.filter((b) =>
    b.estado === 'activa' && b.userId !== YO && !s.bloqueados.includes(b.userId) && compatibles(mia, b))
  const amigo = (b: Busqueda) => Number(s.amigos.includes(b.userId))

  if (mia.modo === 'jugador') {
    if (mia.equipoListo || mia.ofertaHasta) return null
    const somos = cuantosSon(mia)
    const sala = libres
      .filter((b) => b.modo === 'sala' && (b.faltan ?? 0) >= somos)
      .sort((a, b) => Number(b.faltan === somos) - Number(a.faltan === somos) || amigo(b) - amigo(a))[0]
    if (!sala) return null
    return crearMatch(s, ahora, { sala, otros: [YO, ...(mia.grupo ?? [])], cancha: elegir<Cancha>(sala.cancha, mia.cancha), auto: true })
  }

  const faltan = mia.faltan ?? 0
  if (faltan <= 0 || s.mensajes.some((m) => m.a === YO && m.estado === 'pendiente')) return null
  const candidato = libres
    .filter((b) => b.modo === 'jugador' && !mia.rechazados?.includes(b.userId) && prioridadParaSala(cuantosSon(b), faltan) >= 0)
    .sort((a, b) => prioridadParaSala(cuantosSon(a), faltan) - prioridadParaSala(cuantosSon(b), faltan) || amigo(b) - amigo(a))[0]
  if (!candidato) return null
  const con = candidato.grupo ?? []
  const nombres = enumerar(s, [candidato.userId, ...con])
  const texto = con.length ? `Grupo de ${con.length + 1} para tu sala` : 'Jugador para tu sala'
  const msg: Mensaje = { id: id('msg'), de: candidato.userId, a: YO, texto, at: ahora, estado: 'pendiente', auto: true, con }
  return {
    mensajes: [msg, ...s.mensajes],
    notifs: conNotif(s, ahora, 'mensaje', `${nombres} ${con.length ? 'quieren' : 'quiere'} entrar a tu sala`, texto, msg.id),
    toasts: conToast(s, { texto: `${nombres} ${con.length ? 'quieren' : 'quiere'} entrar a tu sala`, detalle: texto, mensajeId: msg.id }),
  }
}

// ---------- Cola real: del estado del servidor a los avisos de la app ----------

/** Momento en que cancelé o cerré mi búsqueda, para no avisar que "venció". */
let canceleAt = 0
/** Momento en que acepté un pedido, para no avisarme lo que acabo de hacer. */
let acepteAt = 0
/** Todavía no se aplicó ningún estado desde que se abrió la sesión. */
let primeraCola = true
// Un estado pedido antes de terminar una acción puede venir viejo: se descarta y se vuelve a pedir.
let epoca = 0
let enCurso = 0
let enVuelo: Promise<void> | null = null
let otraVez = false

const RECIEN = 15 * SEG

/**
 * Compara el estado que llega del servidor con el que había y arma los avisos:
 * mensajes nuevos, gente que se suma, matches, búsquedas que terminan y puntos.
 */
function aplicarCola(s: Store, n: ColaLocal, primera: boolean): Cambio {
  const ahora = Date.now() + n.desfaseMs
  const usuarios = { ...s.usuarios, ...n.usuarios }
  let st: Store = { ...s, usuarios }
  let irA: string | null = null
  const nombre = (u: string) => usuarios[u]?.username ?? 'Jugador'
  const nombres = (ids: string[]) => enumerar(st, ids)
  const notif = (tipo: TipoNotif, titulo: string, detalle: string, ref?: string) => {
    st = { ...st, notifs: conNotif(st, ahora, tipo, titulo, detalle, ref) }
  }
  const toast = (t: Omit<Toast, 'id'>) => {
    st = { ...st, toasts: conToast(st, t) }
  }

  const antes = miBusqueda(s)
  const mia = n.busquedas.find((b) => b.userId === YO && b.estado === 'activa')
  const cancele = Date.now() - canceleAt < RECIEN
  const soyParte = (m: Match) => m.participantes.some((p) => p.userId === YO)
  /** Partido nuevo en la sala de otro: me aceptaron o la app me conectó. */
  const entreAUno = primera ? undefined : n.matches.find((m) => m.creadoPor !== YO && soyParte(m) && !s.matches.some((x) => x.id === m.id))

  // Pedidos y mensajes que me llegaron y todavía no respondí.
  const pendientes = n.mensajes.filter((m) => m.a === YO && m.estado === 'pendiente')
  st = { ...st, toasts: st.toasts.filter((t) => !t.mensajeId || pendientes.some((m) => m.id === t.mensajeId)) }
  for (const m of pendientes) {
    if (s.mensajes.some((x) => x.id === m.id)) continue
    const quienes = [m.de, ...(m.con ?? [])]
    const varios = quienes.length > 1
    const titulo = mia?.modo === 'sala'
      ? `${nombres(quienes)} ${varios ? 'quieren' : 'quiere'} entrar a tu sala`
      : `${nombre(m.de)} te escribió`
    const detalle = m.auto ? `La app ${varios ? 'los' : 'lo'} conectó con tu sala` : m.texto
    if (!st.notifs.some((x) => x.ref === m.id)) notif('mensaje', titulo, detalle, m.id)
    toast({ texto: titulo, detalle, mensajeId: m.id })
  }

  if (!primera) {
    // Respuestas a lo que mandé yo. Si acepta, se nota por lo que pasa después (grupo, sala o match).
    for (const m of n.mensajes) {
      if (m.de !== YO || m.estado !== 'rechazado') continue
      const previo = s.mensajes.find((x) => x.id === m.id) ?? s.mensajes.find((x) => x.de === YO && x.a === m.a && x.estado === 'pendiente')
      if (previo?.estado !== 'pendiente') continue
      // Si la que terminó fue mi búsqueda, mis mensajes se caen solos: no es un "no".
      const armeSala = antes?.modo === 'jugador' && mia?.modo === 'sala'
      if (cancele || entreAUno || armeSala || (antes && !mia) || (mia?.liderId && !antes?.liderId)) continue
      const sigue = n.busquedas.some((b) => b.userId === m.a && b.estado === 'activa')
      const titulo = sigue ? `${nombre(m.a)} no puede ahora` : `${nombre(m.a)} ya no está buscando`
      notif('respuesta', titulo, sigue ? 'Rechazó tu mensaje' : 'Tu mensaje quedó sin respuesta')
      toast({ texto: titulo, detalle: 'Probá con otro jugador de la cola.' })
    }

    // Mi grupo: quién se sumó y quién se fue.
    if (mia && antes && mia.modo === 'jugador' && antes.modo === 'jugador' && (antes.liderId ?? null) === (mia.liderId ?? null)) {
      const g0 = antes.grupo ?? []
      const g1 = mia.grupo ?? []
      const sumados = g1.filter((u) => !g0.includes(u))
      const idos = g0.filter((u) => !g1.includes(u))
      if (sumados.length) {
        const titulo = `${nombres(sumados)} ${sumados.length > 1 ? 'se sumaron' : 'se sumó'} ${mia.liderId ? 'al grupo' : 'a tu búsqueda'}`
        notif('respuesta', titulo, 'Siguen buscando juntos')
        toast({ texto: titulo, detalle: 'Siguen buscando juntos, con el mismo reloj.' })
      }
      if (idos.length) toast({ texto: `${nombres(idos)} ${idos.length > 1 ? 'salieron' : 'salió'} del grupo` })
    }
    if (mia?.liderId && antes?.liderId !== mia.liderId) {
      const titulo = `Te sumaste a la búsqueda de ${nombre(mia.liderId)}`
      notif('respuesta', titulo, 'Siguen buscando juntos')
      toast({ texto: titulo, detalle: 'Siguen buscando juntos, con el mismo reloj.' })
      irA = '/buscando'
    }
    if (mia && !mia.liderId && antes?.liderId) {
      toast({ texto: `${nombre(antes.liderId)} dejó de buscar`, detalle: 'Seguís buscando por tu cuenta, con el reloj en cero.' })
    }

    // Entré a la sala de otro.
    if (entreAUno) {
      notif('match', `Match listo con ${nombre(entreAUno.creadoPor)}`, 'Entrá a la sala y confirmá', entreAUno.id)
      irA = `/match/${entreAUno.id}`
    }

    // Mi sala: quién ocupó un lugar.
    for (const m of n.matches) {
      if (m.creadoPor !== YO || antes?.modo !== 'sala') continue
      const estaban = enSala(s.matches.find((x) => x.id === m.id))
      const entran = enSala(m).filter((p) => !estaban.some((q) => q.userId === p.userId)).map((p) => p.userId)
      if (!entran.length) continue
      const titulo = `${nombres(entran)} ${entran.length > 1 ? 'van' : 'va'} a entrar a tu sala`
      const detalle = mia?.faltan ? `Te ${mia.faltan === 1 ? 'falta' : 'faltan'} ${mia.faltan}` : 'Sala completa'
      notif('respuesta', titulo, detalle)
      // Si lo acabo de aceptar yo, no hace falta avisarme.
      if (Date.now() - acepteAt > RECIEN) toast({ texto: titulo, detalle, to: '/buscando' })
    }

    // El dueño liberó mi lugar. Si el partido ya me contaba, me queda; si no, desaparece.
    const miLugar = (m: Match | undefined) => m?.participantes.find((p) => p.userId === YO)
    for (const m of s.matches) {
      const tenia = miLugar(m)
      if (m.creadoPor === YO || !tenia || tenia.salioAt || ahora - m.createdAt > DIA) continue
      const ahoraTengo = miLugar(n.matches.find((x) => x.id === m.id))
      if (ahoraTengo && !ahoraTengo.salioAt) continue
      toast({
        texto: `Ya no estás en la sala de ${nombre(m.creadoPor)}`,
        detalle: ahoraTengo ? 'Liberaron tu lugar. El partido te queda anotado.' : 'Liberaron tu lugar o la sala se cerró.',
      })
    }

    // Mi búsqueda terminó.
    if (antes && !mia && !entreAUno && !cancele) {
      const suMatch = antes.matchId ? n.matches.find((m) => m.id === antes.matchId) : undefined
      const todosAdentro = !!suMatch && enSala(suMatch).every((p) => !!p.entroAt)
      if (antes.modo === 'sala' && suMatch && todosAdentro && (antes.faltan ?? 0) === 0) {
        // Sala completa y todos adentro: queda armado el match.
        notif('match', 'Match listo: tu sala está completa', 'Ya entraron todos', suMatch.id)
        irA = `/match/${suMatch.id}`
      } else if (antes.modo === 'sala') {
        toast({ texto: 'Tu sala dejó de buscar', detalle: 'La app estuvo mucho tiempo cerrada o sin conexión.' })
      } else {
        const porTiempo = antes.expiraAt !== null && antes.expiraAt <= ahora && !antes.liderId
        toast({ texto: 'Tu búsqueda venció', detalle: porTiempo ? 'Pasaron los 15 minutos y no la renovaste.' : 'La app estuvo mucho tiempo cerrada o sin conexión.' })
      }
    }
  }

  // Amigos: solicitudes nuevas, solicitudes aceptadas y amigos que se ponen a buscar.
  if (!primera) {
    for (const u of n.solicitudes) {
      if (s.solicitudes.includes(u) || s.amigos.includes(u)) continue
      notif('solicitud', `${nombre(u)} quiere ser tu amigo`, 'Respondé desde Amigos', u)
      toast({ texto: `${nombre(u)} quiere ser tu amigo`, to: '/perfil/amigos' })
    }
    for (const u of n.amigos) {
      if (!s.solicitudesEnviadas.includes(u)) continue
      notif('solicitud', `${nombre(u)} aceptó tu solicitud`, 'Ya son amigos', u)
      toast({ texto: `${nombre(u)} aceptó tu solicitud`, detalle: 'Ya son amigos.' })
    }
    for (const b of n.busquedas) {
      if (b.estado !== 'activa' || !n.amigos.includes(b.userId) || s.busquedas.some((x) => x.id === b.id)) continue
      const titulo = b.modo === 'sala'
        ? `Tu amigo ${nombre(b.userId)} necesita ${b.faltan ?? 1} más`
        : `Tu amigo ${nombre(b.userId)} se puso disponible`
      const detalle = b.modo === 'sala' ? `Sala "${b.nombreSala ?? ''}"` : `${(b.formato ?? []).join(', ')} · ${b.cancha.join(', ')}`
      notif(b.modo === 'sala' ? 'amigo_sala' : 'amigo_disponible', titulo, detalle, b.id)
      // Si ya estoy en un partido o en un grupo, no interrumpe: queda en Notificaciones.
      if (!entreAUno && !mia?.liderId) toast({ texto: titulo, detalle, to: '/perfil/amigos' })
    }
  }

  // Partidos que ya cuentan y todavía no sumaron puntos en este dispositivo.
  const porSumar = n.matches
    .filter((m) => m.contadoAt !== null && soyParte(m) && !st.eventos.some((e) => e.tipo === 'amistoso' && e.referencia === m.id))
    .sort((a, b) => (a.contadoAt ?? 0) - (b.contadoAt ?? 0))
  for (const m of porSumar) {
    const cuando = m.contadoAt ?? ahora
    const rival = rivalDe(m, YO)
    const puntos = puntosAmistoso(st.eventos, YO, rival, cuando)
    st = { ...st, ...sumar(st, cuando, 'amistoso', puntos, m.id, rival) }
    if (!primera) {
      toast(puntos > 0
        ? { texto: `Amistoso confirmado · +${puntos} puntos` }
        : { texto: 'Amistoso confirmado', detalle: 'Hoy ya llegaste al tope de puntos por amistosos.' })
    }
  }

  return {
    usuarios,
    busquedas: n.busquedas,
    mensajes: n.mensajes,
    matches: n.matches,
    resumen: n.resumen,
    amigos: n.amigos,
    solicitudes: n.solicitudes,
    solicitudesEnviadas: n.enviadas,
    desfaseMs: n.desfaseMs,
    eventos: st.eventos,
    notifs: st.notifs.slice(0, 50),
    toasts: st.toasts,
    colaLista: true,
    errorCola: null,
    ...(irA ? { irA } : {}),
  }
}

// ---------- Store ----------

const guardado = leerGuardado() ?? datosIniciales(Date.now())
// Con servidor, el perfil no sale del dispositivo (se carga de la sesión) y la
// cola tampoco: se pide de nuevo al abrir la app.
const inicial: Datos = REAL ? { ...guardado, perfil: null, busquedas: [], mensajes: [], programados: [], offsetDias: 0 } : guardado

function aPerfil(f: FilaPerfil): Perfil {
  return {
    id: f.id,
    username: f.username,
    nick: f.nick,
    foto: f.foto_url,
    region: f.region,
    codigo: f.codigo,
    referidoPor: f.referido_por,
    onboarding: f.onboarding,
    // Antes de terminar el registro, quién invitó sale del código que cargó en el ingreso.
    invitoNick: f.invito ?? (f.onboarding ? null : codigoPendiente()?.nick ?? null),
  }
}

/** Usuario de la sesión que ya se cargó, para no recargar el perfil con cada renovación. */
let sesionCargada: string | null = null
let escuchandoSesion = false

export const useStore = create<Store>()((set, get) => {
  /**
   * Hace una acción en el servidor y después vuelve a pedir el estado.
   * Devuelve el problema, o null si salió bien. Salvo que se pida silencio, lo muestra.
   */
  const enServidor = async (accion: () => Promise<string | null>, silencio = false): Promise<string | null> => {
    epoca++
    enCurso++
    let error: string | null = null
    try {
      error = await accion()
    } finally {
      enCurso--
      epoca++
    }
    if (error && !silencio) set({ toasts: conToast(get(), { texto: error }) })
    await get().refrescar()
    return error
  }

  return {
  ...inicial,
  toasts: [],
  irA: null,
  ficha: null,
  cargandoSesion: REAL,
  colaLista: !REAL,
  errorCola: null,
  desfaseMs: 0,

  ahora: () => Date.now() + get().offsetDias * DIA + get().desfaseMs,

  refrescar: () => {
    const cuenta = get().perfil
    const miId = cuenta?.id
    if (!REAL || !miId || !cuenta?.onboarding) return Promise.resolve()
    // Si ya hay un pedido en camino, se espera ese y se repite al terminar.
    if (enVuelo) {
      otraVez = true
      return enVuelo
    }
    const pedir = async () => {
      let intentos = 0
      do {
        otraVez = false
        const e = epoca
        const r = await leerCola()
        if (get().perfil?.id !== miId) return
        if (!r.estado) {
          set({ errorCola: r.error ?? 'No pudimos conectar con el servidor.' })
          return
        }
        // Mientras hay una acción en curso, este estado puede ser viejo: al terminar se vuelve a pedir.
        if (enCurso > 0) return
        if (e !== epoca) {
          otraVez = true
          continue
        }
        set(aplicarCola(get(), aLocal(r.estado, miId), primeraCola))
        primeraCola = false
        guardar(get())
      } while (otraVez && ++intentos < 5)
    }
    enVuelo = pedir().finally(() => { enVuelo = null })
    return enVuelo
  },

  conectarCola: () => {
    if (!REAL) return () => {}
    let espera: ReturnType<typeof setTimeout> | null = null
    // Varios cambios seguidos se atienden con un solo pedido.
    const pronto = () => {
      if (espera) return
      espera = setTimeout(() => {
        espera = null
        void get().refrescar()
      }, 150)
    }
    const dejarDeEscuchar = alCambiar(pronto)
    // Aunque no llegue ningún aviso, se pregunta cada tanto. También sirve de
    // señal de vida: el servidor saca de la cola a quien deja de aparecer.
    const cada = setInterval(() => void get().refrescar(), 8 * SEG)
    // Al volver a la app se pide el estado. Al dejarla también: así el servidor
    // sabe que desde ese momento lo que pase tiene que llegar como notificación.
    const alVolver = () => void get().refrescar()
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('online', alVolver)
    void get().refrescar()
    // Si este celular ya tenía los avisos activos, quedan a nombre de esta cuenta.
    void sincronizarAvisos()
    return () => {
      dejarDeEscuchar()
      clearInterval(cada)
      if (espera) clearTimeout(espera)
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('online', alVolver)
    }
  },

  tick: () => {
    const s = get()
    const ahora = s.ahora()
    let cambio: Cambio = {}
    const aplicar = (c: Cambio) => {
      cambio = { ...cambio, ...c }
      set(c)
    }

    // 1. Se cumple el tiempo de la búsqueda: primero se ofrece renovar, y si nadie responde, vence.
    const mia = miBusqueda(s)
    if (REAL) {
      // Con servidor, el que vence la búsqueda es el servidor. Acá solo se muestra el cartel a tiempo.
      if (mia && mia.modo === 'jugador' && !mia.liderId && mia.expiraAt !== null && mia.expiraAt <= ahora && !mia.ofertaHasta) {
        const hasta = mia.expiraAt + GRACIA_MS
        aplicar({ busquedas: s.busquedas.map((b) => (b.id === mia.id ? { ...b, ofertaHasta: hasta } : b)) })
      }
    } else if (mia && mia.expiraAt !== null && mia.expiraAt <= ahora) {
      if (!mia.ofertaHasta) {
        aplicar({ busquedas: s.busquedas.map((b) => (b.id === mia.id ? { ...b, ofertaHasta: ahora + MINUTOS_OFERTA * 60 * SEG } : b)) })
      } else if (mia.ofertaHasta <= ahora) {
        aplicar({
          busquedas: soltarGrupo(s.busquedas, mia, 'vencida'),
          toasts: conToast(s, { texto: 'Tu búsqueda venció', detalle: 'Pasaron los 15 minutos y no la renovaste.' }),
        })
      }
    }

    // 2. Conexión del día y racha.
    if (s.perfil?.onboarding && !conectoHoy(s.eventos, YO, ahora)) {
      let st = get()
      aplicar(sumar(st, ahora, 'conexion', PUNTOS.conexion, `dia-${ahora}`))
      st = get()
      const racha = rachaActual(st.eventos, YO, ahora)
      const extra = bonusRacha(racha)
      if (extra > 0) {
        aplicar(sumar(st, ahora, 'racha', extra, `racha-${racha}`))
        aplicar({ toasts: conToast(get(), { texto: `Racha de ${racha} días · +${extra} puntos` }) })
      }
    }

    // 3. Jugadores simulados y emparejamiento automático.
    const vencidos = get().programados.filter((p) => p.at <= ahora)
    if (vencidos.length === 0) {
      if (Object.keys(cambio).length) guardar(get())
      return
    }
    set({ programados: get().programados.filter((p) => p.at > ahora) })
    for (const p of vencidos) {
      const st = get()
      if (p.tipo === 'emparejar') {
        const mia2 = miBusqueda(st)
        if (!mia2 || mia2.id !== p.busquedaId) continue
        const c = emparejar(st, ahora)
        if (c) set(c)
        const sigue = miBusqueda(get())
        // Mientras siga buscando (o a la sala le falten lugares), vuelve a probar.
        if (sigue && sigue.id === p.busquedaId && (sigue.modo === 'jugador' || (sigue.faltan ?? 0) > 0)) {
          set({ programados: conEmparejar(get().programados, sigue.id, ahora + (sigue.modo === 'sala' ? 12 : 20) * SEG) })
        }
      } else if (p.tipo === 'respuesta_bot') {
        const msg = st.mensajes.find((m) => m.id === p.mensajeId)
        if (!msg || msg.estado !== 'pendiente') continue
        const bot = st.usuarios[msg.a]
        const acepta = !BOT.rechaza.includes(msg.a)
        const mensajes = st.mensajes.map((m) => (m.id === msg.id ? { ...m, estado: acepta ? 'aceptado' as const : 'rechazado' as const } : m))
        if (!acepta) {
          set({
            mensajes,
            notifs: conNotif(st, ahora, 'respuesta', `${bot.username} no puede ahora`, 'Rechazó tu mensaje'),
            toasts: conToast(st, { texto: `${bot.username} no puede ahora`, detalle: 'Probá con otro jugador de la cola.' }),
          })
          continue
        }
        const mia2 = miBusqueda(st)
        const suya = st.busquedas.find((b) => b.userId === msg.a && b.estado === 'activa')
        set({ mensajes })
        if (!suya) {
          set({ toasts: conToast(get(), { texto: `${bot.username} ya no está buscando` }) })
        } else if (suya.modo === 'sala') {
          // Una sala me aceptó: se genera el match, aunque no sea lo que yo buscaba.
          set(crearMatch(get(), ahora, { sala: suya, otros: [YO, ...(mia2?.grupo ?? [])], cancha: elegir<Cancha>(suya.cancha, mia2?.cancha) }))
        } else if (mia2?.modo === 'sala') {
          // Un jugador (o su grupo) aceptó entrar a mi sala: ocupa su lugar sin pasar por el cartel de aceptar.
          const ids = [msg.a, ...(suya.grupo ?? [])]
          if (ids.length > (mia2.faltan ?? 0)) set({ toasts: conToast(get(), { texto: 'Ya no entran en tu sala', detalle: `Son ${ids.length} y te faltan ${mia2.faltan ?? 0}.` }) })
          else set(ocupar(get(), ahora, ids))
        } else {
          // Dos jugadores buscando: se suma a mi búsqueda y a mi reloj.
          set(agrupar(get(), ahora, msg.a, 'yo'))
        }
      } else if (p.tipo === 'mensaje_entrante') {
        const mia2 = miBusqueda(st)
        if (!mia2 || mia2.id !== p.busquedaId || mia2.modo !== 'jugador') continue
        const de = 'u_mati'
        const suya = st.busquedas.find((b) => b.userId === de && b.estado === 'activa')
        const yaHablaron = st.mensajes.some((m) => (m.de === de || m.a === de) && m.estado === 'pendiente')
        if (!suya || yaHablaron || st.bloqueados.includes(de)) continue
        const texto = textoInvitacion(suya)
        const msg: Mensaje = { id: id('msg'), de, a: YO, texto, at: ahora, estado: 'pendiente' }
        const nombre = st.usuarios[de].username
        set({
          mensajes: [msg, ...st.mensajes],
          notifs: conNotif(st, ahora, 'mensaje', `${nombre} te escribió`, texto, msg.id),
          toasts: conToast(st, { texto: `${nombre} te escribió`, detalle: texto, mensajeId: msg.id }),
        })
      } else if (p.tipo === 'confirma_bot') {
        const matches = st.matches.map((m) => (m.id !== p.matchId ? m : {
          ...m,
          participantes: m.participantes.map((x) => (x.userId === p.userId && x.confirmadoAt === null ? { ...x, confirmadoAt: ahora } : x)),
        }))
        set(evaluarMatch(st, ahora, matches, p.matchId))
      } else if (p.tipo === 'acepta_solicitud') {
        if (!st.solicitudesEnviadas.includes(p.userId)) continue
        const nombre = st.usuarios[p.userId].username
        set({
          solicitudesEnviadas: st.solicitudesEnviadas.filter((u) => u !== p.userId),
          amigos: [...st.amigos, p.userId],
          notifs: conNotif(st, ahora, 'solicitud', `${nombre} aceptó tu solicitud`, 'Ya son amigos', p.userId),
          toasts: conToast(st, { texto: `${nombre} aceptó tu solicitud` }),
        })
      }
    }
    guardar(get())
  },

  cerrarToast: (toastId) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== toastId) })),
  limpiarIrA: () => set({ irA: null }),

  // ----- Sesión -----

  iniciarSesion: () => {
    if (!REAL || escuchandoSesion) return
    escuchandoSesion = true
    escucharSesion((uid) => {
      if (uid === sesionCargada && (uid === null ? !get().cargandoSesion : true)) return
      sesionCargada = uid
      primeraCola = true
      if (!uid) {
        set({ perfil: null, cargandoSesion: false, busquedas: [], mensajes: [], colaLista: false, errorCola: null })
        return
      }
      // Se difiere: dentro de este aviso no se puede volver a llamar a Supabase.
      setTimeout(async () => {
        const r = await miPerfil()
        if (sesionCargada !== uid) return
        if (!r.perfil) {
          sesionCargada = null
          set({ perfil: null, cargandoSesion: false, toasts: conToast(get(), { texto: 'No pudimos cargar tu perfil', detalle: r.error }) })
          return
        }
        // Si en este dispositivo había datos de otra cuenta, se empieza de cero.
        const deOtra = get().cuentaId !== r.perfil.id
        set({
          ...(deOtra ? datosIniciales(Date.now()) : {}),
          perfil: aPerfil(r.perfil), cuentaId: r.perfil.id, cargandoSesion: false,
        })
        get().tick()
        guardar(get())
      }, 0)
    })
  },

  entrarConDiscord: async (codigoAmigo) => {
    if (REAL) {
      // El código de un amigo se valida antes de ir a Discord y se aplica al terminar el registro.
      if (codigoAmigo !== undefined) {
        const c = codigoAmigo.trim().toUpperCase()
        if (!c) return 'Escribí el código de tu amigo.'
        const r = await quienInvita(c)
        if (r.error) return r.error
        if (!r.nick) return 'No encontramos ese código. Revisalo e intentá de nuevo.'
        guardarCodigoPendiente({ codigo: c, nick: r.nick })
      } else {
        guardarCodigoPendiente(null)
      }
      return ingresarConDiscord()
    }
    // Modo demostración: el código se valida contra los usuarios de prueba.
    let referidoPor: string | null = null
    if (codigoAmigo !== undefined) {
      const c = codigoAmigo.trim().toUpperCase()
      if (!c) return 'Escribí el código de tu amigo.'
      referidoPor = CODIGOS[c] ?? null
      if (!referidoPor) return 'No encontramos ese código. Revisalo e intentá de nuevo.'
    }
    const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const codigo = 'HX' + Array.from({ length: 4 }, () => letras[Math.floor(Math.random() * letras.length)]).join('')
    set({ perfil: { username: 'Jugador_Demo', nick: 'Jugador_Demo', region: ['ARG'], codigo, referidoPor, onboarding: false } })
    guardar(get())
    return null
  },

  completarOnboarding: async ({ nick, region }) => {
    const s = get()
    if (!s.perfil) return 'Primero entrá con Discord.'
    // Sin nick, se usa el usuario de Discord.
    const elegido = nick.trim() || s.perfil.username.slice(0, 20)
    if (elegido.length < 2 || elegido.length > 20) return 'El nick tiene que tener entre 2 y 20 caracteres.'
    if (REAL) {
      const r = await completarRegistro(elegido, region, codigoPendiente()?.codigo)
      if (!r.perfil) return r.error ?? 'No pudimos guardar tu registro. Intentá de nuevo.'
      guardarCodigoPendiente(null)
      set({ perfil: aPerfil(r.perfil) })
    } else {
      set({ perfil: { ...s.perfil, nick: elegido, region, onboarding: true } })
    }
    get().tick()
    guardar(get())
    return null
  },

  cambiarFoto: async (foto) => {
    const s = get()
    if (!s.perfil) return 'Primero entrá con Discord.'
    let guardada = foto
    if (REAL) {
      if (!s.perfil.id) return 'Primero entrá con Discord.'
      if (foto) {
        const r = await subirFoto(s.perfil.id, foto)
        if (!r.url) return r.error ?? 'No pudimos subir la foto. Intentá de nuevo.'
        guardada = r.url
      } else {
        const error = await quitarFoto(s.perfil.id)
        if (error) return error
      }
    }
    const actual = get().perfil
    if (actual) set({ perfil: { ...actual, foto: guardada } })
    guardar(get())
    return null
  },

  cerrarSesion: () => {
    if (REAL) {
      const buscaba = !!miBusqueda(get())
      canceleAt = Date.now()
      set({ perfil: null, toasts: [], busquedas: [], mensajes: [], colaLista: false, ficha: null })
      guardar(get())
      // La búsqueda se cancela antes de salir: después ya no hay sesión para pedirlo.
      void (async () => {
        if (buscaba) await cola.cancelar()
        await soltarAvisos()
        await salir()
      })()
      return
    }
    get().cancelarBusqueda()
    set({ perfil: null, toasts: [] })
    guardar(get())
  },

  reiniciar: () => {
    // Con servidor solo se reinician los datos de prueba: la cuenta sigue abierta.
    set({ ...datosIniciales(Date.now()), perfil: REAL ? get().perfil : null, toasts: [], irA: null })
    guardar(get())
  },

  avanzarDia: () => {
    // Con servidor el reloj es el del servidor: no se puede adelantar.
    if (REAL) return
    set((s) => ({ offsetDias: s.offsetDias + 1 }))
    get().tick()
    guardar(get())
  },

  // ----- Disponibilidad -----

  crearBusqueda: async (d) => {
    const s = get()
    const ahora = s.ahora()
    if (miBusqueda(s)) return 'Ya tenés una búsqueda activa. Cancelala para empezar otra.'
    if (d.modo === 'sala' && !d.nombreSala?.trim()) return 'Escribí el nombre de la sala.'
    if (REAL) {
      canceleAt = 0
      return enServidor(() => cola.crearBusqueda({ ...d, nombreSala: d.nombreSala?.trim() }), true)
    }
    const b: Busqueda = {
      id: id('b'),
      userId: YO,
      modo: d.modo,
      formato: d.modo === 'sala' ? null : d.formato,
      posicion: d.posicion,
      cancha: d.cancha,
      region: d.region,
      nombreSala: d.modo === 'sala' ? d.nombreSala?.trim() : undefined,
      faltan: d.modo === 'sala' ? d.faltan : undefined,
      creadaAt: ahora,
      expiraAt: d.modo === 'jugador' && d.duracion === '15min' ? ahora + MINUTOS_DISPONIBLE * 60 * SEG : null,
      estado: 'activa',
      avisar: null,
    }
    // Una sala recibe gente enseguida. A quien busca partido la demo le da un rato
    // para probar los mensajes antes de conectarlo sola con una sala.
    const programados = conEmparejar(s.programados, b.id, ahora + (d.modo === 'sala' ? 8 : 45) * SEG)
    if (d.modo === 'jugador') programados.push({ at: ahora + 15 * SEG, tipo: 'mensaje_entrante', busquedaId: b.id })
    set({ busquedas: [b, ...s.busquedas], programados })
    guardar(get())
    return null
  },

  cancelarBusqueda: () => {
    const s = get()
    const mia = miBusqueda(s)
    if (!mia) return
    if (REAL) {
      canceleAt = Date.now()
      // Se saca ya de la pantalla; el servidor decide qué pasa con el grupo o con la sala.
      set({
        busquedas: s.busquedas.filter((b) => b.id !== mia.id),
        mensajes: s.mensajes.map((m) => (m.estado === 'pendiente' ? { ...m, estado: 'rechazado' as const } : m)),
        toasts: s.toasts.filter((t) => !t.mensajeId),
      })
      void enServidor(() => cola.cancelar())
      return
    }
    const match = s.matches.find((m) => m.id === mia.matchId)
    const conGente = !!match && match.participantes.some((p) => p.userId !== YO)
    set({
      // Una sala donde ya entró gente no se cancela: se cierra y el partido queda.
      busquedas: conGente
        ? s.busquedas.map((b) => (b.id === mia.id ? { ...b, estado: 'match' as const } : b))
        : soltarGrupo(s.busquedas, mia, 'cancelada'),
      matches: match && !conGente ? s.matches.filter((m) => m.id !== match.id) : s.matches,
      // Los mensajes que quedaron sin responder se caen con la búsqueda.
      mensajes: s.mensajes.map((m) => (m.estado === 'pendiente' ? { ...m, estado: 'rechazado' as const } : m)),
      toasts: s.toasts.filter((t) => !t.mensajeId),
    })
    guardar(get())
  },

  responderAviso: (avisar) => {
    const s = get()
    const mia = miBusqueda(s)
    if (!mia) return
    set({ busquedas: s.busquedas.map((b) => (b.id === mia.id ? { ...b, avisar } : b)) })
    if (REAL) {
      void enServidor(() => cola.responderAviso(avisar))
      return
    }
    guardar(get())
  },

  renovarBusqueda: () => {
    const s = get()
    const ahora = s.ahora()
    const mia = miBusqueda(s)
    if (!mia) return
    const renovada = s.busquedas.map((b) => (b.id !== mia.id ? b : {
      ...b, creadaAt: ahora, expiraAt: ahora + MINUTOS_DISPONIBLE * 60 * SEG, ofertaHasta: null,
    }))
    if (REAL) {
      set({ busquedas: renovada })
      void enServidor(() => cola.renovar()).then((error) => {
        if (!error) set({ toasts: conToast(get(), { texto: 'Búsqueda renovada', detalle: '15 minutos más.' }) })
      })
      return
    }
    set({
      busquedas: renovada,
      toasts: conToast(s, { texto: 'Búsqueda renovada', detalle: '15 minutos más.' }),
    })
    guardar(get())
  },

  convertirEnSala: async ({ nombreSala, faltan, entreNosotros }) => {
    const s = get()
    const ahora = s.ahora()
    const mia = miBusqueda(s)
    const nombre = nombreSala.trim()
    if (!mia || mia.modo !== 'jugador') return 'No estás buscando partido.'
    if (!nombre) return 'Escribí el nombre de la sala.'
    if (REAL) return enServidor(() => cola.convertirEnSala(nombre, faltan, !!entreNosotros), true)
    const grupo = mia.grupo ?? []
    set({
      busquedas: s.busquedas.map((b) => (b.id !== mia.id ? b : {
        ...b, modo: 'sala' as const, formato: null, nombreSala: nombre, faltan: entreNosotros ? 0 : faltan,
        grupo: [], equipoListo: false, expiraAt: null, ofertaHasta: null, avisar: b.avisar ?? false,
      })),
    })
    // Los del grupo ya tienen su lugar. Si juegan entre ellos son rivales;
    // si van a buscar rival, son del equipo de quien creó la sala.
    if (grupo.length) set(ocupar(get(), ahora, grupo, entreNosotros ? 'B' : 'A'))
    if (!entreNosotros && faltan > 0) set({ programados: conEmparejar(get().programados, mia.id, ahora + 8 * SEG) })
    guardar(get())
    return null
  },

  // ----- Mensajes rápidos y salas -----

  enviarMensaje: (aUserId) => {
    const s = get()
    const ahora = s.ahora()
    if (s.mensajes.some((m) => m.de === YO && m.a === aUserId && m.estado === 'pendiente')) return
    const mia = miBusqueda(s)
    if (mia?.liderId) {
      set({ toasts: conToast(s, { texto: `Solo ${s.usuarios[mia.liderId]?.username ?? 'quien armó el grupo'} puede escribirles a otros` }) })
      return
    }
    const suya = s.busquedas.find((b) => b.userId === aUserId && b.estado === 'activa')
    let texto = textoInvitacion(mia)
    if (suya?.modo === 'sala') {
      const somos = cuantosSon(mia)
      if (somos > (suya.faltan ?? 0)) {
        set({ toasts: conToast(s, { texto: 'No entran todos en esa sala', detalle: `Le faltan ${suya.faltan} y ustedes son ${somos}.` }) })
        return
      }
      texto = somos > 1 ? `¿Entramos ${somos} a tu sala?` : '¿Me sumo a tu sala?'
    } else if (mia?.modo === 'sala' && suya && cuantosSon(suya) > (mia.faltan ?? 0)) {
      set({ toasts: conToast(s, { texto: 'No entran en tu sala', detalle: `Son ${cuantosSon(suya)} y te faltan ${mia.faltan ?? 0}.` }) })
      return
    }
    const msg: Mensaje = { id: id('msg'), de: YO, a: aUserId, texto, at: ahora, estado: 'pendiente' }
    if (REAL) {
      // Se muestra como enviado en el momento; el servidor confirma o avisa el problema.
      set({ mensajes: [msg, ...s.mensajes] })
      void enServidor(() => cola.enviarMensaje(aUserId))
      return
    }
    set({
      mensajes: [msg, ...s.mensajes],
      programados: [...s.programados, { at: ahora + 4 * SEG, tipo: 'respuesta_bot', mensajeId: msg.id }],
    })
    guardar(get())
  },

  responderMensaje: (mensajeId, aceptar) => {
    const s = get()
    const ahora = s.ahora()
    const msg = s.mensajes.find((m) => m.id === mensajeId)
    if (!msg || msg.estado !== 'pendiente') return
    set({
      mensajes: s.mensajes.map((m) => (m.id === mensajeId ? { ...m, estado: aceptar ? 'aceptado' as const : 'rechazado' as const } : m)),
      toasts: s.toasts.filter((t) => t.mensajeId !== mensajeId),
    })
    if (REAL) {
      if (aceptar) acepteAt = Date.now()
      void enServidor(() => cola.responderMensaje(mensajeId, aceptar))
      return
    }
    const st = get()
    const mia = miBusqueda(st)
    if (mia?.modo === 'sala') {
      if (aceptar) {
        // Acepto a un jugador (o a su grupo): ocupa un lugar y la sala sigue buscando el resto.
        const suya = st.busquedas.find((b) => b.userId === msg.de && b.estado === 'activa')
        const ids = [msg.de, ...(msg.con ?? suya?.grupo ?? [])]
        if (ids.length > (mia.faltan ?? 0)) set({ toasts: conToast(st, { texto: 'Ya no entran en tu sala', detalle: `Son ${ids.length} y te faltan ${mia.faltan ?? 0}.` }) })
        else set(ocupar(st, ahora, ids))
      } else {
        // Rechazado: el lugar sigue libre y la app no me lo vuelve a acercar.
        set({ busquedas: st.busquedas.map((b) => (b.id === mia.id ? { ...b, rechazados: [...(b.rechazados ?? []), msg.de] } : b)) })
      }
      const sigue = miBusqueda(get())
      if (sigue && (sigue.faltan ?? 0) > 0) set({ programados: conEmparejar(get().programados, sigue.id, ahora + 10 * SEG) })
    } else if (aceptar) {
      // Otro jugador me invitó: me sumo a su búsqueda y a su reloj.
      set(agrupar(st, ahora, msg.de, 'otro'))
    }
    guardar(get())
  },

  emparejarAhora: () => {
    if (REAL) return
    const s = get()
    const c = emparejar(s, s.ahora())
    set(c ?? { toasts: conToast(s, { texto: 'Nada que encaje por ahora', detalle: 'La app sigue buscando.' }) })
    guardar(get())
  },

  simularQuinceMinutos: () => {
    if (REAL) return
    const s = get()
    const ahora = s.ahora()
    const mia = miBusqueda(s)
    if (!mia || mia.expiraAt === null) return
    const salto = mia.expiraAt - ahora
    if (salto > 0) set({ busquedas: s.busquedas.map((b) => (b.id === mia.id ? { ...b, creadaAt: b.creadaAt - salto, expiraAt: ahora } : b)) })
    get().tick()
    guardar(get())
  },

  // ----- Mi sala: quién entró y quién se fue -----

  marcarEntro: (userId) => {
    const s = get()
    const ahora = s.ahora()
    const mia = miBusqueda(s)
    const match = s.matches.find((m) => m.id === mia?.matchId)
    if (!mia || !match) return
    const matches = s.matches.map((m) => (m.id !== match.id ? m : {
      ...m,
      participantes: m.participantes.map((p) => {
        if (p.userId === userId) return { ...p, entroAt: ahora }
        // Marcar que alguien entró es mi confirmación del partido.
        if (p.userId === YO && p.confirmadoAt === null) return { ...p, confirmadoAt: ahora }
        return p
      }),
    }))
    if (REAL) {
      set({ matches })
      void enServidor(() => cola.marcarEntro(userId))
      return
    }
    set({
      ...evaluarMatch(s, ahora, matches, match.id),
      programados: BOT.noConfirma.includes(userId)
        ? s.programados
        : [...s.programados, { at: ahora + 5 * SEG, tipo: 'confirma_bot', matchId: match.id, userId }],
    })
    // Sala completa y todos adentro: se termina la búsqueda y queda armado el match.
    const st = get()
    const actual = st.matches.find((m) => m.id === match.id)
    const todosAdentro = !!actual && actual.participantes.every((p) => p.userId === YO || !!p.entroAt)
    if ((mia.faltan ?? 0) === 0 && todosAdentro) {
      set({
        busquedas: st.busquedas.map((b) => (b.id === mia.id ? { ...b, estado: 'match' as const } : b)),
        notifs: conNotif(st, ahora, 'match', 'Match listo: tu sala está completa', 'Ya entraron todos', match.id),
        irA: `/match/${match.id}`,
      })
    }
    guardar(get())
  },

  marcarSalio: (userId, matchId) => {
    const s = get()
    const ahora = s.ahora()
    const activa = miBusqueda(s)
    const match = s.matches.find((m) => m.id === (matchId ?? activa?.matchId) && m.creadoPor === YO)
    if (!match) return
    if (REAL) {
      const quien = s.usuarios[userId]?.username ?? 'el jugador'
      void enServidor(() => cola.marcarSalio(userId, match.id)).then((error) => {
        if (error) return
        const st = get()
        const sala = miBusqueda(st)
        // La sala vuelve a buscar, salvo que ya tenga otra búsqueda en marcha.
        if (sala?.modo === 'sala' && (!sala.matchId || sala.matchId === match.id)) {
          const n = sala.faltan ?? 1
          set({ toasts: conToast(st, { texto: `Se liberó el lugar de ${quien}`, detalle: `Te ${n === 1 ? 'falta' : 'faltan'} ${n}. La sala vuelve a buscar.` }), irA: '/buscando' })
        } else {
          set({ toasts: conToast(st, { texto: `Se liberó el lugar de ${quien}`, detalle: 'No se reabre la sala porque ya tenés otra búsqueda.' }) })
        }
      })
      return
    }
    // La sala de ese partido: la que está abierta, o la que se cerró al completarse.
    const sala = s.busquedas.find((b) => b.userId === YO && b.matchId === match.id)
    const quedan = match.participantes.filter((p) => p.userId !== userId)
    // Si no queda nadie y el partido no llegó a contar, no hay partido.
    const sinPartido = quedan.every((p) => p.userId === YO) && match.contadoAt === null
    const matches = sinPartido
      ? s.matches.filter((m) => m.id !== match.id)
      : s.matches.map((m) => (m.id === match.id ? { ...m, participantes: quedan } : m))
    const nombre = s.usuarios[userId]?.username ?? 'el jugador'
    // Se puede volver a buscar si la sala sigue abierta o si no empecé otra búsqueda.
    const reabre = !!sala && (sala.estado === 'activa' || (sala.estado === 'match' && !activa))
    if (!sala || !reabre) {
      set({ matches, toasts: conToast(s, { texto: `Se liberó el lugar de ${nombre}`, detalle: 'No se reabre la sala porque ya tenés otra búsqueda.' }) })
      guardar(get())
      return
    }
    const faltan = (sala.faltan ?? 0) + 1
    // El reloj sigue desde donde había quedado cuando la sala se llenó.
    const pausa = sala.completaAt ? ahora - sala.completaAt : 0
    set({
      matches,
      busquedas: s.busquedas.map((b) => (b.id !== sala.id ? b : {
        ...b, estado: 'activa' as const, faltan, completaAt: null, creadaAt: b.creadaAt + pausa,
        matchId: sinPartido ? undefined : b.matchId,
      })),
      programados: conEmparejar(s.programados, sala.id, ahora + 8 * SEG),
      toasts: conToast(s, { texto: `Se liberó el lugar de ${nombre}`, detalle: `Te ${faltan === 1 ? 'falta' : 'faltan'} ${faltan}. La sala vuelve a buscar.` }),
      irA: '/buscando',
    })
    guardar(get())
  },

  // ----- Match -----

  confirmarMatch: (matchId) => {
    const s = get()
    const ahora = s.ahora()
    const m = s.matches.find((x) => x.id === matchId)
    if (!m) return
    const matches = s.matches.map((x) => (x.id !== matchId ? x : {
      ...x,
      participantes: x.participantes.map((p) => (p.userId === YO && p.confirmadoAt === null ? { ...p, confirmadoAt: ahora } : p)),
    }))
    if (REAL) {
      // Los puntos se suman cuando el servidor dice que el partido cuenta.
      set({ matches })
      void enServidor(() => cola.confirmar(matchId))
      return
    }
    const faltan = m.participantes.filter((p) => p.userId !== YO && p.confirmadoAt === null && !BOT.noConfirma.includes(p.userId))
    set({
      ...evaluarMatch(s, ahora, matches, matchId),
      programados: [
        ...s.programados,
        ...faltan.map((p) => ({ at: ahora + 5 * SEG, tipo: 'confirma_bot' as const, matchId, userId: p.userId })),
      ],
    })
    guardar(get())
  },

  descartarMatch: (matchId) => {
    set((s) => ({ matches: s.matches.map((m) => (m.id === matchId ? { ...m, descartado: true } : m)) }))
    if (REAL) {
      void enServidor(() => cola.descartar(matchId))
      return
    }
    guardar(get())
  },

  // ----- Clips -----

  reaccionar: (reelId) => {
    const s = get()
    const ahora = s.ahora()
    const reel = s.reels.find((r) => r.id === reelId)
    if (!reel) return
    if (s.misReacciones.includes(reelId)) {
      set({ misReacciones: s.misReacciones.filter((r) => r !== reelId) })
    } else {
      const puntos = reel.userId === YO ? 0 : puntosReaccion(s.eventos, YO, reelId, ahora)
      set({
        misReacciones: [...s.misReacciones, reelId],
        ...(puntos > 0 ? sumar(s, ahora, 'reaccion', puntos, reelId) : {}),
      })
    }
    guardar(get())
  },

  vincularTikTok: () => {
    const s = get()
    if (s.tiktok) return
    // Importar no da puntos: solo suma el reel nuevo que aparece después en el feed.
    set({
      tiktok: true,
      reels: [...seedMisVideos(s.ahora()), ...s.reels],
      toasts: conToast(s, { texto: 'TikTok vinculado', detalle: 'Importamos tus videos. Los que tienen #haxball o #haxmatch ya están en Clips.' }),
    })
    guardar(get())
  },

  alternarVisible: (reelId) => {
    set((s) => ({ reels: s.reels.map((r) => (r.id === reelId ? { ...r, visible: !r.visible } : r)) }))
    guardar(get())
  },

  simularVideoNuevo: () => {
    const s = get()
    const ahora = s.ahora()
    const titulos = ['Gol de taco en el último minuto', 'Triple pared y adentro', 'Atajada imposible', 'Contra letal en Big']
    const mios = s.reels.filter((r) => r.userId === YO).length
    const reel: Reel = {
      id: id('v'), userId: YO, origen: 'tiktok', titulo: titulos[mios % titulos.length],
      hashtags: ['haxmatch'], visible: true, publicadoAt: ahora, reacciones: 0, formato: '3v3',
    }
    const puntos = puntosReel(s.eventos, YO, reel.id, ahora)
    set({
      reels: [reel, ...s.reels],
      ...(puntos > 0 ? sumar(s, ahora, 'reel', puntos, reel.id) : {}),
      toasts: conToast(s, puntos > 0
        ? { texto: `Reel nuevo en Clips · +${puntos} puntos` }
        : { texto: 'Reel nuevo en Clips', detalle: 'Hoy ya sumaste por un reel. Mañana vuelve a sumar.' }),
    })
    guardar(get())
  },

  // ----- Amigos -----

  enviarSolicitud: async (username) => {
    const s = get()
    const buscado = username.trim().replace(/^@/, '').toLowerCase()
    if (!buscado) return { ok: false, texto: 'Escribí un usuario de Discord.' }
    if (buscado === s.perfil?.username.toLowerCase()) return { ok: false, texto: 'Ese sos vos.' }
    if (REAL) {
      const r = await pedirAmistadPorUsuario(buscado)
      await get().refrescar()
      if (r.error) return { ok: false, texto: r.error }
      return { ok: true, texto: r.estado === 'amigos' ? `${r.nick} y vos ya son amigos.` : `Solicitud enviada a ${r.nick}.` }
    }
    const u = Object.values(s.usuarios).find((x) => x.username.toLowerCase() === buscado)
    if (!u) return { ok: false, texto: 'Ese usuario todavía no está en HaxMatch.' }
    if (s.amigos.includes(u.id)) return { ok: false, texto: `${u.username} ya es tu amigo.` }
    if (s.solicitudesEnviadas.includes(u.id)) return { ok: false, texto: 'Ya le mandaste una solicitud.' }
    if (s.solicitudes.includes(u.id)) {
      get().responderSolicitud(u.id, true)
      return { ok: true, texto: `${u.username} ya te había agregado. Ahora son amigos.` }
    }
    set({
      solicitudesEnviadas: [...s.solicitudesEnviadas, u.id],
      programados: [...s.programados, { at: s.ahora() + 5 * SEG, tipo: 'acepta_solicitud', userId: u.id }],
    })
    guardar(get())
    return { ok: true, texto: `Solicitud enviada a ${u.username}.` }
  },

  pedirAmistad: async (userId) => {
    const s = get()
    if (userId === YO || s.amigos.includes(userId) || s.solicitudesEnviadas.includes(userId)) return null
    if (s.solicitudes.includes(userId)) {
      // Ya me había mandado una: aceptarla es lo mismo.
      get().responderSolicitud(userId, true)
      return null
    }
    if (REAL) {
      // Se muestra como enviada en el momento; el servidor confirma o avisa el problema.
      set({ solicitudesEnviadas: [...s.solicitudesEnviadas, userId] })
      return enServidor(() => cola.pedirAmistad(userId), true)
    }
    set({
      solicitudesEnviadas: [...s.solicitudesEnviadas, userId],
      programados: [...s.programados, { at: s.ahora() + 5 * SEG, tipo: 'acepta_solicitud', userId }],
    })
    guardar(get())
    return null
  },

  responderSolicitud: (userId, aceptar) => {
    set((s) => ({
      solicitudes: s.solicitudes.filter((u) => u !== userId),
      amigos: aceptar && !s.amigos.includes(userId) ? [...s.amigos, userId] : s.amigos,
    }))
    if (REAL) {
      void enServidor(() => cola.responderAmistad(userId, aceptar))
      return
    }
    guardar(get())
  },

  quitarAmigo: (userId) => {
    set((s) => ({
      amigos: s.amigos.filter((u) => u !== userId),
      solicitudesEnviadas: s.solicitudesEnviadas.filter((u) => u !== userId),
    }))
    if (REAL) {
      void enServidor(() => cola.quitarAmigo(userId))
      return
    }
    guardar(get())
  },

  abrirFicha: (userId) => {
    if (userId !== YO) set({ ficha: userId })
  },
  cerrarFicha: () => set({ ficha: null }),

  // ----- Moderación -----

  reportar: async ({ reportado, motivo, detalle }) => {
    if (REAL) {
      const error = await cola.reportar(reportado, motivo, detalle.trim())
      if (error) return error
    }
    const s = get()
    set({
      reportes: [...s.reportes, { id: id('rep'), reportado, motivo, detalle: detalle.trim(), at: s.ahora() }],
      toasts: conToast(s, { texto: 'Reporte enviado', detalle: 'Lo revisa el equipo.' }),
    })
    guardar(get())
    return null
  },

  alternarBloqueo: (userId) => {
    set((s) => ({
      bloqueados: s.bloqueados.includes(userId) ? s.bloqueados.filter((u) => u !== userId) : [...s.bloqueados, userId],
    }))
    guardar(get())
  },

  // ----- Notificaciones y referidos -----

  marcarLeidas: () => {
    set((s) => ({ notifs: s.notifs.map((n) => (n.leida ? n : { ...n, leida: true })) }))
    guardar(get())
  },

  simularAmistosoReferido: (userId) => {
    const s = get()
    const ahora = s.ahora()
    const r = s.referidos.find((x) => x.userId === userId)
    if (!r || r.acreditado) return
    const amistosos = r.amistosos + 1
    const completo = amistosos >= AMISTOSOS_REFERIDO
    const puntos = completo ? puntosReferido(s.eventos, YO, ahora) : 0
    const nombre = s.usuarios[userId].username
    const referidos = s.referidos.map((x) => (x.userId === userId ? { ...x, amistosos, acreditado: completo } : x))
    if (!completo) {
      set({ referidos })
    } else {
      const base = puntos > 0 ? sumar(s, ahora, 'referido', puntos, userId) : { eventos: s.eventos, notifs: s.notifs }
      set({
        referidos,
        eventos: base.eventos,
        notifs: [
          { id: id('n'), tipo: 'referido', titulo: `${nombre} completó ${AMISTOSOS_REFERIDO} amistosos`, detalle: puntos > 0 ? `+${puntos} puntos de nivel` : 'Este mes ya llegaste al tope de referidos', at: ahora, leida: false },
          ...base.notifs,
        ],
        toasts: conToast(s, { texto: `${nombre} completó ${AMISTOSOS_REFERIDO} amistosos`, detalle: puntos > 0 ? `+${puntos} puntos` : undefined }),
      })
    }
    guardar(get())
  },
  }
})

// ---------- Lecturas derivadas ----------

export { YO }

export function buscarMia(s: Store): Busqueda | undefined {
  return miBusqueda(s)
}

function disponibles(s: Store, modo: Modo): Busqueda[] {
  const mia = miBusqueda(s)
  const comparten = <T,>(a: readonly T[] | null | undefined, b: readonly T[] | null | undefined) =>
    !!a && !!b && a.some((v) => b.includes(v))
  const afin = (b: Busqueda) => Number(comparten(b.region, mia?.region)) + Number(comparten(b.formato, mia?.formato))
  return s.busquedas
    .filter((b) => b.estado === 'activa' && b.modo === modo && b.userId !== YO && !s.bloqueados.includes(b.userId))
    .filter((b) => modo === 'jugador' || (b.faltan ?? 0) > 0)
    // Primero lo que encaja justo, después amigos y los más parecidos a lo que busco.
    .sort((a, b) =>
      Number(encajaJusto(s, b)) - Number(encajaJusto(s, a)) ||
      Number(s.amigos.includes(b.userId)) - Number(s.amigos.includes(a.userId)) || afin(b) - afin(a) || b.creadaAt - a.creadaAt)
}

/**
 * ¿Esta búsqueda es justo lo que necesito? Para mi sala: un jugador o grupo
 * del tamaño de los lugares libres. Para mí o mi grupo: una sala a la que le
 * faltan justo los que somos.
 */
export function encajaJusto(s: Store, b: Busqueda): boolean {
  const mia = miBusqueda(s)
  if (!mia) return false
  if (mia.modo === 'sala') return b.modo === 'jugador' && (mia.faltan ?? 0) > 0 && cuantosSon(b) === mia.faltan
  return b.modo === 'sala' && b.faltan === cuantosSon(mia)
}

/** Jugadores (solos o en grupo) que también están buscando partido. */
export function jugadoresBuscando(s: Store): Busqueda[] {
  return disponibles(s, 'jugador')
}

/** Salas a las que les faltan jugadores. */
export function salasBuscando(s: Store): Busqueda[] {
  return disponibles(s, 'sala')
}

/** El partido de mi sala, con los que ya tienen lugar. */
export function miSala(s: Store): Match | undefined {
  const mia = miBusqueda(s)
  return mia?.modo === 'sala' ? s.matches.find((m) => m.id === mia.matchId) : undefined
}

export function feed(s: Store): Reel[] {
  return s.reels
    .filter((r) => r.visible && r.hashtags.some((h) => h === 'haxball' || h === 'haxmatch') && !s.bloqueados.includes(r.userId))
    .sort((a, b) => b.publicadoAt - a.publicadoAt)
}

/** Datos de un usuario para mostrar. Si todavía no llegaron, devuelve uno genérico. */
export function usuarioDe(s: Store, userId: string): Usuario {
  return s.usuarios[userId] ?? { id: userId, username: 'Jugador', nivel: null, color: '#5B6F8C' }
}

/** "Nivel 4 · " para anteponer a un detalle. Vacío mientras el nivel de los demás no se conozca. */
export function nivelTexto(u: Usuario | undefined): string {
  return u && u.nivel !== null ? `Nivel ${u.nivel} · ` : ''
}

export function nombreDe(s: Store, userId: string): string {
  if (userId === YO) return s.perfil?.nick ?? 'Vos'
  return s.usuarios[userId]?.username ?? 'Jugador'
}

export function rivalesDe(s: Store, m: Match): string {
  return m.participantes.filter((p) => p.userId !== YO).map((p) => nombreDe(s, p.userId)).join(', ')
}

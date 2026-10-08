// Reglas de producto de HaxMatch (especificación v1, sección 3).
// Funciones puras: no leen ni guardan nada. El backend tiene que aplicar las mismas.
import { POSICIONES, type Cancha, type EventoPuntos, type Match, type Posicion } from './types'

export const PUNTOS = { amistoso: 10, reel: 8, reaccion: 1, conexion: 2, referido: 50 } as const

export const TOPES = {
  amistososPorDia: 5,
  mismoRivalPorDia: 3,
  reelsPorDia: 1,
  reaccionesPorDia: 10,
  referidosPorMes: 10,
} as const

/** Días seguidos → puntos extra. */
export const RACHAS: ReadonlyArray<readonly [dias: number, puntos: number]> = [
  [3, 5], [7, 15], [14, 30], [30, 60],
]

/** Puntos acumulados necesarios para cada nivel (nivel 1 = índice 0). */
export const NIVELES = [50, 150, 300, 500, 800, 1200, 1700, 2300, 3000, 4000] as const
export const NIVEL_SORTEO = 8
export const DIAS_PENDIENTE = 7
export const AMISTOSOS_REFERIDO = 5
export const MINUTOS_DISPONIBLE = 15
/** Tiempo para responder al cartel de los 15 minutos antes de que la búsqueda venza. */
export const MINUTOS_OFERTA = 2

const DIA_MS = 24 * 60 * 60 * 1000

/** Día calendario local, "AAAA-MM-DD". */
export function diaDe(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function mesDe(ts: number): string {
  return diaDe(ts).slice(0, 7)
}

function diaAnterior(dia: string): string {
  const [y, m, d] = dia.split('-').map(Number)
  return diaDe(new Date(y, m - 1, d - 1, 12).getTime())
}

export function totalPuntos(eventos: EventoPuntos[], userId: string): number {
  return eventos.reduce((s, e) => (e.userId === userId ? s + e.puntos : s), 0)
}

export function nivelDe(puntos: number): number {
  let nivel = 0
  for (const minimo of NIVELES) {
    if (puntos >= minimo) nivel++
    else break
  }
  return nivel
}

export interface Progreso {
  nivel: number
  puntos: number
  /** Puntos donde empieza el nivel actual. */
  desde: number
  /** Puntos del próximo nivel. null si ya está en el máximo. */
  hasta: number | null
  /** 0 a 1. */
  avance: number
}

export function progresoNivel(puntos: number): Progreso {
  const nivel = nivelDe(puntos)
  const desde = nivel === 0 ? 0 : NIVELES[nivel - 1]
  const hasta = nivel < NIVELES.length ? NIVELES[nivel] : null
  const avance = hasta === null ? 1 : (puntos - desde) / (hasta - desde)
  return { nivel, puntos, desde, hasta, avance }
}

/**
 * ¿El partido cuenta como válido?
 * 1v1: confirman los dos. Equipos: alcanza con uno de cada equipo.
 */
export function matchCuenta(m: Match): boolean {
  if (m.descartado) return false
  const ps = m.participantes
  if (m.formato === '1v1') return ps.length >= 2 && ps.every((p) => p.confirmadoAt !== null)
  const confirmo = (equipo: 'A' | 'B') => ps.some((p) => p.equipo === equipo && p.confirmadoAt !== null)
  return confirmo('A') && confirmo('B')
}

/** Clave de los rivales de un jugador en un partido, para el tope por rival. */
export function rivalDe(m: Match, userId: string): string {
  const yo = m.participantes.find((p) => p.userId === userId)
  if (!yo) return ''
  return m.participantes
    .filter((p) => p.equipo !== yo.equipo)
    .map((p) => p.userId)
    .sort()
    .join('+')
}

function delDia(eventos: EventoPuntos[], userId: string, tipo: EventoPuntos['tipo'], ahora: number) {
  const hoy = diaDe(ahora)
  return eventos.filter((e) => e.userId === userId && e.tipo === tipo && e.puntos > 0 && diaDe(e.fecha) === hoy)
}

/**
 * Puntos que da un amistoso confirmado hoy: 10, o 0 si ya se llegó a un tope.
 * El partido se registra igual. El tope es de puntos, no de partidos.
 */
export function puntosAmistoso(eventos: EventoPuntos[], userId: string, rival: string, ahora: number): number {
  const hoy = delDia(eventos, userId, 'amistoso', ahora)
  if (hoy.length >= TOPES.amistososPorDia) return 0
  if (hoy.filter((e) => e.rival === rival).length >= TOPES.mismoRivalPorDia) return 0
  return PUNTOS.amistoso
}

/** Reacción a un reel de otro: 1 punto, hasta 10 reels distintos por día. */
export function puntosReaccion(eventos: EventoPuntos[], userId: string, reelId: string, ahora: number): number {
  const yaSumo = eventos.some((e) => e.userId === userId && e.tipo === 'reaccion' && e.referencia === reelId)
  if (yaSumo) return 0
  return delDia(eventos, userId, 'reaccion', ahora).length >= TOPES.reaccionesPorDia ? 0 : PUNTOS.reaccion
}

/** Reel nuevo en el feed: 8 puntos, 1 por día. */
export function puntosReel(eventos: EventoPuntos[], userId: string, reelId: string, ahora: number): number {
  const yaSumo = eventos.some((e) => e.userId === userId && e.tipo === 'reel' && e.referencia === reelId)
  if (yaSumo) return 0
  return delDia(eventos, userId, 'reel', ahora).length >= TOPES.reelsPorDia ? 0 : PUNTOS.reel
}

/** Referido que completó sus amistosos: 50 puntos, hasta 10 por mes. */
export function puntosReferido(eventos: EventoPuntos[], userId: string, ahora: number): number {
  const mes = mesDe(ahora)
  const delMes = eventos.filter((e) => e.userId === userId && e.tipo === 'referido' && e.puntos > 0 && mesDe(e.fecha) === mes)
  return delMes.length >= TOPES.referidosPorMes ? 0 : PUNTOS.referido
}

export function conectoHoy(eventos: EventoPuntos[], userId: string, ahora: number): boolean {
  const hoy = diaDe(ahora)
  return eventos.some((e) => e.userId === userId && e.tipo === 'conexion' && diaDe(e.fecha) === hoy)
}

/** Días seguidos con conexión, contando hoy. Se corta si falta un día. */
export function rachaActual(eventos: EventoPuntos[], userId: string, ahora: number): number {
  const dias = new Set(eventos.filter((e) => e.userId === userId && e.tipo === 'conexion').map((e) => diaDe(e.fecha)))
  let dia = diaDe(ahora)
  // Si hoy todavía no se conectó, la racha sigue viva hasta que termine el día.
  if (!dias.has(dia)) dia = diaAnterior(dia)
  let n = 0
  while (dias.has(dia)) {
    n++
    dia = diaAnterior(dia)
  }
  return n
}

/** Puntos extra al llegar justo a 3, 7, 14 o 30 días seguidos. */
export function bonusRacha(dias: number): number {
  return RACHAS.find(([d]) => d === dias)?.[1] ?? 0
}

export function proximaRacha(dias: number): readonly [number, number] | null {
  return RACHAS.find(([d]) => d > dias) ?? null
}

/** Partido que el usuario todavía puede confirmar desde su Perfil. */
export function esPendiente(m: Match, userId: string, ahora: number): boolean {
  if (m.descartado || m.contadoAt !== null) return false
  const yo = m.participantes.find((p) => p.userId === userId)
  if (!yo || yo.confirmadoAt !== null) return false
  return ahora - m.createdAt < DIAS_PENDIENTE * DIA_MS
}

export function diasParaVencer(m: Match, ahora: number): number {
  return Math.max(0, Math.ceil((m.createdAt + DIAS_PENDIENTE * DIA_MS - ahora) / DIA_MS))
}

export function entraAlSorteo(nivel: number): boolean {
  return nivel >= NIVEL_SORTEO
}

// ---------- Salas: qué se puede pedir según la cancha ----------

export type CanchaSala = Exclude<Cancha, 'Cualquiera'>

/** Canchas para abrir una sala, en el orden en que se muestran. */
export const CANCHAS_SALA: CanchaSala[] = ['Classic', 'Big', 'Big Easy', 'Futsal', 'Real Futsal', 'Real Soccer']

/**
 * Cuántos pueden faltar como mucho y qué posiciones tiene cada cancha.
 * Classic es 1 contra 1: falta uno y no hay posiciones para elegir.
 */
export const REGLAS_CANCHA: Record<CanchaSala, { maxFaltan: number; posiciones: Posicion[] }> = {
  Classic: { maxFaltan: 1, posiciones: [] },
  Big: { maxFaltan: 2, posiciones: ['Polifuncional', 'GK', 'MC', 'DC'] },
  'Big Easy': { maxFaltan: 3, posiciones: ['Polifuncional', 'GK', 'DFC', 'MC', 'DC'] },
  Futsal: { maxFaltan: 6, posiciones: [...POSICIONES] },
  'Real Futsal': { maxFaltan: 6, posiciones: [...POSICIONES] },
  'Real Soccer': { maxFaltan: 3, posiciones: ['Polifuncional', 'GK', 'DFC', 'MC', 'DC'] },
}

/** Al cambiar de cancha, lo que ya estaba elegido se acomoda a lo que esa cancha permite. */
export function ajustarSala(cancha: CanchaSala, faltan: number, posicion: Posicion[]): { faltan: number; posicion: Posicion[] } {
  const r = REGLAS_CANCHA[cancha]
  const quedan = posicion.filter((p) => r.posiciones.includes(p))
  return {
    faltan: Math.min(Math.max(1, faltan), r.maxFaltan),
    posicion: quedan.length > 0 ? quedan : ['Polifuncional'],
  }
}

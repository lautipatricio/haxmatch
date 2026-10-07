// Datos de prueba. Todo lo que hay acá es inventado para poder recorrer la app
// sin backend. Se reemplaza por Supabase en las etapas siguientes.
import type { Busqueda, EventoPuntos, Match, Notif, Reel, Referido, Usuario } from '../domain/types'

const MIN = 60 * 1000
const HORA = 60 * MIN

export const YO = 'yo'

export const USUARIOS: Record<string, Usuario> = {
  u_mati: { id: 'u_mati', username: 'Mati_', nivel: 4, color: '#5B8C7A', jugados: 41 },
  u_tobi: { id: 'u_tobi', username: 'Tobi_GK', nivel: 6, color: '#8C7A5B', jugados: 96 },
  u_pibe: { id: 'u_pibe', username: 'Pibe9', nivel: 3, color: '#7A5B8C', jugados: 23 },
  u_nico: { id: 'u_nico', username: 'Nico', nivel: 5, color: '#5B6F8C', jugados: 64 },
  u_lucho: { id: 'u_lucho', username: 'Lucho', nivel: 5, color: '#8C5B62', jugados: 58 },
  u_marce: { id: 'u_marce', username: 'Marce10', nivel: 2, color: '#6F8C5B', jugados: 12 },
  u_cami: { id: 'u_cami', username: 'Cami_DC', nivel: 7, color: '#8C6A5B', jugados: 131 },
  u_rolo: { id: 'u_rolo', username: 'Rolo', nivel: 1, color: '#5B8C8A', jugados: 5 },
  u_fede: { id: 'u_fede', username: 'Fede_7', nivel: 3, color: '#8C825B', jugados: 27 },
}

/** Códigos de referido de los usuarios de prueba, para probar el onboarding. */
export const CODIGOS: Record<string, string> = { NICO23: 'u_nico', MATI10: 'u_mati' }

/** Comportamiento de los jugadores simulados. */
export const BOT = {
  /** Rechaza los mensajes. */
  rechaza: ['u_pibe'],
  /** Nunca confirma que el jugador entró a su sala: el partido queda sin contar. */
  noConfirma: ['u_rolo'],
}

export function seedBusquedas(ahora: number): Busqueda[] {
  const b = (
    id: string, userId: string, hace: number,
    datos: Partial<Busqueda> & Pick<Busqueda, 'modo' | 'cancha' | 'region'>,
  ): Busqueda => ({
    id, userId, formato: null, posicion: ['Polifuncional'], creadaAt: ahora - hace,
    expiraAt: null, estado: 'activa', avisar: true, ...datos,
  })
  return [
    // Quien busca partido no elige nada: entra a la cola con las regiones de su perfil.
    b('b_mati', 'u_mati', 2 * MIN, { modo: 'jugador', formato: ['Cualquiera'], cancha: ['Cualquiera'], region: ['ARG'] }),
    b('b_nico', 'u_nico', 4 * MIN, { modo: 'sala', posicion: ['GK', 'DFC'], cancha: ['Big'], region: ['ARG'], nombreSala: 'nico 3v3 amistoso', faltan: 2 }),
    b('b_tobi', 'u_tobi', 6 * MIN, { modo: 'jugador', formato: ['Cualquiera'], cancha: ['Cualquiera'], region: ['ARG'], grupo: ['u_fede'] }),
    // Fede_7 busca en grupo con Tobi_GK: comparten reloj.
    b('b_fede', 'u_fede', 6 * MIN, { modo: 'jugador', formato: ['Cualquiera'], cancha: ['Cualquiera'], region: ['ARG'], estado: 'agrupada' }),
    b('b_pibe', 'u_pibe', 9 * MIN, { modo: 'jugador', formato: ['Cualquiera'], cancha: ['Cualquiera'], region: ['ARG', 'CHI'] }),
    b('b_cami', 'u_cami', 11 * MIN, { modo: 'jugador', formato: ['Cualquiera'], cancha: ['Cualquiera'], region: ['CHI'] }),
    b('b_rolo', 'u_rolo', 14 * MIN, { modo: 'sala', cancha: ['Futsal', 'Real Futsal'], region: ['UY', 'BR'], nombreSala: 'futsal rolo', faltan: 1 }),
  ]
}

/** Un partido de ayer que el rival confirmó y el usuario no: aparece como pendiente en el Perfil. */
export function seedMatches(ahora: number): Match[] {
  return [{
    id: 'm_seed',
    creadoPor: 'u_lucho',
    formato: '2v2',
    cancha: 'Big',
    nombreSala: 'lucho 2v2',
    createdAt: ahora - 20 * HORA,
    participantes: [
      { userId: 'u_lucho', equipo: 'A', confirmadoAt: ahora - 20 * HORA },
      { userId: YO, equipo: 'B', confirmadoAt: null },
    ],
    contadoAt: null,
  }]
}

export function seedReels(ahora: number): Reel[] {
  const r = (id: string, userId: string, titulo: string, formato: Reel['formato'], hace: number, reacciones: number): Reel => ({
    id, userId, origen: 'tiktok', titulo, hashtags: ['haxball'], visible: true,
    publicadoAt: ahora - hace, reacciones, formato,
  })
  return [
    r('r_1', 'u_lucho', 'Golazo desde mitad de cancha', '3v3', 2 * HORA, 48),
    r('r_2', 'u_tobi', 'Atajada en el último segundo', '4v4', 5 * HORA, 131),
    r('r_3', 'u_mati', 'Pared y definición al primer palo', '2v2', 9 * HORA, 27),
    r('r_4', 'u_cami', 'Remontada 3-0 en Classic', '1v1', 26 * HORA, 86),
    r('r_5', 'u_nico', 'Doble amague y gol', '3v3', 31 * HORA, 64),
    r('r_6', 'u_pibe', 'Gol olímpico en Futsal', '2v2', 50 * HORA, 19),
  ]
}

/** Videos que "trae" TikTok al vincular la cuenta. Solo los que tienen hashtag entran al feed. */
export function seedMisVideos(ahora: number): Reel[] {
  const v = (id: string, titulo: string, hashtags: string[], hace: number): Reel => ({
    id, userId: YO, origen: 'tiktok', titulo, hashtags, visible: true,
    publicadoAt: ahora - hace, reacciones: 0, formato: '3v3',
  })
  return [
    v('v_1', 'Mi mejor gol del mes', ['haxball', 'golazo'], 3 * 24 * HORA),
    v('v_2', 'Atajadas de la semana', ['haxmatch'], 6 * 24 * HORA),
    v('v_3', 'Probando la cancha nueva', [], 8 * 24 * HORA),
    v('v_4', 'Cumple de mi hermana', [], 12 * 24 * HORA),
  ]
}

export function seedNotifs(ahora: number): Notif[] {
  return [
    { id: 'n_1', tipo: 'amigo_disponible', titulo: 'Tu amigo Mati_ se puso disponible', detalle: '3v3 · Big', at: ahora - 2 * MIN, leida: false, ref: 'b_mati' },
    { id: 'n_2', tipo: 'amigo_sala', titulo: 'Tu amigo Nico necesita 2 más', detalle: 'Sala "nico 3v3 amistoso"', at: ahora - 4 * MIN, leida: false, ref: 'b_nico' },
    { id: 'n_3', tipo: 'solicitud', titulo: 'Tobi_GK quiere ser tu amigo', detalle: 'Respondé desde Amigos', at: ahora - 40 * MIN, leida: false, ref: 'u_tobi' },
  ]
}

export const SEED_AMIGOS = ['u_mati', 'u_nico', 'u_lucho', 'u_marce']
export const SEED_SOLICITUDES = ['u_tobi']
export const SEED_REFERIDOS: Referido[] = [{ userId: 'u_marce', amistosos: 2, acreditado: false }]
export const SEED_EVENTOS: EventoPuntos[] = []

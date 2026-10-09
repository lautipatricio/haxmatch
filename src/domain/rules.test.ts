import { describe, expect, it } from 'vitest'
import {
  REGLAS_CANCHA, ajustarSala, linkDeSala, bonusRacha, esPendiente, matchCuenta, nivelDe,
  progresoNivel, puntosAmistoso, puntosReaccion, puntosReel, puntosReferido, rachaActual, rivalDe,
} from './rules'
import type { EventoPuntos, Match, Participante } from './types'

const HOY = new Date(2026, 9, 6, 18, 0).getTime()
const DIA = 24 * 60 * 60 * 1000

let n = 0
function ev(tipo: EventoPuntos['tipo'], extra: Partial<EventoPuntos> = {}): EventoPuntos {
  return { id: `e${n++}`, userId: 'yo', tipo, puntos: 10, fecha: HOY, referencia: `r${n}`, ...extra }
}
function match(formato: Match['formato'], ps: Array<[string, 'A' | 'B', boolean]>, extra: Partial<Match> = {}): Match {
  const participantes: Participante[] = ps.map(([userId, equipo, ok]) => ({ userId, equipo, confirmadoAt: ok ? HOY : null }))
  return { id: 'm', creadoPor: ps[0][0], formato, cancha: 'Big', nombreSala: 's', createdAt: HOY, participantes, contadoAt: null, ...extra }
}

describe('niveles', () => {
  it('todos empiezan en 0', () => expect(nivelDe(0)).toBe(0))
  it('sube justo en cada mínimo', () => {
    expect(nivelDe(49)).toBe(0)
    expect(nivelDe(50)).toBe(1)
    expect(nivelDe(2299)).toBe(7)
    expect(nivelDe(2300)).toBe(8)
    expect(nivelDe(4000)).toBe(10)
    expect(nivelDe(99999)).toBe(10)
  })
  it('calcula el avance dentro del nivel', () => {
    expect(progresoNivel(100)).toMatchObject({ nivel: 1, desde: 50, hasta: 150, avance: 0.5 })
    expect(progresoNivel(4500)).toMatchObject({ nivel: 10, hasta: null, avance: 1 })
  })
})

describe('validación de partidos', () => {
  it('1v1 cuenta solo cuando confirman los dos', () => {
    expect(matchCuenta(match('1v1', [['a', 'A', true], ['b', 'B', false]]))).toBe(false)
    expect(matchCuenta(match('1v1', [['a', 'A', true], ['b', 'B', true]]))).toBe(true)
  })
  it('en equipos alcanza con uno de cada equipo', () => {
    const ps: Array<[string, 'A' | 'B', boolean]> = [
      ['a', 'A', true], ['b', 'A', false], ['c', 'A', false],
      ['d', 'B', false], ['e', 'B', true], ['f', 'B', false],
    ]
    expect(matchCuenta(match('3v3', ps))).toBe(true)
  })
  it('no cuenta si confirma un solo equipo', () => {
    expect(matchCuenta(match('2v2', [['a', 'A', true], ['b', 'A', true], ['c', 'B', false], ['d', 'B', false]]))).toBe(false)
  })
  it('un partido descartado no cuenta', () => {
    expect(matchCuenta(match('1v1', [['a', 'A', true], ['b', 'B', true]], { descartado: true }))).toBe(false)
  })
  it('arma la clave de rivales sin importar el orden', () => {
    const m = match('2v2', [['yo', 'A', true], ['x', 'A', true], ['zeta', 'B', true], ['beto', 'B', true]])
    expect(rivalDe(m, 'yo')).toBe('beto+zeta')
  })
})

describe('tope de puntos por amistosos', () => {
  it('da 10 puntos hasta 5 amistosos por día', () => {
    const eventos = ['a', 'b', 'c', 'd'].map((rival) => ev('amistoso', { rival }))
    expect(puntosAmistoso(eventos, 'yo', 'e', HOY)).toBe(10)
    eventos.push(ev('amistoso', { rival: 'e' }))
    expect(puntosAmistoso(eventos, 'yo', 'f', HOY)).toBe(0)
  })
  it('máximo 3 por día con el mismo rival', () => {
    const eventos = [1, 2, 3].map(() => ev('amistoso', { rival: 'a' }))
    expect(puntosAmistoso(eventos, 'yo', 'a', HOY)).toBe(0)
    expect(puntosAmistoso(eventos, 'yo', 'b', HOY)).toBe(10)
  })
  it('los partidos que ya no sumaron no consumen el tope', () => {
    const eventos = [1, 2, 3, 4, 5].map(() => ev('amistoso', { rival: 'a', puntos: 0 }))
    expect(puntosAmistoso(eventos, 'yo', 'b', HOY)).toBe(10)
  })
  it('el tope se renueva al día siguiente', () => {
    const eventos = ['a', 'b', 'c', 'd', 'e'].map((rival) => ev('amistoso', { rival }))
    expect(puntosAmistoso(eventos, 'yo', 'a', HOY + DIA)).toBe(10)
  })
})

describe('reels y reacciones', () => {
  it('una reacción suma una sola vez por reel', () => {
    const eventos = [ev('reaccion', { puntos: 1, referencia: 'reel1' })]
    expect(puntosReaccion(eventos, 'yo', 'reel1', HOY)).toBe(0)
    expect(puntosReaccion(eventos, 'yo', 'reel2', HOY)).toBe(1)
  })
  it('hasta 10 reels distintos por día', () => {
    const eventos = Array.from({ length: 10 }, (_, i) => ev('reaccion', { puntos: 1, referencia: `reel${i}` }))
    expect(puntosReaccion(eventos, 'yo', 'otro', HOY)).toBe(0)
    expect(puntosReaccion(eventos, 'yo', 'otro', HOY + DIA)).toBe(1)
  })
  it('un reel nuevo por día', () => {
    const eventos = [ev('reel', { puntos: 8, referencia: 'v1' })]
    expect(puntosReel(eventos, 'yo', 'v2', HOY)).toBe(0)
    expect(puntosReel(eventos, 'yo', 'v2', HOY + DIA)).toBe(8)
    expect(puntosReel([], 'yo', 'v1', HOY)).toBe(8)
  })
})

describe('racha', () => {
  const conexiones = (dias: number[]) => dias.map((d) => ev('conexion', { puntos: 2, fecha: HOY - d * DIA }))
  it('cuenta días seguidos incluyendo hoy', () => expect(rachaActual(conexiones([0, 1, 2]), 'yo', HOY)).toBe(3))
  it('se corta si falta un día', () => expect(rachaActual(conexiones([0, 2, 3]), 'yo', HOY)).toBe(1))
  it('sigue viva si hoy todavía no se conectó', () => expect(rachaActual(conexiones([1, 2]), 'yo', HOY)).toBe(2))
  it('vuelve a cero después de un día sin conexión', () => expect(rachaActual(conexiones([2, 3]), 'yo', HOY)).toBe(0))
  it('da el extra solo al llegar a 3, 7, 14 y 30', () => {
    expect([2, 3, 4, 7, 14, 30, 31].map(bonusRacha)).toEqual([0, 5, 0, 15, 30, 60, 0])
  })
})

describe('referidos', () => {
  it('50 puntos, hasta 10 por mes', () => {
    const eventos = Array.from({ length: 9 }, () => ev('referido', { puntos: 50 }))
    expect(puntosReferido(eventos, 'yo', HOY)).toBe(50)
    eventos.push(ev('referido', { puntos: 50 }))
    expect(puntosReferido(eventos, 'yo', HOY)).toBe(0)
    expect(puntosReferido(eventos, 'yo', HOY + 40 * DIA)).toBe(50)
  })
})

describe('partidos pendientes', () => {
  const m = match('2v2', [['yo', 'A', false], ['rival', 'B', true]])
  it('queda pendiente si no confirmé', () => expect(esPendiente(m, 'yo', HOY + DIA)).toBe(true))
  it('vence a los 7 días', () => expect(esPendiente(m, 'yo', HOY + 7 * DIA)).toBe(false))
  it('no es pendiente para quien ya confirmó', () => expect(esPendiente(m, 'rival', HOY)).toBe(false))
})

describe('salas según la cancha', () => {
  it('cada cancha tiene su máximo de lugares', () => {
    expect(Object.fromEntries(Object.entries(REGLAS_CANCHA).map(([c, r]) => [c, r.maxFaltan]))).toEqual({
      Classic: 1, Big: 2, 'Big Easy': 3, Futsal: 6, 'Real Futsal': 6, 'Real Soccer': 3,
    })
  })
  it('Classic: falta uno y no hay posiciones', () => {
    expect(ajustarSala('Classic', 4, ['GK', 'DC'])).toEqual({ faltan: 1, posicion: ['Polifuncional'] })
  })
  it('Big no tiene defensores', () => {
    expect(ajustarSala('Big', 5, ['GK', 'DFC'])).toEqual({ faltan: 2, posicion: ['GK'] })
    expect(ajustarSala('Big', 1, ['DFC'])).toEqual({ faltan: 1, posicion: ['Polifuncional'] })
  })
  it('Futsal deja todas las posiciones y hasta 6', () => {
    expect(ajustarSala('Futsal', 6, ['LD', 'EI'])).toEqual({ faltan: 6, posicion: ['LD', 'EI'] })
  })
})

describe('link de la sala', () => {
  it('vacío es sin link', () => {
    expect(linkDeSala('  ')).toEqual({ link: null })
  })
  it('lo deja siempre igual: con https y www', () => {
    expect(linkDeSala(' haxball.com/play?c=Ab_C-123xyz ')).toEqual({ link: 'https://www.haxball.com/play?c=Ab_C-123xyz' })
    expect(linkDeSala('http://www.HaxBall.com/play?c=abcd1234&p=1')).toEqual({ link: 'https://www.haxball.com/play?c=abcd1234&p=1' })
  })
  it('rechaza lo que no es una sala de HaxBall', () => {
    for (const malo of ['https://haxball.estafa.com/play?c=abc123', 'https://evil.com/?u=haxball.com/play?c=abc123', 'https://www.haxball.com/play', 'javascript:alert(1)', 'https://www.haxball.com/play?c=abc123&x=<script>']) {
      expect(linkDeSala(malo)).toHaveProperty('error')
    }
  })
})

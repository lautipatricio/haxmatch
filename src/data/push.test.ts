// El aviso de prueba, con un navegador y un servidor de mentira: qué le dice la app
// al usuario según hasta dónde llegó el aviso.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const guardarSuscripcion = vi.fn<(endpoint: string, p256dh: string, auth: string) => Promise<string | null>>()
const quitarSuscripcion = vi.fn<(endpoint: string) => Promise<string | null>>()
const rpc = vi.fn<(nombre: string) => Promise<{ data?: unknown; error?: string }>>()

vi.mock('./supabase', () => ({ REAL: true }))
vi.mock('./servidor', () => ({ cola: { guardarSuscripcion, quitarSuscripcion } }))
vi.mock('./transporte', () => ({ rpc }))

const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
const CLAVE = `B${'A'.repeat(86)}`

interface Opciones {
  /** Qué versión contesta la parte de segundo plano (0: una vieja, que no contesta). */
  version?: number
  /** Qué pasa en este dispositivo cuando el servidor manda la prueba. */
  alMandar?: 'llega' | 'llega sin mostrarse' | 'no llega'
  suscripto?: boolean
}

/** Arma el navegador de mentira y devuelve lo que la app hizo con la suscripción. */
function navegador({ version = 2, alMandar = 'llega', suscripto = true }: Opciones = {}) {
  const escuchas = new Set<(e: { data: unknown }) => void>()
  const hechos = { bajas: 0, altas: 0 }
  const nueva = (n: number) => ({
    endpoint: `https://fcm.googleapis.com/fcm/send/dispositivo-${n}`,
    options: { applicationServerKey: null },
    toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) } } },
    unsubscribe: async () => { hechos.bajas++; actual = null; return true },
  })
  let actual: ReturnType<typeof nueva> | null = suscripto ? nueva(1) : null
  const reg = {
    active: {
      postMessage: (m: { tipo?: string }, puertos: MessagePort[]) => {
        if (m.tipo === 'version' && version > 0) puertos[0].postMessage({ version })
      },
    },
    update: async () => {},
    pushManager: {
      getSubscription: async () => actual,
      subscribe: async () => { hechos.altas++; actual = nueva(2); return actual },
    },
  }
  vi.stubGlobal('navigator', {
    userAgent: WINDOWS,
    maxTouchPoints: 0,
    serviceWorker: {
      getRegistration: async () => reg,
      ready: Promise.resolve(reg),
      addEventListener: (_tipo: string, f: (e: { data: unknown }) => void) => escuchas.add(f),
      removeEventListener: (_tipo: string, f: (e: { data: unknown }) => void) => escuchas.delete(f),
    },
  })
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false }), PushManager: {}, Notification: {} })
  vi.stubGlobal('fetch', async () => ({ json: async () => ({ clave: CLAVE }) }))
  rpc.mockImplementation(async (nombre) => {
    if (nombre === 'probar_aviso') {
      if (alMandar !== 'no llega') {
        setTimeout(() => escuchas.forEach((f) => f({ data: { tipo: 'aviso-recibido', tag: 'prueba', mostrado: alMandar === 'llega' } })), 1200)
      }
      return { data: 'enviado' }
    }
    return { data: { estado: 'respondio', codigo: 200, sin_respuesta: false, enviados: 2, resultados: [201, 201] } }
  })
  return { hechos, escuchas }
}

/** Corre la prueba dejando pasar el tiempo. */
async function probar() {
  const { probarAviso } = await import('./push')
  const resultado = probarAviso()
  await vi.advanceTimersByTimeAsync(60_000)
  return resultado
}

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  guardarSuscripcion.mockReset().mockResolvedValue(null)
  quitarSuscripcion.mockReset().mockResolvedValue(null)
  rpc.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('aviso de prueba', () => {
  it('si llega y se muestra, dice que llegó y dónde mirar si no se vio', async () => {
    const { hechos, escuchas } = navegador()
    const r = await probar()
    expect(r.ok).toBe(true)
    expect(r.texto).toContain('llegó a esta computadora')
    expect(r.texto).toContain('Configuración > Sistema > Notificaciones')
    expect(r.texto).toContain('Chrome')
    expect(hechos).toEqual({ bajas: 0, altas: 0 })
    expect(escuchas.size).toBe(0)
  })

  it('antes de probar, anota este dispositivo en el servidor', async () => {
    navegador()
    await probar()
    expect(guardarSuscripcion).toHaveBeenCalledWith('https://fcm.googleapis.com/fcm/send/dispositivo-1', 'p'.repeat(87), 'a'.repeat(22))
    expect(guardarSuscripcion.mock.invocationCallOrder[0]).toBeLessThan(rpc.mock.invocationCallOrder[0])
  })

  it('si el servidor no lo puede anotar, lo dice y no manda nada', async () => {
    navegador()
    guardarSuscripcion.mockResolvedValue('Este navegador no permite activar los avisos')
    const r = await probar()
    expect(r.ok).toBe(false)
    expect(r.texto).toContain('No pudimos anotar esta computadora')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('si llega pero el navegador no deja mostrarlo, explica cómo permitirlo', async () => {
    navegador({ alMandar: 'llega sin mostrarse' })
    const r = await probar()
    expect(r.ok).toBe(false)
    expect(r.texto).toContain('no dejó mostrarlo')
    expect(r.texto).toContain('Permitir')
  })

  it('si no llega, renueva la suscripción; si tampoco llega la segunda vez, da los datos para pedir ayuda', async () => {
    const { hechos } = navegador({ alMandar: 'no llega' })
    const { probarAviso } = await import('./push')
    let pedido = probarAviso()
    await vi.advanceTimersByTimeAsync(60_000)
    const primera = await pedido
    expect(primera.ok).toBe(false)
    expect(primera.texto).toContain('no llegó a esta computadora')
    expect(primera.texto).toContain('Renovamos')
    expect(hechos).toEqual({ bajas: 1, altas: 1 })
    expect(quitarSuscripcion).toHaveBeenCalledWith('https://fcm.googleapis.com/fcm/send/dispositivo-1')
    expect(guardarSuscripcion).toHaveBeenLastCalledWith('https://fcm.googleapis.com/fcm/send/dispositivo-2', 'p'.repeat(87), 'a'.repeat(22))

    pedido = probarAviso()
    await vi.advanceTimersByTimeAsync(60_000)
    const segunda = await pedido
    expect(segunda.ok).toBe(false)
    expect(segunda.texto).toContain('Chrome en Windows · fcm.googleapis.com · respuestas 201, 201')
    // No se renueva dos veces.
    expect(hechos).toEqual({ bajas: 1, altas: 1 })
  })

  it('con la parte de segundo plano vieja no puede saber si llegó: lo dice sin renovar nada', async () => {
    const { hechos } = navegador({ version: 0, alMandar: 'no llega' })
    const r = await probar()
    expect(r.ok).toBe(true)
    expect(r.texto).toContain('salió hacia esta computadora')
    expect(hechos).toEqual({ bajas: 0, altas: 0 })
  })

  it('sin avisos activados en este dispositivo, pide activarlos', async () => {
    navegador({ suscripto: false })
    const r = await probar()
    expect(r.ok).toBe(false)
    expect(r.texto).toContain('no están activados en esta computadora')
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('en qué navegador y sistema está la app', () => {
  it('reconoce los navegadores que se presentan como Chrome', async () => {
    navegador()
    const { dondeEstoy } = await import('./push')
    expect(dondeEstoy(`${WINDOWS} Edg/141.0.0.0`, false)).toEqual({ navegador: 'Edge', sistema: 'Windows' })
    expect(dondeEstoy(`${WINDOWS} OPR/120.0.0.0`, false)).toEqual({ navegador: 'Opera', sistema: 'Windows' })
    expect(dondeEstoy(WINDOWS, true)).toEqual({ navegador: 'Brave', sistema: 'Windows' })
    expect(dondeEstoy('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15', false)).toEqual({ navegador: 'Safari', sistema: 'Mac' })
    expect(dondeEstoy('Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0', false)).toEqual({ navegador: 'Firefox', sistema: 'Linux' })
    expect(dondeEstoy('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36', false)).toEqual({ navegador: 'Chrome', sistema: 'Android' })
  })
})

// Avisos con la app cerrada (notificaciones del sistema). Cada celular o computadora
// los activa por separado: el navegador le da a la app una "suscripción" y la app
// la guarda en el servidor para que le puedan mandar avisos a ese dispositivo.
import { cola } from './servidor'
import { REAL } from './supabase'
import { rpc } from './transporte'

export type EstadoAvisos =
  /** Este navegador no tiene notificaciones. */
  | 'no-disponible'
  /** iPhone o iPad: hay que agregar la app a la pantalla de inicio primero. */
  | 'falta-instalar'
  /** El usuario los bloqueó en el celular: se reactivan desde los ajustes. */
  | 'bloqueados'
  /** Todavía no se cargaron las claves en el servidor. */
  | 'sin-configurar'
  | 'apagados'
  | 'activos'

// Los iPad nuevos se presentan como Mac: se los reconoce por la pantalla táctil.
const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
const instalada = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

/** ¿Es una computadora? Los avisos funcionan igual, pero los textos y los arreglos son otros. */
export const ES_COMPU = typeof navigator !== 'undefined' && !esIOS() && !/android|mobile/i.test(navigator.userAgent)
/** "esta computadora" o "este celular", para los textos. */
export const ACA = ES_COMPU ? 'esta computadora' : 'este celular'

async function registro(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    // Si la app todavía no llegó a instalar su parte de segundo plano (recién abierta), se instala acá.
    if (!(await navigator.serviceWorker.getRegistration())) {
      if (!import.meta.env.PROD) return null
      await navigator.serviceWorker.register('/sw.js')
    }
  } catch {
    return null
  }
  // Recién instalado puede no estar activo todavía: se lo espera un momento.
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((listo) => setTimeout(() => listo(null), 5000)),
  ])
}

/** ¿La suscripción de este celular se hizo con la clave que tiene hoy el servidor? */
function mismaClave(sub: PushSubscription, clave: string): boolean {
  const usada = sub.options.applicationServerKey
  if (!usada) return true
  const a = new Uint8Array(usada)
  const b = bytes(clave)
  return a.length === b.length && a.every((v, i) => v === b[i])
}

/** Suscribe este celular. Si tenía una suscripción hecha con otra clave (se cambiaron las del servidor), la rehace. */
async function suscribir(reg: ServiceWorkerRegistration, clave: string): Promise<PushSubscription> {
  const actual = await reg.pushManager.getSubscription()
  if (actual && mismaClave(actual, clave)) return actual
  if (actual) await actual.unsubscribe()
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(clave).buffer as ArrayBuffer })
}

let claveGuardada: string | null | undefined

/** Clave pública con la que el celular se suscribe. null si el servidor todavía no la tiene. */
async function clavePublica(): Promise<string | null> {
  if (claveGuardada) return claveGuardada
  try {
    const r = await fetch('/api/push/clave', { cache: 'no-store' })
    const d = await r.json() as { clave?: string | null }
    claveGuardada = typeof d.clave === 'string' && d.clave.length > 60 ? d.clave : null
  } catch {
    claveGuardada = null
  }
  return claveGuardada
}

function bytes(base64url: string): Uint8Array {
  const b64 = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=')
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

async function guardar(sub: PushSubscription): Promise<string | null> {
  const d = sub.toJSON()
  if (!d.endpoint || !d.keys?.p256dh || !d.keys.auth) return 'Este navegador no permite activar los avisos.'
  return cola.guardarSuscripcion(d.endpoint, d.keys.p256dh, d.keys.auth)
}

export async function estadoAvisos(): Promise<EstadoAvisos> {
  if (!REAL) return 'no-disponible'
  if (esIOS() && !instalada()) return 'falta-instalar'
  if (!('PushManager' in window) || !('Notification' in window)) return 'no-disponible'
  const reg = await registro()
  if (!reg) return 'no-disponible'
  if (Notification.permission === 'denied') return 'bloqueados'
  if (!(await clavePublica())) return 'sin-configurar'
  const sub = Notification.permission === 'granted' ? await reg.pushManager.getSubscription() : null
  return sub ? 'activos' : 'apagados'
}

export const TEXTO_AVISOS: Record<EstadoAvisos, string> = {
  'no-disponible': ES_COMPU
    ? 'Este navegador no permite recibir avisos. En una ventana privada o de incógnito no funcionan: probá en una ventana común de Chrome, Edge o Firefox.'
    : 'Este navegador no permite recibir avisos.',
  'falta-instalar': 'En iPhone, primero agregá HaxMatch a la pantalla de inicio (Compartir > Agregar a inicio) y abrila desde ahí.',
  bloqueados: ES_COMPU
    ? 'Los avisos de HaxMatch están bloqueados en este navegador. Tocá el ícono que está a la izquierda de la dirección de la página, buscá "Notificaciones", elegí "Permitir" y recargá la página.'
    : 'Los avisos están bloqueados en este celular. Activalos desde los ajustes del navegador o del sistema.',
  'sin-configurar': 'Los avisos todavía no están habilitados en HaxMatch.',
  apagados: ES_COMPU
    ? 'Te avisamos como un mensaje más de la computadora, aunque estés en otra ventana: cuando te invitan o te escriben, cuando entrás a una sala y cuando un amigo se pone a buscar.'
    : 'Te avisamos aunque tengas la app cerrada: cuando te invitan o te escriben, cuando entrás a una sala y cuando un amigo se pone a buscar.',
  activos: `Activados en ${ACA}.`,
}

export const SIN_PERMISO = 'No diste permiso para los avisos. Podés activarlos después desde tu Perfil.'

/** Problemas que el usuario puede resolver por su cuenta (vale la pena avisarle). */
export const tieneArreglo = (problema: string | null) =>
  problema === SIN_PERMISO || problema === TEXTO_AVISOS.bloqueados || problema === TEXTO_AVISOS['falta-instalar']

/**
 * Activa los avisos en este celular. Hay que llamarla desde un toque del usuario,
 * y el permiso se pide antes que nada: algunos celulares no lo muestran si pasa un rato.
 * Devuelve el problema, o null si quedaron activos.
 */
export async function activarAvisos(): Promise<string | null> {
  if (!REAL) return TEXTO_AVISOS['no-disponible']
  if (esIOS() && !instalada()) return TEXTO_AVISOS['falta-instalar']
  if (!('PushManager' in window) || !('Notification' in window) || !('serviceWorker' in navigator)) return TEXTO_AVISOS['no-disponible']
  // Si ya se sabe que el servidor no tiene las claves, no se molesta pidiendo permiso.
  if (claveGuardada === null) return TEXTO_AVISOS['sin-configurar']
  try {
    // Si ya los había bloqueado, el celular no vuelve a preguntar: se cambia desde los ajustes.
    if (Notification.permission === 'denied') return TEXTO_AVISOS.bloqueados
    const permiso = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission
    if (permiso !== 'granted') return SIN_PERMISO
    const reg = await registro()
    const clave = await clavePublica()
    if (!reg) return TEXTO_AVISOS['no-disponible']
    if (!clave) return TEXTO_AVISOS['sin-configurar']
    return await guardar(await suscribir(reg, clave))
  } catch {
    // Brave trae apagado el servicio que usan los avisos: hay que prenderlo a mano.
    if ((navigator as { brave?: unknown }).brave) {
      return 'Brave trae los avisos apagados. Abrí brave://settings/privacy, activá "Usar los servicios de Google para la mensajería push", reiniciá Brave y probá de nuevo.'
    }
    return ES_COMPU
      ? 'Este navegador no pudo activar los avisos. Probá de nuevo; si sigue igual, usá Chrome, Edge o Firefox en una ventana común (no privada).'
      : 'No pudimos activar los avisos en este celular. Probá de nuevo.'
  }
}

interface ResultadoPrueba {
  estado: 'sin prueba' | 'esperando' | 'respondio' | 'desconocido'
  codigo?: number | null
  sin_respuesta?: boolean
  enviados?: number | null
  /** Qué contestó el servicio de avisos de cada dispositivo de la cuenta. */
  resultados?: number[] | null
}

const pausa = (ms: number) => new Promise<void>((listo) => setTimeout(listo, ms))

/** Versión de public/sw.js desde la que avisa cuando le llega el aviso de prueba. */
const VERSION_SW = 2

function versionSW(reg: ServiceWorkerRegistration): Promise<number> {
  const sw = reg.active
  if (!sw) return Promise.resolve(0)
  return new Promise((listo) => {
    const canal = new MessageChannel()
    const corte = setTimeout(() => listo(0), 2000)
    canal.port1.onmessage = (e: MessageEvent) => {
      clearTimeout(corte)
      listo(Number((e.data as { version?: unknown } | null)?.version) || 0)
    }
    sw.postMessage({ tipo: 'version' }, [canal.port2])
  })
}

/** ¿La parte de segundo plano ya es la que avisa cuando llega la prueba? Si quedó una vieja, se la actualiza. */
async function alDia(reg: ServiceWorkerRegistration): Promise<boolean> {
  try {
    if ((await versionSW(reg)) >= VERSION_SW) return true
    await reg.update()
    for (let i = 0; i < 8; i++) {
      await pausa(500)
      if ((await versionSW(reg)) >= VERSION_SW) return true
    }
  } catch {
    // Sin eso la prueba se hace igual, solo que no puede decir si llegó.
  }
  return false
}

/** Escucha si el aviso de prueba llega a este dispositivo. */
function escucharPrueba() {
  let mostrado: boolean | null = null
  let avisar: (() => void) | null = null
  const alLlegar = (e: MessageEvent) => {
    const d = e.data as { tipo?: string; mostrado?: boolean } | null
    if (d?.tipo !== 'aviso-recibido') return
    mostrado = d.mostrado !== false
    avisar?.()
  }
  navigator.serviceWorker.addEventListener('message', alLlegar)
  return {
    /** Espera hasta `ms`. Devuelve si el navegador lo pudo mostrar, o null si todavía no llegó. */
    esperar: async (ms: number): Promise<boolean | null> => {
      if (mostrado === null) await Promise.race([new Promise<void>((listo) => { avisar = listo }), pausa(ms)])
      return mostrado
    },
    soltar: () => navigator.serviceWorker.removeEventListener('message', alLlegar),
  }
}

type Sistema = 'Windows' | 'Mac' | 'Linux' | 'Android' | 'iPhone'

/** En qué navegador y en qué sistema está abierta la app. */
export function dondeEstoy(agente = navigator.userAgent, brave = !!(navigator as { brave?: unknown }).brave): { navegador: string; sistema: Sistema | null } {
  const navegador = brave ? 'Brave'
    : /edg\//i.test(agente) ? 'Edge'
    : /opr\//i.test(agente) ? 'Opera'
    : /firefox\//i.test(agente) ? 'Firefox'
    : /chrome\//i.test(agente) ? 'Chrome'
    : /safari\//i.test(agente) ? 'Safari'
    : 'el navegador'
  const sistema = esIOS() || /iphone|ipad|ipod/i.test(agente) ? 'iPhone'
    : /android/i.test(agente) ? 'Android'
    : /windows/i.test(agente) ? 'Windows'
    : /mac os x|macintosh/i.test(agente) ? 'Mac'
    : /linux|cros/i.test(agente) ? 'Linux'
    : null
  return { navegador, sistema }
}

/** Dónde se prenden las notificaciones del navegador en cada sistema. */
export function ayudaSistema(navegador: string, sistema: Sistema | null): string {
  if (sistema === 'Windows') {
    return `Abrí Configuración > Sistema > Notificaciones y revisá tres cosas: que las notificaciones estén prendidas, que "No molestar" esté apagado y que ${navegador} esté prendido en la lista de aplicaciones. Windows prende "No molestar" por su cuenta cuando hay un juego o un video a pantalla completa.`
  }
  if (sistema === 'Mac') {
    return `Abrí Ajustes del Sistema > Notificaciones, entrá en ${navegador} y prendé "Permitir notificaciones". Revisá también que no tengas activado un modo de Concentración.`
  }
  if (sistema === 'iPhone') return 'Abrí Ajustes > Notificaciones > HaxMatch y revisá que estén permitidas y que no tengas activado un modo de Concentración.'
  if (sistema === 'Android') return `Abrí los ajustes del celular > Notificaciones y revisá que ${navegador} (o HaxMatch, si la instalaste) las tenga permitidas y que "No molestar" esté apagado.`
  return `Revisá en los ajustes del sistema que las notificaciones de ${navegador} estén permitidas y que "No molestar" esté apagado.`
}

/** Vuelve a suscribir este dispositivo desde cero. Devuelve el problema, o null si quedó. */
async function renovar(reg: ServiceWorkerRegistration, sub: PushSubscription): Promise<string | null> {
  try {
    const clave = await clavePublica()
    if (!clave) return TEXTO_AVISOS['sin-configurar']
    await cola.quitarSuscripcion(sub.endpoint)
    await sub.unsubscribe()
    return await guardar(await suscribir(reg, clave))
  } catch {
    return 'Desactivá los avisos, volvé a activarlos y probá de nuevo.'
  }
}

/** En cada visita, la primera vez que la prueba no llega se renueva la suscripción; la segunda, se dan los datos para pedir ayuda. */
let renovada = false

async function noLlego(reg: ServiceWorkerRegistration, sub: PushSubscription, resultados: number[] | null | undefined): Promise<{ ok: boolean; texto: string }> {
  const salio = `El aviso salió, pero no llegó a ${ACA}.`
  if (!renovada) {
    renovada = true
    const error = await renovar(reg, sub)
    return { ok: false, texto: error
      ? `${salio} Quisimos renovar la conexión de los avisos y no se pudo. ${error}`
      : `${salio} Renovamos la conexión de los avisos: esperá unos segundos y tocá de nuevo "Mandar un aviso de prueba".` }
  }
  const { navegador, sistema } = dondeEstoy()
  let servicio = '?'
  try {
    servicio = new URL(sub.endpoint).host
  } catch {
    // Queda el signo de pregunta.
  }
  const codigos = Array.isArray(resultados) && resultados.length > 0 ? resultados.join(', ') : 'sin datos'
  return { ok: false, texto: `${salio} ${ES_COMPU ? 'Cerrá el navegador del todo, abrilo de nuevo' : 'Cerrá la app del todo, abrila de nuevo'} y probá otra vez. Una VPN, un antivirus con firewall o la red de un trabajo o de una escuela pueden cortar los avisos. Si sigue igual, copiá este dato para pedir ayuda: ${navegador}${sistema ? ` en ${sistema}` : ''} · ${servicio} · respuestas ${codigos}.` }
}

/**
 * Pide un aviso de prueba y espera a saber cómo salió: si la base pudo mandarlo,
 * si llegó a este dispositivo y si el navegador lo pudo mostrar.
 */
export async function probarAviso(): Promise<{ ok: boolean; texto: string }> {
  const { navegador, sistema } = dondeEstoy()
  // Este dispositivo tiene que estar anotado en el servidor: si no, la prueba sale solo hacia los otros.
  const reg = await registro()
  const sub = reg ? await reg.pushManager.getSubscription().catch(() => null) : null
  if (!reg || !sub) return { ok: false, texto: `Los avisos no están activados en ${ACA}. Activalos y probá de nuevo.` }
  const sinAnotar = await guardar(sub)
  if (sinAnotar) return { ok: false, texto: `No pudimos anotar ${ACA} para recibir avisos. ${sinAnotar}` }
  const sabeSiLlega = await alDia(reg)
  const oido = escucharPrueba()
  const llego = (mostrado: boolean) => mostrado
    ? { ok: true, texto: `El aviso llegó a ${ACA} y el navegador lo mostró. ¿No viste el cartel? Entonces lo está ocultando ${sistema === 'Mac' ? 'la Mac' : sistema === 'Windows' ? 'Windows' : ES_COMPU ? 'el sistema' : 'el celular'}. ${ayudaSistema(navegador, sistema)}` }
    : { ok: false, texto: `El aviso llegó a ${ACA}, pero el navegador no dejó mostrarlo. ${TEXTO_AVISOS.bloqueados}` }
  try {
    const pedido = await rpc<string>('probar_aviso')
    if (pedido.error) return { ok: false, texto: pedido.error }
    for (const espera of [2500, 3000, 4000]) {
      const mostrado = await oido.esperar(espera)
      if (mostrado !== null) return llego(mostrado)
      const r = (await rpc<ResultadoPrueba>('resultado_prueba')).data
      if (!r || r.estado === 'esperando') continue
      if (r.estado !== 'respondio') break
      if (r.sin_respuesta) return { ok: false, texto: 'La base de datos no pudo comunicarse con la web de HaxMatch. Probá de nuevo en un rato.' }
      if (r.codigo === 200 && (r.enviados ?? 0) > 0) {
        if (!sabeSiLlega) return { ok: true, texto: `Listo: el aviso salió hacia ${ACA}. Tendría que aparecer en unos segundos. Si no aparece: ${ayudaSistema(navegador, sistema)}` }
        // Ya salió: desde acá, lo normal es que llegue en un par de segundos.
        const alFinal = await oido.esperar(8000)
        return alFinal !== null ? llego(alFinal) : await noLlego(reg, sub, r.resultados)
      }
      if (r.codigo === 200) return { ok: false, texto: `El servicio de avisos de ${ACA} lo rechazó. Desactivá los avisos, volvé a activarlos y probá de nuevo.` }
      if (r.codigo === 401) return { ok: false, texto: 'La clave de los avisos no coincide entre Supabase y Cloudflare. Hay que repetir la configuración.' }
      if (r.codigo === 503) return { ok: false, texto: 'Faltan cargar las claves de los avisos en Cloudflare.' }
      return { ok: false, texto: `La web de HaxMatch no aceptó el pedido (código ${r.codigo ?? '?'}). Revisá la dirección configurada en Supabase.` }
    }
    const tarde = await oido.esperar(0)
    if (tarde !== null) return llego(tarde)
    return { ok: true, texto: 'Pedido enviado. Si en un minuto no aparece nada, probá de nuevo.' }
  } finally {
    oido.soltar()
  }
}

export async function desactivarAvisos(): Promise<string | null> {
  try {
    const sub = await (await registro())?.pushManager.getSubscription()
    if (!sub) return null
    const error = await cola.quitarSuscripcion(sub.endpoint)
    await sub.unsubscribe()
    return error
  } catch {
    return 'No pudimos desactivar los avisos. Probá de nuevo.'
  }
}

/**
 * Al abrir la app: si este celular ya tenía los avisos activos, se vuelve a anotar
 * a nombre de la cuenta que está abierta ahora.
 */
export async function sincronizarAvisos(): Promise<void> {
  try {
    if (!REAL) return
    const clave = await clavePublica()
    if (!clave || !('Notification' in window) || Notification.permission !== 'granted') return
    const reg = await registro()
    // Solo si este celular ya los tenía activos: acá no se activa nada por su cuenta.
    if (reg && (await reg.pushManager.getSubscription())) await guardar(await suscribir(reg, clave))
  } catch {
    // Sin avisos la app funciona igual.
  }
}

/** Al cerrar sesión: este celular deja de recibir los avisos de esa cuenta. */
export async function soltarAvisos(): Promise<void> {
  try {
    const sub = await (await registro())?.pushManager.getSubscription()
    if (sub) await cola.quitarSuscripcion(sub.endpoint)
  } catch {
    // Si no se puede avisar al servidor, la suscripción se pisa cuando entre otra cuenta.
  }
}

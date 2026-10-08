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
}

const pausa = (ms: number) => new Promise((listo) => setTimeout(listo, ms))

/**
 * Pide un aviso de prueba y espera a saber cómo salió.
 * Devuelve si salió hacia el celular y el texto para mostrar.
 */
export async function probarAviso(): Promise<{ ok: boolean; texto: string }> {
  const pedido = await rpc<string>('probar_aviso')
  if (pedido.error) return { ok: false, texto: pedido.error }
  for (const espera of [2500, 3000, 4000]) {
    await pausa(espera)
    const r = (await rpc<ResultadoPrueba>('resultado_prueba')).data
    if (!r || r.estado === 'esperando') continue
    if (r.estado !== 'respondio') break
    if (r.sin_respuesta) return { ok: false, texto: 'La base de datos no pudo comunicarse con la web de HaxMatch. Probá de nuevo en un rato.' }
    if (r.codigo === 200 && (r.enviados ?? 0) > 0) return { ok: true, texto: ES_COMPU
      ? 'Listo: el aviso salió hacia esta computadora. Tendría que aparecer en unos segundos. Si no aparece, revisá que las notificaciones del navegador estén permitidas en el sistema y que no tengas activado "No molestar".'
      : 'Listo: el aviso salió hacia tu celular. Tendría que aparecer en unos segundos.' }
    if (r.codigo === 200) return { ok: false, texto: `El servicio de avisos de ${ACA} lo rechazó. Desactivá los avisos, volvé a activarlos y probá de nuevo.` }
    if (r.codigo === 401) return { ok: false, texto: 'La clave de los avisos no coincide entre Supabase y Cloudflare. Hay que repetir la configuración.' }
    if (r.codigo === 503) return { ok: false, texto: 'Faltan cargar las claves de los avisos en Cloudflare.' }
    return { ok: false, texto: `La web de HaxMatch no aceptó el pedido (código ${r.codigo ?? '?'}). Revisá la dirección configurada en Supabase.` }
  }
  return { ok: true, texto: 'Pedido enviado. Si en un minuto no te llega nada, avisame.' }
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

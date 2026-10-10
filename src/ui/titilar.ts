// Cuando pasa algo que no puede esperar (te invitan, se armó el partido) y la persona
// está en otra pestaña o en otra ventana, la pestaña de HaxMatch titila: el título y
// el ícono se alternan hasta que vuelve a mirarla. No pide ningún permiso.
import { useStore } from '../data/store'

const TITULO = 'HaxMatch'

// El ícono de siempre, con los colores dados vuelta: se nota en la fila de pestañas.
const ICONO_ALERTA = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
  + '<rect width="512" height="512" rx="96" fill="#3B82F6"/>'
  + '<circle cx="256" cy="256" r="150" fill="none" stroke="#090D14" stroke-width="22"/>'
  + '<circle cx="256" cy="256" r="70" fill="#090D14"/>'
  + '</svg>',
)}`

interface Titileo {
  reloj: ReturnType<typeof setInterval>
  mensajeId?: string
  iconoNormal: string | null
}

let actual: Titileo | null = null

const enlaceIcono = () => document.querySelector<HTMLLinkElement>('link[rel="icon"]')

type ConInsignia = Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> }

/** Deja el título y el ícono como estaban. */
export function dejarDeTitilar() {
  if (!actual) return
  clearInterval(actual.reloj)
  const enlace = enlaceIcono()
  if (enlace && actual.iconoNormal) enlace.href = actual.iconoNormal
  document.title = TITULO
  void (navigator as ConInsignia).clearAppBadge?.().catch(() => {})
  actual = null
}

/** Empieza a titilar con ese texto, salvo que la persona ya esté mirando la app. */
export function titilar(texto: string, mensajeId?: string) {
  if (document.hasFocus()) return
  const iconoNormal = actual ? actual.iconoNormal : enlaceIcono()?.getAttribute('href') ?? null
  if (actual) clearInterval(actual.reloj)
  let prendido = false
  const cambiar = () => {
    prendido = !prendido
    // Los dos estados llaman la atención: si el navegador frena los relojes de una
    // pestaña que lleva rato tapada, queda quieta pero distinta de lo normal.
    document.title = `${prendido ? '🔵' : '⚪'} ${texto}`
    const enlace = enlaceIcono()
    if (enlace && iconoNormal) enlace.href = prendido ? ICONO_ALERTA : iconoNormal
  }
  cambiar()
  actual = { reloj: setInterval(cambiar, 1000), mensajeId, iconoNormal }
  // Con la app instalada, además aparece un punto sobre su ícono en la barra de tareas.
  void (navigator as ConInsignia).setAppBadge?.().catch(() => {})
}

/** Conecta el titileo con lo que pasa en la app. Se llama una sola vez, al abrirla. */
export function vigilarLlamadas() {
  const alVolver = () => { if (document.hasFocus()) dejarDeTitilar() }
  window.addEventListener('focus', alVolver)
  document.addEventListener('visibilitychange', alVolver)
  useStore.subscribe((s, antes) => {
    if (s.llamada && s.llamada.id !== antes.llamada?.id) titilar(s.llamada.texto, s.llamada.mensajeId)
    // La invitación se cayó (la retiraron o la sala se llenó): ya no hay por qué llamar.
    const id = actual?.mensajeId
    if (id && !s.mensajes.some((m) => m.id === id && m.estado === 'pendiente')) dejarDeTitilar()
  })
}

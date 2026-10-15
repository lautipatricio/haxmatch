// Instalar HaxMatch como app (en la compu o en Android).
// El navegador avisa una sola vez, apenas carga la página, que se puede instalar ("beforeinstallprompt").
// Por eso se escucha acá, desde el arranque, y se guarda ese aviso para usarlo cuando la persona toque "Instalar".
import { useSyncExternalStore } from 'react'

type AvisoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

export type EstadoInstalar = {
  /** El navegador ya dejó todo listo: el botón "Instalar" abre su ventanita. */
  puede: boolean
  /** Se está abriendo como app instalada (o se acaba de instalar). */
  instalada: boolean
  /** Se instaló recién, en esta visita. */
  recien: boolean
}

function abiertaComoApp(): boolean {
  if (typeof window === 'undefined') return false
  return ['standalone', 'window-controls-overlay'].some((modo) => window.matchMedia?.(`(display-mode: ${modo})`).matches)
    || (navigator as { standalone?: boolean }).standalone === true
}

let aviso: AvisoInstalar | null = null
let estado: EstadoInstalar = { puede: false, instalada: abiertaComoApp(), recien: false }
const oyentes = new Set<() => void>()
function cambiar(nuevo: Partial<EstadoInstalar>) {
  estado = { ...estado, ...nuevo }
  oyentes.forEach((f) => f())
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    aviso = e as AvisoInstalar
    cambiar({ puede: true })
  })
  window.addEventListener('appinstalled', () => {
    aviso = null
    cambiar({ puede: false, instalada: true, recien: true })
  })
}

/** Abre la ventanita del navegador para instalar. Devuelve true si la persona aceptó. */
export async function instalarApp(): Promise<boolean> {
  const a = aviso
  if (!a) return false
  aviso = null
  cambiar({ puede: false })
  try {
    await a.prompt()
    const { outcome } = await a.userChoice
    if (outcome === 'accepted') { cambiar({ instalada: true, recien: true }); return true }
  } catch { /* el navegador no dejó: quedan las instrucciones */ }
  return false
}

export function useInstalar(): EstadoInstalar {
  return useSyncExternalStore(
    (f) => { oyentes.add(f); return () => { oyentes.delete(f) } },
    () => estado,
    () => estado,
  )
}

export type Navegador = 'chrome' | 'edge' | 'safari' | 'firefox' | 'brave' | 'opera' | 'otro'

/** Qué navegador es, para explicar dónde está la opción de instalar. */
export function cualNavegador(ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): Navegador {
  if (/Edg\//.test(ua)) return 'edge'
  if (/OPR\/|Opera/.test(ua)) return 'opera'
  if (typeof navigator !== 'undefined' && (navigator as { brave?: unknown }).brave) return 'brave'
  if (/Firefox\//.test(ua)) return 'firefox'
  if (/Chrome\//.test(ua)) return 'chrome'
  if (/Safari\//.test(ua)) return 'safari'
  return 'otro'
}

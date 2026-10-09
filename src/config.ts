import { ENSAYO, REAL } from './data/supabase'

export { REAL }

/** La app de verdad (no la demostración ni el ensayo con base de prueba). */
const REAL_PUBLICADA = REAL && !ENSAYO

/** Build de demostración (vista previa publicada): sin service worker ni instalación. */
export const PREVIEW = import.meta.env.MODE === 'preview'

/** Dirección pública de la app, para armar el link de referido. */
export const APP_URL: string =
  (import.meta.env.VITE_APP_URL as string | undefined) ?? (PREVIEW ? '' : window.location.origin)

/** Motivo por el que Discord o el servidor devolvieron al usuario sin iniciar la sesión. */
export const ERROR_DE_INGRESO: string = (() => {
  try {
    const q = new URLSearchParams(window.location.search)
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    return q.get('error_description') ?? h.get('error_description') ?? q.get('error') ?? h.get('error') ?? ''
  } catch {
    return ''
  }
})()

/** Código de referido que vino en el link (?ref=CODIGO). */
export const REF_INICIAL: string = (() => {
  try {
    return new URLSearchParams(window.location.search).get('ref')?.toUpperCase() ?? ''
  } catch {
    return ''
  }
})()

/**
 * Link para apoyar a HaxMatch con una colaboración (Cafecito, Ko-fi…). Vacío: el botón no aparece.
 * Para activarlo, poné acá el link completo, por ejemplo 'https://cafecito.app/haxmatch'.
 */
export const APOYO_URL: string = ''

/**
 * Vincular TikTok todavía no está abierto para todos (TikTok tiene que aprobar la app).
 * Mientras tanto, en la app publicada el botón dice "Pronto". Cuando TikTok la apruebe,
 * poné esto en true.
 */
export const TIKTOK_ABIERTO: boolean = false
export const TIKTOK_PRONTO: boolean = REAL_PUBLICADA && !TIKTOK_ABIERTO

export { REAL } from './data/supabase'

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

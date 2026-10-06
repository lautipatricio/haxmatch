/** Build de demostración (vista previa publicada): sin service worker ni instalación. */
export const PREVIEW = import.meta.env.MODE === 'preview'

/** Dirección pública de la app, para armar el link de referido. */
export const APP_URL: string =
  (import.meta.env.VITE_APP_URL as string | undefined) ?? (PREVIEW ? '' : window.location.origin)

/** Código de referido que vino en el link (?ref=CODIGO). */
export const REF_INICIAL: string = (() => {
  try {
    return new URLSearchParams(window.location.search).get('ref')?.toUpperCase() ?? ''
  } catch {
    return ''
  }
})()

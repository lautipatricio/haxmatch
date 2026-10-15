// El idioma en que se está mostrando la app ahora (lo usa, por ejemplo, el nombre de los países).
import type { Idioma } from './idioma'

let actual: Idioma = 'es'
export const idiomaActual = (): Idioma => actual
export const ponerIdiomaActual = (i: Idioma) => { actual = i }
/** Para fechas y horas: el formato del idioma de la app. */
export const localeActual = (): string => ({ es: 'es-AR', pt: 'pt-BR', en: 'en-US' })[actual]

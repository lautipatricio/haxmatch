// En qué idioma se muestra la app: español, portugués o inglés.
// - Si el jugador lo eligió en su Perfil, ese.
// - Si no: por su país (Brasil, Portugal... → portugués; países de habla hispana → español).
// - Si su país no habla ninguno de los dos, el idioma del navegador; si no es español ni
//   portugués, inglés.
import { codigoPais } from '../domain/paises'

export type Idioma = 'es' | 'pt' | 'en'
export type EleccionIdioma = Idioma | 'auto'
export const IDIOMAS: Array<{ codigo: Idioma; nombre: string }> = [
  { codigo: 'es', nombre: 'Español' }, { codigo: 'pt', nombre: 'Português' }, { codigo: 'en', nombre: 'English' },
]

const HISPANOS = ['AR', 'BO', 'CL', 'CO', 'CR', 'CU', 'DO', 'EC', 'ES', 'GQ', 'GT', 'HN', 'MX', 'NI', 'PA', 'PE', 'PR', 'PY', 'SV', 'UY', 'VE']
const LUSOFONOS = ['BR', 'PT', 'AO', 'MZ', 'CV', 'GW', 'ST', 'TL']
const CLAVE = 'haxmatch-idioma'

export function leerEleccion(): EleccionIdioma {
  try {
    const v = window.localStorage.getItem(CLAVE)
    return v === 'es' || v === 'pt' || v === 'en' ? v : 'auto'
  } catch { return 'auto' }
}
export function guardarEleccion(v: EleccionIdioma) {
  try { if (v === 'auto') window.localStorage.removeItem(CLAVE); else window.localStorage.setItem(CLAVE, v) } catch { /* sin almacenamiento: vale mientras la app está abierta */ }
}

/** El primero de los idiomas del navegador que la app tiene; si ninguno, inglés. */
export function idiomaNavegador(): Idioma {
  const lista = typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const l of lista) {
    const c = (l ?? '').slice(0, 2).toLowerCase()
    if (c === 'es' || c === 'pt' || c === 'en') return c
  }
  return 'en'
}

/** El idioma que corresponde, según lo elegido, el país del jugador y el navegador. */
export function idiomaPara(eleccion: EleccionIdioma, pais: string | null | undefined): Idioma {
  if (eleccion !== 'auto') return eleccion
  const c = codigoPais(pais)
  if (c && LUSOFONOS.includes(c)) return 'pt'
  if (c && HISPANOS.includes(c)) return 'es'
  return idiomaNavegador()
}

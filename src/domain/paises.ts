// Países: el de cada jugador se guarda con su código de dos letras (AR, CL, BR, UY, MX, ES...).
// El nombre se arma en el idioma de la app con lo que ya trae el navegador (Intl.DisplayNames).

/** Todos los países y territorios con código propio (ISO 3166-1). */
export const PAISES = [
  'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ',
  'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS', 'BT', 'BV', 'BW', 'BY', 'BZ',
  'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN', 'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ',
  'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE', 'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR',
  'GA', 'GB', 'GD', 'GE', 'GF', 'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY',
  'HK', 'HM', 'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM', 'JO', 'JP',
  'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC', 'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY',
  'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK', 'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ',
  'NA', 'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG', 'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY',
  'QA', 'RE', 'RO', 'RS', 'RU', 'RW', 'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS', 'ST', 'SV', 'SX', 'SY', 'SZ',
  'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'UM', 'US', 'UY', 'UZ',
  'VA', 'VC', 'VE', 'VG', 'VI', 'VN', 'VU', 'WF', 'WS', 'XK', 'YE', 'YT', 'ZA', 'ZM', 'ZW',
] as const

/** Las regiones de antes (ARG, CHI, BR, UY) y cualquier código, como país de dos letras. */
export function codigoPais(r: string | undefined | null): string | null {
  const v = (r ?? '').trim().toUpperCase()
  const viejo: Record<string, string> = { ARG: 'AR', CHI: 'CL', BR: 'BR', UY: 'UY' }
  if (viejo[v]) return viejo[v]
  return /^[A-Z]{2}$/.test(v) ? v : null
}

const nombres = new Map<string, Intl.DisplayNames | null>()
function nombrador(idioma: string): Intl.DisplayNames | null {
  if (!nombres.has(idioma)) {
    try { nombres.set(idioma, new Intl.DisplayNames([idioma], { type: 'region' })) } catch { nombres.set(idioma, null) }
  }
  return nombres.get(idioma) ?? null
}

/** Nombre del país en el idioma pedido ("AR" → "Argentina"). Si no se puede, el código. */
export function nombrePais(r: string | undefined | null, idioma = 'es'): string {
  const c = codigoPais(r)
  if (!c) return r ?? ''
  try { return nombrador(idioma)?.of(c) ?? c } catch { return c }
}

/** Todos los países, ordenados por nombre en ese idioma. */
export function listaPaises(idioma = 'es'): Array<{ codigo: string; nombre: string }> {
  const orden = new Intl.Collator(idioma)
  return PAISES.map((codigo) => ({ codigo, nombre: nombrePais(codigo, idioma) })).sort((a, b) => orden.compare(a.nombre, b.nombre))
}

/** El país que dice el navegador (es-AR → AR), si dice alguno. */
export function paisDelNavegador(): string | null {
  const idiomas = typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const l of idiomas) {
    const m = /^[a-z]{2,3}[-_]([A-Za-z]{2})\b/.exec(l ?? '')
    if (m && (PAISES as readonly string[]).includes(m[1].toUpperCase())) return m[1].toUpperCase()
  }
  return null
}

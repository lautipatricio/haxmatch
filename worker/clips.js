// Links cortos de TikTok (vm.tiktok.com/..., tiktok.com/t/...): son los que da el botón
// "Compartir" del celular. No dicen qué video es: hay que abrirlos y ver a dónde llevan.
// Solo se siguen links de TikTok, y solo se devuelve un link de video de TikTok.

const CORTO = /^https:\/\/(?:(?:vm|vt)\.tiktok\.com\/[A-Za-z0-9]{5,20}|(?:www\.|m\.)?tiktok\.com\/t\/[A-Za-z0-9]{5,20})\/?(?:[?#].*)?$/i
const VIDEO = /^https:\/\/(?:www\.|m\.)?tiktok\.com\/@([A-Za-z0-9._]{1,40})\/video\/([0-9]{5,25})(?:[/?#].*)?$/i
const DE_TIKTOK = /^https:\/\/(?:[a-z0-9-]+\.)*tiktok\.com\//i

const json = (cuerpo, estado = 200) => new Response(JSON.stringify(cuerpo), {
  status: estado, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
})

/** Sigue las redirecciones de un link corto, sin bajar el video. Devuelve el link completo o null. */
export async function abrirCorto(url, traer = fetch) {
  if (typeof url !== 'string' || !CORTO.test(url)) return null
  let actual = url
  for (let i = 0; i < 4; i++) {
    const r = await traer(actual, {
      method: 'GET', redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36' },
    })
    const destino = r.headers.get('location')
    if (!destino) return null
    actual = new URL(destino, actual).toString()
    const m = VIDEO.exec(actual)
    if (m) return `https://www.tiktok.com/@${m[1]}/video/${m[2]}`
    if (!DE_TIKTOK.test(actual)) return null
  }
  return null
}

/**
 * Quién pide: solo alguien con sesión de HaxMatch puede hacer que el servidor abra links.
 * Sin esto, cualquiera podía usar /api/clips/abrir para mandar pedidos a TikTok desde nuestro servidor.
 */
export async function hayUsuario(request, env, traer = fetch) {
  const sesion = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!sesion || !env?.SUPABASE_URL) return false
  try {
    const r = await traer(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_KEY, Authorization: `Bearer ${sesion}` } })
    return r.ok
  } catch {
    return false
  }
}

export async function abrirLinkClip(request, env, traer = fetch) {
  const { origin } = new URL(request.url)
  const desde = request.headers.get('origin')
  if (desde && desde !== origin) return json({ error: 'No autorizado' }, 403)
  if (!(await hayUsuario(request, env, traer))) return json({ error: 'Hay que entrar con Discord' }, 401)
  // Tope por persona y por minuto, si en Cloudflare está el límite configurado (wrangler.jsonc: LIMITE_CLIPS).
  if (env?.LIMITE_CLIPS) {
    const clave = (request.headers.get('authorization') ?? '').slice(-24)
    const { success } = await env.LIMITE_CLIPS.limit({ key: clave })
    if (!success) return json({ error: 'Abriste muchos links seguidos. Esperá un minuto.' }, 429)
  }
  let url
  try { url = (await request.json()).url } catch { return json({ error: 'Pedido mal armado' }, 400) }
  try {
    const completo = await abrirCorto(url, traer)
    if (!completo) return json({ error: 'No pudimos abrir ese link de TikTok. Abrí el video en TikTok y copiá su link completo.' }, 422)
    return json({ url: completo })
  } catch {
    return json({ error: 'TikTok no respondió. Probá de nuevo en un rato.' }, 502)
  }
}

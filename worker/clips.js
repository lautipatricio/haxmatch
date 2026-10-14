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

export async function abrirLinkClip(request) {
  let url
  try { url = (await request.json()).url } catch { return json({ error: 'Pedido mal armado' }, 400) }
  try {
    const completo = await abrirCorto(url)
    if (!completo) return json({ error: 'No pudimos abrir ese link de TikTok. Abrí el video en TikTok y copiá su link completo.' }, 422)
    return json({ url: completo })
  } catch {
    return json({ error: 'TikTok no respondió. Probá de nuevo en un rato.' }, 502)
  }
}

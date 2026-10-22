import { describe, expect, it } from 'vitest'
import { abrirCorto, abrirLinkClip } from './clips.js'

const ENV = { SUPABASE_URL: 'https://proyecto.supabase.co', SUPABASE_KEY: 'sb_publishable_x' }
const pedido = (cuerpo, encabezados = {}) => new Request('https://haxmatch.com/api/clips/abrir', {
  method: 'POST', headers: { 'content-type': 'application/json', ...encabezados }, body: JSON.stringify(cuerpo),
})
// Imitación de internet: Supabase dice si la sesión vale, TikTok redirige al video.
const red = (sesionValida) => async (url) => {
  if (String(url).endsWith('/auth/v1/user')) return new Response('{}', { status: sesionValida ? 200 : 401 })
  return new Response(null, { status: 301, headers: { location: 'https://www.tiktok.com/@jugador/video/7300000000000000000' } })
}

describe('/api/clips/abrir', () => {
  it('sin sesión no abre nada (antes cualquiera podía usarlo)', async () => {
    const r = await abrirLinkClip(pedido({ url: 'https://vm.tiktok.com/ZMabc123/' }), ENV, red(true))
    expect(r.status).toBe(401)
  })
  it('con una sesión falsa tampoco', async () => {
    const r = await abrirLinkClip(pedido({ url: 'https://vm.tiktok.com/ZMabc123/' }, { authorization: 'Bearer inventado' }), ENV, red(false))
    expect(r.status).toBe(401)
  })
  it('desde otra página, no', async () => {
    const r = await abrirLinkClip(pedido({ url: 'https://vm.tiktok.com/ZMabc123/' }, { authorization: 'Bearer ok', origin: 'https://malo.com' }), ENV, red(true))
    expect(r.status).toBe(403)
  })
  it('con sesión, devuelve el link completo del video', async () => {
    const r = await abrirLinkClip(pedido({ url: 'https://vm.tiktok.com/ZMabc123/' }, { authorization: 'Bearer ok' }), ENV, red(true))
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ url: 'https://www.tiktok.com/@jugador/video/7300000000000000000' })
  })
  it('con el tope de Cloudflare lleno, responde 429', async () => {
    const env = { ...ENV, LIMITE_CLIPS: { limit: async () => ({ success: false }) } }
    const r = await abrirLinkClip(pedido({ url: 'https://vm.tiktok.com/ZMabc123/' }, { authorization: 'Bearer ok' }), env, red(true))
    expect(r.status).toBe(429)
  })
})

describe('abrirCorto: no se usa para pedir otras direcciones (SSRF)', () => {
  const nunca = async () => { throw new Error('no tenía que salir a internet') }
  for (const url of ['http://169.254.169.254/latest/meta-data', 'https://127.0.0.1/', 'https://evil.com/vm.tiktok.com/abc12', 'file:///etc/passwd', 'https://vm.tiktok.com.evil.com/abc12'])
    it(`rechaza ${url} sin pedir nada`, async () => { expect(await abrirCorto(url, nunca)).toBeNull() })
  it('si TikTok redirige afuera de TikTok, corta', async () => {
    const afuera = async () => new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } })
    expect(await abrirCorto('https://vm.tiktok.com/ZMabc123/', afuera)).toBeNull()
  })
})

// Parte de servidor de la web de HaxMatch (Cloudflare Worker).
// La web en sí son archivos estáticos (la carpeta dist). Este código atiende
// solo las direcciones que empiezan con /api/. Hace dos cosas: mandar las
// notificaciones a los celulares (Web Push, en este archivo) y vincular las
// cuentas de TikTok (en tiktok.js).
//
// Cómo llega un aviso:
//   la base de datos (supabase/03_amigos_avisos.sql) decide a quién avisarle y
//   hace un pedido a /api/push/enviar con la clave compartida; acá se cifra el
//   mensaje para cada celular y se lo entrega al servicio de avisos del
//   navegador (Google, Apple, Mozilla o Microsoft).
//
// Claves (se cargan en Cloudflare como "Secret", nunca van en el repositorio):
//   VAPID_PUBLICA, VAPID_PRIVADA  identifican a HaxMatch ante los servicios de avisos
//   PUSH_SECRETO                  la comparte con la base, para que nadie más pueda mandar avisos

import { entrar as kickEntrar, kickConfigurado, revisarVivos, volver as kickVolver } from './kick.js'
import { entrar, revocar, sincronizar, tiktokConfigurado, volver } from './tiktok.js'

const txt = new TextEncoder()
const SERVICIOS = /^https:\/\/(fcm\.googleapis\.com|[a-z0-9-]+\.push\.apple\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com)\//

// ---------- Utilidades de bytes ----------

export function aBase64Url(bytes) {
  let s = ''
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function deBase64Url(texto) {
  const b64 = texto.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(texto.length / 4) * 4, '=')
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

function unir(...partes) {
  const total = new Uint8Array(partes.reduce((n, p) => n + p.byteLength, 0))
  let i = 0
  for (const p of partes) {
    total.set(new Uint8Array(p), i)
    i += p.byteLength
  }
  return total
}

async function hkdf(sal, clave, info, largo) {
  const base = await crypto.subtle.importKey('raw', clave, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: sal, info }, base, largo * 8))
}

// ---------- Claves ----------

/** Genera un par de claves VAPID nuevo y una clave compartida. No se guardan en ningún lado. */
export async function nuevasClaves() {
  const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const jwk = await crypto.subtle.exportKey('jwk', par.privateKey)
  const publica = aBase64Url(new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey)))
  return { publica, privada: jwk.d, secreto: aBase64Url(crypto.getRandomValues(new Uint8Array(32))) }
}

async function clavePrivada(publica, privada) {
  const punto = deBase64Url(publica)
  if (punto.length !== 65 || punto[0] !== 4) throw new Error('La clave pública VAPID no es válida')
  const jwk = { kty: 'EC', crv: 'P-256', d: privada, x: aBase64Url(punto.slice(1, 33)), y: aBase64Url(punto.slice(33, 65)), ext: true }
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
}

/** Encabezado "Authorization" que identifica a HaxMatch ante el servicio de avisos (RFC 8292). */
export async function firmaVapid(endpoint, contacto, publica, privada, ahora = Date.now()) {
  const parte = (o) => aBase64Url(txt.encode(JSON.stringify(o)))
  const datos = `${parte({ typ: 'JWT', alg: 'ES256' })}.${parte({ aud: new URL(endpoint).origin, exp: Math.floor(ahora / 1000) + 12 * 3600, sub: contacto })}`
  const firma = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, await clavePrivada(publica, privada), txt.encode(datos))
  return `vapid t=${datos}.${aBase64Url(firma)}, k=${publica}`
}

// ---------- Cifrado (RFC 8291, aes128gcm) ----------

/** Cifra el mensaje para un celular. Solo ese celular puede leerlo. */
export async function cifrar(suscripcion, mensaje) {
  const suPublica = deBase64Url(suscripcion.p256dh)
  const suSecreto = deBase64Url(suscripcion.auth)
  if (suPublica.length !== 65 || suSecreto.length < 16) throw new Error('Suscripción no válida')

  const efimera = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const miPublica = new Uint8Array(await crypto.subtle.exportKey('raw', efimera.publicKey))
  const suClave = await crypto.subtle.importKey('raw', suPublica, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const compartido = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: suClave }, efimera.privateKey, 256))

  const ikm = await hkdf(suSecreto, compartido, unir(txt.encode('WebPush: info\0'), suPublica, miPublica), 32)
  const sal = crypto.getRandomValues(new Uint8Array(16))
  const clave = await hkdf(sal, ikm, txt.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(sal, ikm, txt.encode('Content-Encoding: nonce\0'), 12)

  const aes = await crypto.subtle.importKey('raw', clave, 'AES-GCM', false, ['encrypt'])
  // El 2 marca que es el último (y único) bloque.
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, unir(txt.encode(mensaje), new Uint8Array([2]))))
  // Encabezado: sal (16) + tamaño de bloque (4) + largo de la clave (1) + clave pública efímera (65).
  return unir(sal, new Uint8Array([0, 0, 16, 0]), new Uint8Array([miPublica.length]), miPublica, cifrado)
}

// ---------- Envío ----------

/** Manda un aviso a un celular. Devuelve el código de respuesta del servicio de avisos. */
async function enviarUno(suscripcion, aviso, env, contacto) {
  if (!SERVICIOS.test(suscripcion?.endpoint ?? '')) return 400
  const cuerpo = await cifrar(suscripcion, JSON.stringify(aviso))
  const encabezados = {
    Authorization: await firmaVapid(suscripcion.endpoint, contacto, env.VAPID_PUBLICA, env.VAPID_PRIVADA),
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    // Un aviso de partido viejo no sirve: si en 15 minutos no se pudo entregar, se descarta.
    TTL: '900',
    Urgency: 'high',
  }
  // Si queda sin entregar y llega otro del mismo tipo, el nuevo reemplaza al viejo.
  if (/^[A-Za-z0-9_-]{1,32}$/.test(aviso.tag ?? '')) encabezados.Topic = aviso.tag
  const r = await fetch(suscripcion.endpoint, { method: 'POST', headers: encabezados, body: cuerpo })
  return r.status
}

/** El celular ya no acepta avisos (desinstaló la app o quitó el permiso): se le avisa a la base. */
async function darDeBaja(endpoint, env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_KEY) return
  await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/baja_suscripcion`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: env.SUPABASE_KEY, Authorization: `Bearer ${env.SUPABASE_KEY}` },
    body: JSON.stringify({ p_endpoint: endpoint, p_secreto: env.PUSH_SECRETO }),
  }).catch(() => {})
}

async function iguales(a, b) {
  const [x, y] = await Promise.all([a, b].map((v) => crypto.subtle.digest('SHA-256', txt.encode(String(v)))))
  const p = new Uint8Array(x)
  const q = new Uint8Array(y)
  let distinto = 0
  for (let i = 0; i < p.length; i++) distinto |= p[i] ^ q[i]
  return distinto === 0
}

const json = (cuerpo, estado = 200) => new Response(JSON.stringify(cuerpo), {
  status: estado, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
})

const configurado = (env) => !!(env.VAPID_PUBLICA && env.VAPID_PRIVADA && env.PUSH_SECRETO)

async function enviar(request, env, ctx) {
  if (!configurado(env)) return json({ error: 'Los avisos no están configurados' }, 503)
  if (!(await iguales(request.headers.get('x-haxmatch-secreto') ?? '', env.PUSH_SECRETO))) return json({ error: 'No autorizado' }, 401)
  let pedido
  try {
    pedido = await request.json()
  } catch {
    return json({ error: 'Pedido no válido' }, 400)
  }
  const suscripciones = Array.isArray(pedido?.suscripciones) ? pedido.suscripciones.slice(0, 20) : []
  const aviso = {
    titulo: String(pedido?.aviso?.titulo ?? 'HaxMatch').slice(0, 80),
    cuerpo: String(pedido?.aviso?.cuerpo ?? '').slice(0, 160),
    // Solo direcciones internas de la app.
    url: /^\/[A-Za-z0-9/_-]*$/.test(pedido?.aviso?.url ?? '') ? pedido.aviso.url : '/',
    tag: String(pedido?.aviso?.tag ?? 'haxmatch').slice(0, 32),
  }
  const contacto = new URL(request.url).origin
  const entregar = async () => {
    const resultados = await Promise.all(suscripciones.map(async (s) => {
      try {
        const estado = await enviarUno(s, aviso, env, contacto)
        if (estado === 404 || estado === 410) await darDeBaja(s.endpoint, env)
        return estado
      } catch {
        return 0
      }
    }))
    return { enviados: resultados.filter((e) => e >= 200 && e < 300).length, resultados }
  }
  // Se espera a entregarlos antes de contestar, así la base guarda cómo salió
  // cada uno. waitUntil hace que el envío termine aunque la base corte antes.
  const entrega = entregar()
  ctx?.waitUntil?.(entrega)
  return json(await entrega)
}

// ---------- Página para configurar los avisos por primera vez ----------

const escapar = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

async function paginaConfigurar(request, env) {
  const origen = new URL(request.url).origin
  const estilo = 'body{font:16px/1.5 system-ui,sans-serif;background:#0E1512;color:#EAF2EC;max-width:720px;margin:0 auto;padding:24px}h1,h2{color:#FFD84D}code,textarea{display:block;width:100%;box-sizing:border-box;background:#17211C;color:#EAF2EC;border:1px solid #2F4238;border-radius:10px;padding:10px;font:14px/1.4 ui-monospace,monospace;overflow-wrap:anywhere;white-space:pre-wrap}li{margin:10px 0}.nota{color:#9FB3A6}'
  const pagina = (cuerpo) => new Response(
    `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Avisos de HaxMatch</title><style>${estilo}</style><h1>Avisos de HaxMatch</h1>${cuerpo}</html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } })

  if (configurado(env)) {
    return pagina('<p>Los avisos ya están configurados en Cloudflare. No hace falta hacer nada más acá.</p><p class="nota">Si querés cambiar las claves, borrá las tres de Cloudflare y volvé a abrir esta página.</p>')
  }
  const c = await nuevasClaves()
  const sql = `select public.configurar_push('${origen}/api/push/enviar', '${c.secreto}');`
  return pagina(`
    <p>Estas tres claves se acaban de generar para vos y <strong>no quedan guardadas en ningún lado</strong>: si cerrás la página sin copiarlas, se pierden (y al volver a abrirla salen otras). No se las pases a nadie.</p>
    <h2>1. En Cloudflare</h2>
    <p>Workers &amp; Pages &gt; haxmatch &gt; Settings &gt; Variables and Secrets &gt; Add. Agregá las tres, todas de tipo <strong>Secret</strong>, con estos nombres y valores, y tocá Deploy.</p>
    <ol>
      <li>Nombre <strong>VAPID_PUBLICA</strong><code>${escapar(c.publica)}</code></li>
      <li>Nombre <strong>VAPID_PRIVADA</strong><code>${escapar(c.privada)}</code></li>
      <li>Nombre <strong>PUSH_SECRETO</strong><code>${escapar(c.secreto)}</code></li>
    </ol>
    <h2>2. En Supabase</h2>
    <p>SQL Editor: pegá esta línea tal cual y tocá Run. Tiene que responder "Avisos configurados".</p>
    <code>${escapar(sql)}</code>
    <h2>3. Comprobar</h2>
    <p>Volvé a abrir esta página. Si dice que los avisos ya están configurados, quedó listo.</p>`)
}

// ---------- Entrada ----------

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url)
    if (pathname === '/api/push/clave' && request.method === 'GET') {
      // La clave pública no es secreta: la app la necesita para activar los avisos en cada celular.
      return json({ clave: configurado(env) ? env.VAPID_PUBLICA : null })
    }
    if (pathname === '/api/push/enviar' && request.method === 'POST') return enviar(request, env, ctx)
    if (pathname === '/api/push/configurar' && request.method === 'GET') return paginaConfigurar(request, env)
    if (pathname === '/api/tiktok/estado' && request.method === 'GET') return json({ configurado: tiktokConfigurado(env) })
    if (pathname === '/api/tiktok/entrar' && request.method === 'POST') return entrar(request, env)
    if (pathname === '/api/tiktok/volver' && request.method === 'GET') return volver(request, env)
    if (pathname === '/api/tiktok/sincronizar' && request.method === 'POST') return sincronizar(request, env, ctx)
    if (pathname === '/api/tiktok/revocar' && request.method === 'POST') return revocar(request, env, ctx)
    if (pathname === '/api/kick/estado' && request.method === 'GET') return json({ configurado: kickConfigurado(env) })
    if (pathname === '/api/kick/entrar' && request.method === 'POST') return kickEntrar(request, env)
    if (pathname === '/api/kick/volver' && request.method === 'GET') return kickVolver(request, env)
    if (pathname.startsWith('/api/')) return json({ error: 'No existe' }, 404)
    return env.ASSETS.fetch(request)
  },

  // Programado en wrangler.jsonc: cada minuto, quién está en vivo en Kick.
  async scheduled(_evento, env, ctx) {
    ctx.waitUntil(revisarVivos(env).catch(() => {}))
  },
}

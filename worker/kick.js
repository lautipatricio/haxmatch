// Vinculación con Kick y quién está en vivo (parte de servidor). Acá vive lo que
// no puede estar en la app porque usa la clave secreta de Kick:
//
//   1. /api/kick/entrar   la app avisa que el usuario quiere vincular; se le devuelve
//                         la dirección de Kick donde da el permiso.
//   2. /api/kick/volver   Kick devuelve al usuario con un código; se cambia por una
//                         llave, se lee quién es, se anula la llave y queda vinculado.
//   3. Cada 2 minutos (programado en wrangler.jsonc) se le pregunta a Kick qué
//      canales vinculados están en vivo.
//
// De Kick se pide solo el permiso user:read (quién es). El canal y si está en vivo
// son datos públicos: se leen con la llave de la propia app, sin pedirle nada al usuario.
//
// Claves en Cloudflare, como "Secret": KICK_CLIENT_ID y KICK_CLIENT_SECRET.
import { base, iguales, json } from './tiktok.js'

const AUTORIZAR = 'https://id.kick.com/oauth/authorize'
const TOKEN = 'https://id.kick.com/oauth/token'
const REVOCAR = 'https://id.kick.com/oauth/revoke'
const API = 'https://api.kick.com/public/v1'
const PERMISOS = 'user:read'
const COOKIE = 'hx_kick'

const id = (env) => String(env.KICK_CLIENT_ID ?? '').trim()
const secreto = (env) => String(env.KICK_CLIENT_SECRET ?? '').trim()

export const kickConfigurado = (env) =>
  !!(env.KICK_CLIENT_ID && env.KICK_CLIENT_SECRET && env.PUSH_SECRETO && env.SUPABASE_URL && env.SUPABASE_KEY)

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/** Pedido a Kick con datos de formulario (así lo piden sus direcciones de llaves). */
async function formulario(url, campos) {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(campos).toString(),
    })
    const texto = await r.text()
    let dato = {}
    try { dato = texto ? JSON.parse(texto) : {} } catch { dato = {} }
    return { ok: r.ok, dato }
  } catch {
    return { ok: false, dato: {} }
  }
}

/** Llave de la propia app (para leer datos públicos). Se guarda mientras dura. */
let llaveApp = null
async function tokenDeApp(env) {
  if (llaveApp && llaveApp.vence > Date.now() + 60_000 && llaveApp.de === id(env)) return llaveApp.token
  const r = await formulario(TOKEN, { grant_type: 'client_credentials', client_id: id(env), client_secret: secreto(env) })
  if (!r.ok || !r.dato.access_token) return null
  llaveApp = { token: r.dato.access_token, vence: Date.now() + (Number(r.dato.expires_in) || 3600) * 1000, de: id(env) }
  return llaveApp.token
}

/** Datos públicos de hasta 50 canales: { kick_id, en_vivo, titulo, slug }. null si Kick no contestó bien. */
async function canales(env, ids) {
  const token = await tokenDeApp(env)
  if (!token) return null
  try {
    const q = ids.map((n) => `broadcaster_user_id=${encodeURIComponent(n)}`).join('&')
    const r = await fetch(`${API}/channels?${q}`, { headers: { Authorization: `Bearer ${token}` } })
    if (r.status === 401) llaveApp = null
    if (!r.ok) return null
    const d = await r.json()
    if (!Array.isArray(d?.data)) return null
    return d.data
      .filter((c) => Number.isSafeInteger(Number(c?.broadcaster_user_id)))
      .map((c) => ({
        kick_id: Number(c.broadcaster_user_id),
        en_vivo: c.stream?.is_live === true,
        titulo: String(c.stream_title ?? '').slice(0, 140),
        slug: String(c.slug ?? ''),
      }))
  } catch {
    return null
  }
}

async function usuarioDeSesion(request, env) {
  const sesion = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!sesion) return null
  try {
    const r = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_KEY, Authorization: `Bearer ${sesion}` } })
    return r.ok ? (await r.json())?.id ?? null : null
  } catch {
    return null
  }
}

// ---------- 1. La app pide vincular ----------

export async function entrar(request, env) {
  if (!kickConfigurado(env)) return json({ error: 'Kick todavía no está habilitado en HaxMatch.' }, 503)
  const { origin } = new URL(request.url)
  // Solo desde la propia app: otra página no puede iniciar una vinculación a nombre de nadie.
  const desde = request.headers.get('origin')
  if (desde && desde !== origin) return json({ error: 'No autorizado' }, 403)
  const usuario = await usuarioDeSesion(request, env)
  if (!usuario) return json({ error: 'Hay que entrar con Discord' }, 401)

  // Código de comprobación que exige Kick: se guarda en la base y viaja a Kick solo su huella.
  const verificador = b64url(crypto.getRandomValues(new Uint8Array(32)))
  const desafio = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verificador)))
  const inicio = await base(env, 'kick_empezar', { p_user: usuario, p_verificador: verificador })
  if (!inicio.ok || typeof inicio.dato !== 'string') return json({ error: 'No pudimos empezar la vinculación. Probá de nuevo.' }, 502)
  const destino = new URL(AUTORIZAR)
  destino.searchParams.set('response_type', 'code')
  destino.searchParams.set('client_id', id(env))
  destino.searchParams.set('redirect_uri', `${origin}/api/kick/volver`)
  destino.searchParams.set('scope', PERMISOS)
  destino.searchParams.set('code_challenge', desafio)
  destino.searchParams.set('code_challenge_method', 'S256')
  destino.searchParams.set('state', inicio.dato)
  // El mismo código queda en este navegador: al volver de Kick tienen que coincidir.
  return json({ url: destino.toString() }, 200, {
    'set-cookie': `${COOKIE}=${inicio.dato}; Path=/api/kick; Max-Age=900; HttpOnly; Secure; SameSite=Lax`,
  })
}

// ---------- 2. Kick devuelve al usuario ----------

export async function volver(request, env) {
  const url = new URL(request.url)
  const terminar = (resultado) => new Response(null, {
    status: 302,
    headers: {
      location: `${url.origin}/perfil?kick=${resultado}`,
      'set-cookie': `${COOKIE}=; Path=/api/kick; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
      'cache-control': 'no-store',
    },
  })
  if (!kickConfigurado(env)) return terminar('error')
  if (url.searchParams.get('error')) return terminar('cancelado')
  const state = url.searchParams.get('state') ?? ''
  const code = url.searchParams.get('code') ?? ''
  const galleta = new RegExp(`(?:^|;\\s*)${COOKIE}=([0-9a-f]{64})`).exec(request.headers.get('cookie') ?? '')?.[1] ?? ''
  if (!/^[0-9a-f]{64}$/.test(state) || !code || !(await iguales(state, galleta))) return terminar('vencido')

  try {
    const tomado = await base(env, 'kick_tomar', { p_state: state })
    if (!tomado.ok || !tomado.dato?.user_id) return terminar('vencido')
    const t = await formulario(TOKEN, {
      grant_type: 'authorization_code', client_id: id(env), client_secret: secreto(env),
      code, redirect_uri: `${url.origin}/api/kick/volver`, code_verifier: tomado.dato.verificador,
    })
    if (!t.ok || !t.dato.access_token) return terminar('error')
    const llave = t.dato.access_token

    // Quién es. Del usuario solo se usa su número y su nombre (el mail que manda Kick no se guarda).
    let yo = null
    try {
      const r = await fetch(`${API}/users`, { headers: { Authorization: `Bearer ${llave}` } })
      const d = r.ok ? await r.json() : null
      yo = Array.isArray(d?.data) ? d.data[0] : null
    } catch {
      yo = null
    }
    // Las llaves ya no hacen falta: se anulan las dos (la de acceso y la de renovación).
    const anular = (token, tipo) => token
      ? fetch(`${REVOCAR}?token=${encodeURIComponent(token)}&token_hint_type=${tipo}`, { method: 'POST' }).catch(() => {})
      : Promise.resolve()
    await Promise.all([anular(llave, 'access_token'), anular(t.dato.refresh_token, 'refresh_token')])
    const kickId = Number(yo?.user_id)
    const nombre = String(yo?.name ?? '').trim()
    if (!Number.isSafeInteger(kickId) || !nombre) return terminar('error')

    // Su canal (dirección y si está en vivo). Si Kick no contesta, se arma con el nombre y se corrige en la próxima revisión.
    const canal = (await canales(env, [kickId]))?.find((c) => c.kick_id === kickId)
    const slug = /^[A-Za-z0-9_-]{1,60}$/.test(canal?.slug ?? '') ? canal.slug : nombre.toLowerCase().replace(/_/g, '-').replace(/[^a-z0-9-]/g, '')
    const guardado = await base(env, 'kick_guardar', {
      p_user: tomado.dato.user_id, p_kick_id: kickId, p_usuario: nombre, p_slug: slug,
      p_en_vivo: canal?.en_vivo === true, p_titulo: canal?.titulo ?? '',
    })
    if (!guardado.ok) return terminar(/ocupada/.test(guardado.error) ? 'ocupada' : 'error')
    return terminar('ok')
  } catch {
    return terminar('error')
  }
}

// ---------- 3. Quién está en vivo ----------

/** Le pregunta a Kick por todos los canales vinculados y anota cuáles están en vivo. */
export async function revisarVivos(env) {
  if (!kickConfigurado(env)) return { revisados: 0 }
  const lista = await base(env, 'kick_lista', {})
  const ids = Array.isArray(lista.dato) ? lista.dato.map(Number).filter(Number.isSafeInteger) : []
  if (!lista.ok || ids.length === 0) return { revisados: 0 }
  const respuestas = []
  for (let i = 0; i < ids.length; i += 50) {
    const parte = await canales(env, ids.slice(i, i + 50))
    // Si Kick no contestó por esta tanda, esos canales quedan como estaban.
    if (parte) respuestas.push(...parte)
  }
  if (respuestas.length === 0) return { revisados: 0 }
  const r = await base(env, 'kick_vivos', { p_canales: respuestas })
  return { revisados: respuestas.length, cambios: r.dato ?? 0 }
}

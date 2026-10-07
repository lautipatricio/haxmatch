// Vinculación con TikTok (parte de servidor). Acá vive lo que no puede estar en
// la app porque usa la clave secreta de TikTok:
//
//   1. /api/tiktok/entrar   la app avisa que el usuario quiere vincular; se le
//                           devuelve la dirección de TikTok donde da el permiso.
//   2. /api/tiktok/volver   TikTok devuelve al usuario con un código; se cambia
//                           por las llaves de acceso, se guardan en la base y se
//                           traen sus videos por primera vez.
//   3. /api/tiktok/sincronizar   la base pide traer de nuevo los videos de alguien.
//   4. /api/tiktok/revocar       la base pide anular un permiso (al desvincular).
//
// De TikTok se lee solo el nombre visible y la lista de videos públicos
// (permisos user.info.basic y video.list). Los videos no se descargan.
//
// Claves en Cloudflare, como "Secret": TIKTOK_CLIENT_KEY y TIKTOK_CLIENT_SECRET.

const AUTORIZAR = 'https://www.tiktok.com/v2/auth/authorize/'
const API = 'https://open.tiktokapis.com'
const PERMISOS = 'user.info.basic,video.list'
const COOKIE = 'hx_tiktok'
const CAMPOS = 'id,title,video_description,duration,create_time,share_url'
/** Cuántas páginas de 20 videos se traen como mucho por vez. */
const PAGINAS = 10

const json = (cuerpo, estado = 200, extra = {}) => new Response(JSON.stringify(cuerpo), {
  status: estado, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
})

export const tiktokConfigurado = (env) =>
  !!(env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET && env.PUSH_SECRETO && env.SUPABASE_URL && env.SUPABASE_KEY)

async function iguales(a, b) {
  const t = new TextEncoder()
  const [x, y] = await Promise.all([a, b].map((v) => crypto.subtle.digest('SHA-256', t.encode(String(v)))))
  const p = new Uint8Array(x)
  const q = new Uint8Array(y)
  let distinto = 0
  for (let i = 0; i < p.length; i++) distinto |= p[i] ^ q[i]
  return distinto === 0
}

/** Llama a una función de la base con la clave compartida. */
async function base(env, funcion, args) {
  try {
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${funcion}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: env.SUPABASE_KEY, Authorization: `Bearer ${env.SUPABASE_KEY}` },
      body: JSON.stringify({ p_secreto: env.PUSH_SECRETO, ...args }),
    })
    const texto = await r.text()
    let dato = null
    try { dato = texto ? JSON.parse(texto) : null } catch { dato = null }
    return r.ok ? { ok: true, dato } : { ok: false, error: String(dato?.message ?? dato?.error ?? 'error') }
  } catch {
    return { ok: false, error: 'sin conexión' }
  }
}

/** Pedido a TikTok con datos de formulario (así lo piden sus direcciones de llaves). */
async function formulario(ruta, campos) {
  const r = await fetch(`${API}${ruta}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'cache-control': 'no-cache' },
    body: new URLSearchParams(campos).toString(),
  })
  const texto = await r.text()
  try { return { ok: r.ok, dato: texto ? JSON.parse(texto) : {} } } catch { return { ok: false, dato: {} } }
}

/** Llaves tal como las guarda la base. Los vencimientos van solo si TikTok los informó. */
function llaves(d) {
  const l = { access_token: d.access_token, refresh_token: d.refresh_token }
  if (Number(d.expires_in) > 0) l.expira = Number(d.expires_in)
  if (Number(d.refresh_expires_in) > 0) l.refresh_expira = Number(d.refresh_expires_in)
  return l
}

/**
 * Renueva las llaves de un usuario. Devuelve:
 *   { llaves }   salió bien
 *   { perdido }  TikTok dijo expresamente que ese permiso ya no vale (hay que volver a vincular)
 *   {}           TikTok no contestó bien (caída, límite de pedidos): se reintenta más tarde
 */
async function renovar(env, refreshToken) {
  let r
  try {
    r = await formulario('/v2/oauth/token/', {
      client_key: env.TIKTOK_CLIENT_KEY, client_secret: env.TIKTOK_CLIENT_SECRET,
      grant_type: 'refresh_token', refresh_token: refreshToken,
    })
  } catch {
    return {}
  }
  if (r.ok && r.dato.access_token && r.dato.refresh_token && !r.dato.error) return { llaves: llaves(r.dato) }
  return r.dato.error === 'invalid_grant' ? { perdido: true } : {}
}

/** Le pide a TikTok que anule un permiso. Devuelve si TikTok lo aceptó. */
async function anular(env, accessToken) {
  try {
    const r = await formulario('/v2/oauth/revoke/', {
      client_key: env.TIKTOK_CLIENT_KEY, client_secret: env.TIKTOK_CLIENT_SECRET, token: accessToken,
    })
    return r.ok && !r.dato.error
  } catch {
    return false
  }
}

/**
 * Trae la lista de videos públicos del usuario, de a 20.
 * Devuelve { videos, completa }, o { error, deAcceso } si algo no salió bien
 * (deAcceso: TikTok rechazó la llave). Ante cualquier respuesta rara devuelve
 * error: nunca "lista vacía", porque eso borraría la biblioteca del usuario.
 */
async function traerVideos(accessToken) {
  const videos = []
  let cursor
  for (let pagina = 0; pagina < PAGINAS; pagina++) {
    let r
    let d
    try {
      r = await fetch(`${API}/v2/video/list/?fields=${CAMPOS}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify(cursor ? { max_count: 20, cursor } : { max_count: 20 }),
      })
      d = await r.json()
    } catch {
      return { error: 'respuesta', deAcceso: false }
    }
    const codigo = String(d?.error?.code ?? '')
    if (!r.ok || codigo !== 'ok') {
      return { error: codigo || String(r.status), deAcceso: r.status === 401 || /access_token|scope_not_authorized|invalid_token/.test(codigo) }
    }
    if (!Array.isArray(d?.data?.videos) || typeof d.data.has_more !== 'boolean') return { error: 'respuesta', deAcceso: false }
    for (const v of d.data.videos) {
      videos.push({
        id: String(v.id ?? ''), titulo: String(v.title ?? ''), descripcion: String(v.video_description ?? ''),
        duracion: Number(v.duration) || null, creado: Number(v.create_time) || null, enlace: String(v.share_url ?? ''),
      })
    }
    if (d.data.has_more === false) return { videos, completa: true }
    cursor = d.data.cursor
  }
  return { videos, completa: false }
}

// ---------- 1. La app pide vincular ----------

export async function entrar(request, env) {
  if (!tiktokConfigurado(env)) return json({ error: 'TikTok todavía no está habilitado en HaxMatch.' }, 503)
  const { origin } = new URL(request.url)
  // Solo desde la propia app: otra página no puede iniciar una vinculación a nombre de nadie.
  const desde = request.headers.get('origin')
  if (desde && desde !== origin) return json({ error: 'No autorizado' }, 403)
  const sesion = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!sesion) return json({ error: 'Hay que entrar con Discord' }, 401)
  // Supabase dice de quién es esa sesión.
  let usuario
  try {
    const r = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_KEY, Authorization: `Bearer ${sesion}` } })
    usuario = r.ok ? (await r.json())?.id : null
  } catch {
    usuario = null
  }
  if (!usuario) return json({ error: 'Hay que entrar con Discord' }, 401)

  const inicio = await base(env, 'tiktok_empezar', { p_user: usuario })
  if (!inicio.ok || typeof inicio.dato !== 'string') return json({ error: 'No pudimos empezar la vinculación. Probá de nuevo.' }, 502)
  const destino = new URL(AUTORIZAR)
  destino.searchParams.set('client_key', env.TIKTOK_CLIENT_KEY)
  destino.searchParams.set('response_type', 'code')
  destino.searchParams.set('scope', PERMISOS)
  destino.searchParams.set('redirect_uri', `${origin}/api/tiktok/volver`)
  destino.searchParams.set('state', inicio.dato)
  // El mismo código queda en este navegador: al volver de TikTok tienen que coincidir.
  return json({ url: destino.toString() }, 200, {
    'set-cookie': `${COOKIE}=${inicio.dato}; Path=/api/tiktok; Max-Age=900; HttpOnly; Secure; SameSite=Lax`,
  })
}

// ---------- 2. TikTok devuelve al usuario ----------

export async function volver(request, env) {
  const url = new URL(request.url)
  const terminar = (resultado) => new Response(null, {
    status: 302,
    headers: {
      location: `${url.origin}/clips/mis-videos?tiktok=${resultado}`,
      'set-cookie': `${COOKIE}=; Path=/api/tiktok; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
      'cache-control': 'no-store',
    },
  })
  if (!tiktokConfigurado(env)) return terminar('error')
  if (url.searchParams.get('error')) return terminar('cancelado')
  const state = url.searchParams.get('state') ?? ''
  const code = url.searchParams.get('code') ?? ''
  const galleta = new RegExp(`(?:^|;\\s*)${COOKIE}=([0-9a-f]{64})`).exec(request.headers.get('cookie') ?? '')?.[1] ?? ''
  if (!/^[0-9a-f]{64}$/.test(state) || !code || !(await iguales(state, galleta))) return terminar('vencido')

  try {
    const r = await formulario('/v2/oauth/token/', {
      client_key: env.TIKTOK_CLIENT_KEY, client_secret: env.TIKTOK_CLIENT_SECRET,
      code, grant_type: 'authorization_code', redirect_uri: `${url.origin}/api/tiktok/volver`,
    })
    const t = r.dato
    if (!r.ok || t.error || !t.access_token || !t.refresh_token || !t.open_id) return terminar('error')
    // Sin el permiso de ver los videos no hay nada que mostrar: no se guarda nada y se anula lo que dio.
    if (!String(t.scope ?? '').split(',').includes('video.list')) {
      await anular(env, t.access_token)
      return terminar('permiso')
    }

    let nombre = ''
    try {
      const u = await fetch(`${API}/v2/user/info/?fields=open_id,display_name`, { headers: { Authorization: `Bearer ${t.access_token}` } })
      nombre = String((await u.json())?.data?.user?.display_name ?? '')
    } catch {
      nombre = ''
    }

    const guardado = await base(env, 'tiktok_guardar', {
      p_state: state, p_open_id: t.open_id, p_nombre: nombre, p_access: t.access_token, p_refresh: t.refresh_token,
      p_expira: Number(t.expires_in) || 0, p_refresh_expira: Number(t.refresh_expires_in) || 0, p_scope: String(t.scope ?? ''),
    })
    if (!guardado.ok) return terminar(/ocupada/.test(guardado.error) ? 'ocupada' : /vencido/.test(guardado.error) ? 'vencido' : 'error')

    // Primera importación. Si falla, la cuenta igual quedó vinculada: la app vuelve a
    // pedirla al abrir "Mis videos", y lo que llegue cuenta como primera importación.
    const lista = await traerVideos(t.access_token)
    if (lista.videos) {
      await base(env, 'tiktok_importar', { p_user: guardado.dato, p_videos: lista.videos, p_completa: lista.completa, p_inicial: true })
    }
    return terminar('ok')
  } catch {
    return terminar('error')
  }
}

// ---------- 3 y 4. Pedidos de la base ----------

async function pedidoDeLaBase(request, env) {
  if (!tiktokConfigurado(env)) return { error: json({ error: 'TikTok no está configurado' }, 503) }
  if (!(await iguales(request.headers.get('x-haxmatch-secreto') ?? '', env.PUSH_SECRETO))) return { error: json({ error: 'No autorizado' }, 401) }
  try {
    return { cuerpo: await request.json() }
  } catch {
    return { error: json({ error: 'Pedido no válido' }, 400) }
  }
}

export async function sincronizar(request, env, ctx) {
  const p = await pedidoDeLaBase(request, env)
  if (p.error) return p.error
  const { user_id: usuario, access_token: access, refresh_token: refresh, expira } = p.cuerpo ?? {}
  if (!usuario || !access || !refresh) return json({ error: 'Pedido no válido' }, 400)

  const trabajo = (async () => {
    const perdido = async () => {
      await base(env, 'tiktok_fallo', { p_user: usuario, p_error: 'TikTok ya no nos deja ver tus videos. Volvé a vincular tu cuenta.' })
      return { ok: false, perdido: true }
    }
    let actual = access
    let renovadas = false
    // Renueva y guarda en el momento: TikTok puede dar de baja las llaves viejas al entregar las nuevas.
    const renovarYGuardar = async () => {
      const r = await renovar(env, refresh)
      if (r.llaves) {
        renovadas = true
        actual = r.llaves.access_token
        await base(env, 'tiktok_llaves', { p_user: usuario, p_tokens: r.llaves })
      }
      return r
    }
    // Las llaves duran un día: si están por vencer, se renuevan antes de usarlas.
    if (!(Number(expira) > Date.now() / 1000 + 600)) {
      const r = await renovarYGuardar()
      if (r.perdido) return perdido()
      if (!r.llaves) return { ok: false, error: 'tiktok' }
    }
    let lista = await traerVideos(actual)
    if (lista.error && lista.deAcceso && !renovadas) {
      // La llave dejó de valer antes de tiempo: se prueba una vez con una nueva.
      const r = await renovarYGuardar()
      if (r.perdido) return perdido()
      if (!r.llaves) return { ok: false, error: 'tiktok' }
      lista = await traerVideos(actual)
    }
    // Un problema pasajero de TikTok no marca la cuenta: se reintenta en la próxima actualización.
    if (lista.error) return lista.deAcceso ? perdido() : { ok: false, error: lista.error }
    const r = await base(env, 'tiktok_importar', { p_user: usuario, p_videos: lista.videos, p_completa: lista.completa, p_inicial: false })
    return { ok: r.ok, videos: lista.videos.length }
  })().catch(() => ({ ok: false, error: 'error' }))
  // Aunque la base corte la espera, el trabajo termina.
  ctx?.waitUntil?.(trabajo)
  return json(await trabajo)
}

export async function revocar(request, env, ctx) {
  const p = await pedidoDeLaBase(request, env)
  if (p.error) return p.error
  const { access_token: access, refresh_token: refresh } = p.cuerpo ?? {}
  if (!access && !refresh) return json({ error: 'Pedido no válido' }, 400)
  const trabajo = (async () => {
    if (access && (await anular(env, access))) return { ok: true }
    // La llave de acceso dura un día: si ya venció, se consigue una nueva solo para poder anular el permiso.
    const r = refresh ? await renovar(env, refresh) : {}
    return { ok: r.llaves ? await anular(env, r.llaves.access_token) : !!r.perdido }
  })().catch(() => ({ ok: false }))
  ctx?.waitUntil?.(trabajo)
  return json(await trabajo)
}

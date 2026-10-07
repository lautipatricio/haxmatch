// TikTok de mentira, para probar la vinculación sin tocar el TikTok real.
// Responde como la API de TikTok (llaves, datos del usuario, lista de videos,
// anular permiso) según su documentación, con cuentas y videos inventados.
const json = (cuerpo, estado = 200) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'content-type': 'application/json' } })

export function crearTikTokFalso() {
  /** nombre de la cuenta → { open_id, display_name, videos, access, refresh, permisos, anulada } */
  const cuentas = new Map()
  let serie = 0
  const pedidos = []
  /** Fallas programadas: la próxima vez que se pida esa ruta, responde esto. */
  const averias = []

  const cuenta = (nombre) => {
    if (!cuentas.has(nombre)) {
      // Una cuenta puede tener varias llaves vigentes a la vez (una por cada vez que dio permiso).
      cuentas.set(nombre, { nombre, open_id: `open-${nombre}`, display_name: nombre, videos: [], access: new Set(), refresh: new Set(), permisos: 'user.info.basic,video.list' })
    }
    return cuentas.get(nombre)
  }
  const porAccess = (t) => [...cuentas.values()].find((c) => c.access.has(t))
  const darLlaves = (c) => {
    const access = `acc-${c.nombre}-${++serie}`
    const refresh = `ref-${c.nombre}-${serie}`
    c.access.add(access)
    c.refresh.add(refresh)
    return { access_token: access, refresh_token: refresh, expires_in: 86400, refresh_expires_in: 31536000, open_id: c.open_id, scope: c.permisos, token_type: 'Bearer' }
  }

  return {
    cuenta,
    pedidos,
    /** Agrega un video a una cuenta. Devuelve su id. */
    publicar(nombre, descripcion, haceSegundos = 60) {
      const c = cuenta(nombre)
      const id = String(7400000000000000000n + BigInt(++serie))
      c.videos.unshift({ id, title: '', video_description: descripcion, duration: 23, create_time: Math.floor(Date.now() / 1000) - haceSegundos, share_url: `https://www.tiktok.com/@${nombre}/video/${id}` })
      return id
    },
    borrar(nombre, id) { cuenta(nombre).videos = cuenta(nombre).videos.filter((v) => v.id !== id) },
    /** La llave de acceso deja de valer (como si hubiera pasado un día). */
    vencer(nombre) { cuenta(nombre).access.clear() },
    /** El usuario quitó el permiso desde TikTok: ya no vale nada. */
    quitarPermiso(nombre) { const c = cuenta(nombre); c.access.clear(); c.refresh.clear() },

    /** La próxima vez (o las próximas "veces") que se pida esa ruta, TikTok responde mal. */
    averiar(ruta, estado, cuerpo = 'Bad Gateway', veces = 1) { averias.push({ ruta, estado, cuerpo, veces }) },

    /** Atiende un pedido si es para TikTok. Si no, devuelve null. */
    atender(url, opciones = {}) {
      const u = new URL(url)
      if (u.hostname !== 'open.tiktokapis.com') return null
      const cuerpo = typeof opciones.body === 'string' ? opciones.body : ''
      const bearer = String(new Headers(opciones.headers ?? {}).get('authorization') ?? '').replace(/^Bearer\s+/i, '')
      pedidos.push({ ruta: u.pathname, cuerpo })
      const averia = averias.find((a) => a.ruta === u.pathname && a.veces > 0)
      if (averia) {
        averia.veces--
        return new Response(typeof averia.cuerpo === 'string' ? averia.cuerpo : JSON.stringify(averia.cuerpo), { status: averia.estado })
      }

      if (u.pathname === '/v2/oauth/token/') {
        const f = new URLSearchParams(cuerpo)
        if (f.get('client_key') !== 'clave-de-prueba' || f.get('client_secret') !== 'secreto-de-prueba') return json({ error: 'invalid_client', error_description: 'Client key or secret is incorrect.', log_id: 'x' }, 401)
        if (f.get('grant_type') === 'authorization_code') {
          const nombre = /^codigo-(.+)$/.exec(f.get('code') ?? '')?.[1]
          if (!nombre || !f.get('redirect_uri')?.endsWith('/api/tiktok/volver')) return json({ error: 'invalid_grant', error_description: 'Authorization code is invalid.', log_id: 'x' }, 400)
          return json(darLlaves(cuenta(nombre)))
        }
        if (f.get('grant_type') === 'refresh_token') {
          const c = [...cuentas.values()].find((x) => x.refresh.has(f.get('refresh_token')))
          if (c) c.refresh.delete(f.get('refresh_token'))
          return c ? json(darLlaves(c)) : json({ error: 'invalid_grant', error_description: 'Refresh token is invalid or expired.', log_id: 'x' }, 400)
        }
        return json({ error: 'unsupported_grant_type', log_id: 'x' }, 400)
      }
      if (u.pathname === '/v2/oauth/revoke/') {
        const c = porAccess(new URLSearchParams(cuerpo).get('token'))
        if (!c) return json({ error: 'invalid_grant', error_description: 'Access token is invalid.', log_id: 'x' }, 400)
        c.access.clear()
        c.refresh.clear()
        return json({})
      }
      const c = porAccess(bearer)
      const sinAcceso = () => json({ data: {}, error: { code: 'access_token_invalid', message: 'The access token is invalid or not found in the request.', log_id: 'x' } }, 401)
      if (u.pathname === '/v2/user/info/') {
        return c ? json({ data: { user: { open_id: c.open_id, display_name: c.display_name } }, error: { code: 'ok', message: '', log_id: 'x' } }) : sinAcceso()
      }
      if (u.pathname === '/v2/video/list/') {
        if (!c) return sinAcceso()
        const pedido = cuerpo ? JSON.parse(cuerpo) : {}
        const cuantos = Math.min(Number(pedido.max_count) || 10, 20)
        const desde = Number(pedido.cursor) || 0
        const campos = (u.searchParams.get('fields') ?? '').split(',')
        const tanda = c.videos.slice(desde, desde + cuantos).map((v) => Object.fromEntries(campos.filter((k) => k in v).map((k) => [k, v[k]])))
        return json({ data: { videos: tanda, cursor: desde + cuantos, has_more: desde + cuantos < c.videos.length }, error: { code: 'ok', message: '', log_id: 'x' } })
      }
      return json({ error: { code: 'not_found' } }, 404)
    },
  }
}

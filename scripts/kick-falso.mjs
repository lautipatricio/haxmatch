// Kick de mentira, para probar la vinculación sin tocar el Kick real. Responde como
// la API de Kick según su documentación (llaves con PKCE, datos del usuario, canales
// con su directo, anular llave), con cuentas inventadas.
const json = (cuerpo, estado = 200) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'content-type': 'application/json' } })

async function huella(texto) {
  const b = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto)))
  return Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function crearKickFalso({ clienteId = 'kick-id-de-prueba', clienteSecreto = 'kick-secreto-de-prueba' } = {}) {
  /** nombre → { user_id, name, slug, en_vivo, titulo } */
  const cuentas = new Map()
  /** código de autorización → { nombre, desafio } */
  const codigos = new Map()
  /** llave de usuario → nombre */
  const llaves = new Map()
  const anuladas = new Set()
  const llavesDeApp = new Set()
  const pedidos = []
  let serie = 1000
  let caido = false

  const cuenta = (nombre) => {
    if (!cuentas.has(nombre)) cuentas.set(nombre, { user_id: ++serie, name: nombre, slug: nombre.toLowerCase(), en_vivo: false, titulo: '' })
    return cuentas.get(nombre)
  }

  return {
    cuenta,
    pedidos,
    anuladas,
    /** Empieza o termina un directo. */
    enVivo(nombre, vivo, titulo = '') { const c = cuenta(nombre); c.en_vivo = vivo; c.titulo = titulo },
    /** Kick deja de contestar la lista de canales. */
    caer(si = true) { caido = si },
    /** Lo que haría la página de Kick al autorizar: guarda el código con el desafío que mandó la web. */
    autorizar(nombre, desafio) {
      const code = `codigo-kick-${nombre}-${++serie}`
      cuenta(nombre)
      codigos.set(code, { nombre, desafio })
      return code
    },

    /** Atiende un pedido si es para Kick. Si no, devuelve null. */
    async atender(url, opciones = {}) {
      const u = new URL(url)
      if (u.hostname !== 'id.kick.com' && u.hostname !== 'api.kick.com') return null
      const cuerpo = typeof opciones.body === 'string' ? opciones.body : ''
      const bearer = String(new Headers(opciones.headers ?? {}).get('authorization') ?? '').replace(/^Bearer\s+/i, '')
      pedidos.push({ host: u.hostname, ruta: u.pathname, cuerpo, bearer })

      if (u.hostname === 'id.kick.com' && u.pathname === '/oauth/token') {
        const f = new URLSearchParams(cuerpo)
        if (f.get('client_id') !== clienteId || f.get('client_secret') !== clienteSecreto) return json({ error: 'invalid_client' }, 401)
        if (f.get('grant_type') === 'client_credentials') {
          const t = `app-${++serie}`
          llavesDeApp.add(t)
          return json({ access_token: t, token_type: 'Bearer', expires_in: 3600 })
        }
        if (f.get('grant_type') === 'authorization_code') {
          const c = codigos.get(f.get('code') ?? '')
          if (!c || !f.get('redirect_uri')) return json({ error: 'invalid_grant' }, 400)
          // PKCE: el verificador tiene que corresponder al desafío que se mandó al autorizar.
          if ((await huella(f.get('code_verifier') ?? '')) !== c.desafio) return json({ error: 'invalid_grant' }, 400)
          codigos.delete(f.get('code'))
          const t = `usr-${c.nombre}-${++serie}`
          llaves.set(t, c.nombre)
          return json({ access_token: t, refresh_token: `ref-${t}`, token_type: 'Bearer', expires_in: 7200, scope: 'user:read' })
        }
        return json({ error: 'unsupported_grant_type' }, 400)
      }
      if (u.hostname === 'id.kick.com' && u.pathname === '/oauth/revoke') {
        anuladas.add(u.searchParams.get('token'))
        llaves.delete(u.searchParams.get('token'))
        return new Response(null, { status: 200 })
      }
      if (u.pathname === '/public/v1/users') {
        const nombre = llaves.get(bearer)
        if (!nombre) return json({ message: 'Unauthorized' }, 401)
        const c = cuenta(nombre)
        return json({ data: [{ user_id: c.user_id, name: c.name, email: `${nombre}@correo.test`, profile_picture: '' }], message: 'OK' })
      }
      if (u.pathname === '/public/v1/channels') {
        if (!llavesDeApp.has(bearer)) return json({ message: 'Unauthorized' }, 401)
        if (caido) return json({ message: 'Bad Gateway' }, 502)
        const ids = u.searchParams.getAll('broadcaster_user_id').map(Number)
        const data = [...cuentas.values()].filter((c) => ids.includes(c.user_id)).map((c) => ({
          broadcaster_user_id: c.user_id, slug: c.slug, stream_title: c.titulo,
          stream: { is_live: c.en_vivo, viewer_count: c.en_vivo ? 12 : 0, url: '', key: '' },
        }))
        return json({ data, message: 'OK' })
      }
      return json({ message: 'Not Found' }, 404)
    },
  }
}

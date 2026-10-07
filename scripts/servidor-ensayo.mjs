// Servidor de ensayo: la misma base de datos de Supabase (los SQL de supabase/),
// pero corriendo en esta computadora, para probar la app con varios usuarios a
// la vez sin tocar el proyecto real. No guarda nada: al cerrarlo se pierde todo.
//
// Uso:  node scripts/servidor-ensayo.mjs      (queda en http://localhost:8787)
//       npm run build:ensayo && npx vite preview --outDir dist-ensayo --port 4174
//       y abrir http://localhost:4174/?u=ana en una ventana y ?u=beto en otra.
import http from 'node:http'
import { pathToFileURL } from 'node:url'
import { crearAcceso, crearBase } from './supabase-local.mjs'
import { crearTikTokFalso } from './tiktok-falso.mjs'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, x-usuario',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
}

/**
 * conWeb: además de la base, levanta la parte de servidor de la web
 * (worker/index.js) conectada a esa base, con un TikTok de mentira y sin mandar
 * notificaciones de verdad. Así se puede ensayar todo el recorrido.
 */
export async function iniciarEnsayo(puerto = 8787, { conWeb = false } = {}) {
  const db = await crearBase({ silencioso: true })
  const acceso = crearAcceso(db)
  const usuarios = new Map()
  const oyentes = new Set()
  let version = null

  let worker = null
  let entorno = null
  const tiktok = crearTikTokFalso()
  /** Notificaciones que la web quiso mandar a los celulares. */
  const empujes = []
  if (conWeb) {
    const modulo = await import('../worker/index.js')
    worker = modulo.default
    const claves = await modulo.nuevasClaves()
    entorno = {
      VAPID_PUBLICA: claves.publica, VAPID_PRIVADA: claves.privada, PUSH_SECRETO: claves.secreto,
      SUPABASE_URL: `http://localhost:${puerto}`, SUPABASE_KEY: 'clave-publica-de-ensayo',
      TIKTOK_CLIENT_KEY: 'clave-de-prueba', TIKTOK_CLIENT_SECRET: 'secreto-de-prueba',
      ASSETS: { fetch: async () => new Response('', { status: 404 }) },
    }
    // La base "llama" a la web por esta dirección; acá los pedidos se entregan a mano (ver despachar).
    await acceso.admin('select public.configurar_push($1, $2)', ['https://haxmatch.ensayo/api/push/enviar', claves.secreto])
    // Lo que la web le pediría a TikTok o a los servicios de avisos se queda acá adentro.
    const internet = globalThis.fetch
    globalThis.fetch = async (url, opciones) => {
      const destino = String(url instanceof Request ? url.url : url)
      const deTikTok = tiktok.atender(destino, opciones)
      if (deTikTok) return deTikTok
      if (/^https:\/\/(fcm\.googleapis\.com|[a-z0-9-]+\.push\.apple\.com|updates\.push\.services\.mozilla\.com)\//.test(destino)) {
        empujes.push({ url: destino, ...opciones })
        return new Response(null, { status: 201 })
      }
      return internet(url, opciones)
    }
  }

  /** pg_net de mentira: le entrega a la web los pedidos que la base dejó anotados. */
  let despachando = Promise.resolve()
  function despachar() {
    if (!worker) return Promise.resolve()
    despachando = despachando.then(async () => {
      const filas = await acceso.admin('delete from net.pedidos returning id, url, body, headers')
      for (const f of filas.sort((a, b) => Number(a.id) - Number(b.id))) {
        const r = await worker.fetch(new Request(f.url, { method: 'POST', headers: f.headers, body: JSON.stringify(f.body) }), entorno, {})
        await acceso.admin('insert into net._http_response (id, status_code, content) values ($1, $2, $3)', [f.id, r.status, await r.text()])
      }
    }).catch((e) => console.error('ensayo: falló un pedido de la base a la web:', e.message))
    return despachando
  }

  /** El usuario sale del nombre que manda la app. La primera vez se da de alta, como si entrara con Discord. */
  async function usuarioDe(nombre) {
    if (!/^[a-z0-9_]{2,20}$/i.test(nombre ?? '')) throw new Error('Usuario de ensayo no válido')
    if (!usuarios.has(nombre)) {
      const u = {
        id: `00000000-0000-0000-0000-${String(usuarios.size + 1).padStart(12, '0')}`,
        usuario: nombre,
        nombre: nombre[0].toUpperCase() + nombre.slice(1),
      }
      usuarios.set(nombre, u)
      await acceso.admin('insert into auth.users values ($1) on conflict do nothing', [u.id])
    }
    return usuarios.get(nombre)
  }

  /** Si la señal de cambios se movió, les avisa a las apps abiertas (lo que en Supabase hace Realtime). */
  async function avisar() {
    const [{ version: v }] = await acceso.admin('select version from public.cambios where id = 1')
    if (String(v) === String(version)) return
    version = v
    for (const r of oyentes) r.write(`data: ${v}\n\n`)
  }

  const servidor = http.createServer(async (req, res) => {
    const responder = (estado, cuerpo) => {
      res.writeHead(estado, { ...CORS, 'content-type': 'application/json' })
      res.end(JSON.stringify(cuerpo))
    }
    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, CORS)
        return res.end()
      }
      if (req.method === 'GET' && req.url === '/cambios') {
        res.writeHead(200, { ...CORS, 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' })
        res.write(': conectado\n\n')
        oyentes.add(res)
        req.on('close', () => oyentes.delete(res))
        return
      }
      // Lo que la web le pregunta a Supabase: de quién es una sesión.
      if (req.method === 'GET' && req.url === '/auth/v1/user') {
        const nombre = /^Bearer ensayo:([a-z0-9_]+)$/i.exec(req.headers.authorization ?? '')?.[1]
        const u = nombre ? usuarios.get(nombre) : null
        return u ? responder(200, { id: u.id }) : responder(401, { message: 'sesión no válida' })
      }
      // La web llama a las funciones como lo haría contra Supabase: sin usuario, con su clave.
      const deLaWeb = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(req.url ?? '')?.[1]
      const funcion = deLaWeb ?? /^\/rpc\/([a-z_]+)$/.exec(req.url ?? '')?.[1]
      if (req.method !== 'POST' || !funcion) return responder(404, { error: 'No existe' })
      let texto = ''
      for await (const parte of req) texto += parte
      if (deLaWeb) {
        try {
          const dato = await acceso.rpc(null, funcion, texto ? JSON.parse(texto) : {})
          await avisar()
          res.writeHead(200, { ...CORS, 'content-type': 'application/json' })
          return res.end(JSON.stringify(dato ?? null))
        } catch (e) {
          return responder(400, { message: e instanceof Error ? e.message : 'Error', code: 'P0001' })
        }
      }
      // quien_invita se puede llamar sin haber entrado; el resto necesita un usuario.
      const u = funcion === 'quien_invita' ? null : await usuarioDe(req.headers['x-usuario'])
      const data = await acceso.rpc(u, funcion, texto ? JSON.parse(texto) : {})
      await avisar()
      // No se espera: en la vida real la base contesta y el pedido a la web sale después.
      void despachar()
      responder(200, { data })
    } catch (e) {
      responder(400, { error: e instanceof Error ? e.message : 'Error' })
    }
  })
  await new Promise((listo) => servidor.listen(puerto, listo))

  return {
    acceso,
    avisar,
    tiktok,
    empujes,
    /** Atiende un pedido a /api/... como lo haría la web publicada. */
    web: (request) => worker.fetch(request, entorno, {}),
    /** Espera a que la web termine de atender lo que le pidió la base. */
    alDia: () => despachar(),
    usuario: (nombre) => usuarios.get(nombre),
    cerrar: () => new Promise((listo) => {
      for (const r of oyentes) r.end()
      servidor.close(listo)
      servidor.closeAllConnections?.()
    }),
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const puerto = Number(process.env.PUERTO ?? 8787)
  await iniciarEnsayo(puerto)
  console.log(`Servidor de ensayo en http://localhost:${puerto} (Ctrl+C para cerrarlo)`)
}

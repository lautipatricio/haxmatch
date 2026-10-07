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

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, x-usuario',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
}

export async function iniciarEnsayo(puerto = 8787) {
  const db = await crearBase({ silencioso: true })
  const acceso = crearAcceso(db)
  const usuarios = new Map()
  const oyentes = new Set()
  let version = null

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
      const funcion = /^\/rpc\/([a-z_]+)$/.exec(req.url ?? '')?.[1]
      if (req.method !== 'POST' || !funcion) return responder(404, { error: 'No existe' })
      let texto = ''
      for await (const parte of req) texto += parte
      // quien_invita se puede llamar sin haber entrado; el resto necesita un usuario.
      const u = funcion === 'quien_invita' ? null : await usuarioDe(req.headers['x-usuario'])
      const data = await acceso.rpc(u, funcion, texto ? JSON.parse(texto) : {})
      await avisar()
      responder(200, { data })
    } catch (e) {
      responder(400, { error: e instanceof Error ? e.message : 'Error' })
    }
  })
  await new Promise((listo) => servidor.listen(puerto, listo))

  return {
    acceso,
    avisar,
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

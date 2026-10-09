// Ensayo de la versión que se publica (la carpeta dist, la que habla con Supabase).
// Desde esta computadora no se puede llegar a Supabase, así que el navegador de
// prueba intercepta lo que la app le manda a Supabase y lo responde con el
// servidor de ensayo local. Nada sale a internet. Sirve para comprobar que la
// app publicada llama a las funciones con los nombres y datos correctos.
// No prueba el ingreso con Discord ni los avisos en tiempo real: eso se prueba
// en la web publicada.
// Uso: npm run build && node scripts/ensayo-produccion.mjs
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { iniciarEnsayo } from './servidor-ensayo.mjs'

const PUERTO_APP = 4175
const PUERTO_SERVIDOR = 8788
const URL = `http://localhost:${PUERTO_APP}`
const SUPABASE = /^VITE_SUPABASE_URL=(.+)$/m.exec(readFileSync('.env.production', 'utf8'))?.[1].trim()
if (!SUPABASE) throw new Error('Falta VITE_SUPABASE_URL en .env.production')
const proyecto = new globalThis.URL(SUPABASE).hostname.split('.')[0]

const servidor = await iniciarEnsayo(PUERTO_SERVIDOR)
const web = spawn('npx', ['vite', 'preview', '--outDir', 'dist', '--port', String(PUERTO_APP), '--strictPort'], { stdio: 'ignore' })
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {})
const llamadas = new Set()

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')

async function abrir(nombre) {
  // Da de alta al usuario en el servidor local para conocer su id.
  await fetch(`http://localhost:${PUERTO_SERVIDOR}/rpc/mi_perfil`, { method: 'POST', headers: { 'x-usuario': nombre }, body: '{}' })
  const id = servidor.usuario(nombre).id
  const vence = Math.floor(Date.now() / 1000) + 3600
  // Sesión de mentira, con la forma que guarda Supabase en el navegador.
  const sesion = {
    access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: id, role: 'authenticated', aud: 'authenticated', exp: vence })}.firma`,
    refresh_token: 'ensayo', token_type: 'bearer', expires_in: 3600, expires_at: vence,
    user: { id, aud: 'authenticated', role: 'authenticated', email: `${nombre}@ensayo.local`, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
  }
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })
  await ctx.addInitScript(([clave, valor]) => localStorage.setItem(clave, valor), [`sb-${proyecto}-auth-token`, JSON.stringify(sesion)])
  const page = await ctx.newPage()
  await page.routeWebSocket(/supabase\.co/, (ws) => ws.close())
  await page.route(/supabase\.co/, async (ruta) => {
    const pedido = ruta.request()
    const funcion = /\/rest\/v1\/rpc\/([a-z_]+)/.exec(pedido.url())?.[1]
    if (pedido.method() === 'OPTIONS') return ruta.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
    if (!funcion) return ruta.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: '{"message":"fuera del ensayo"}' })
    llamadas.add(funcion)
    const r = await fetch(`http://localhost:${PUERTO_SERVIDOR}/rpc/${funcion}`, { method: 'POST', headers: { 'x-usuario': nombre }, body: pedido.postData() ?? '{}' })
    const cuerpo = await r.json()
    // Misma forma que responde Supabase: el dato pelado, o un error con "message".
    return ruta.fulfill({
      status: r.ok ? 200 : 400, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json',
      body: r.ok ? JSON.stringify(cuerpo.data ?? null) : JSON.stringify({ message: cuerpo.error, code: 'P0001' }),
    })
  })
  const u = {
    page,
    boton: (t) => page.getByRole('button', { name: t, exact: true }),
    link: (t) => page.getByRole('link', { name: t, exact: true }),
    ver: (t, timeout = 20000) => page.getByText(t, { exact: false }).first().waitFor({ timeout }),
  }
  await page.goto(URL)
  await u.ver('Bienvenido')
  await u.boton('Empezar').click()
  await u.ver('Quiero jugar un amistoso')
  return u
}

try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(URL)).ok) break } catch { await new Promise((r) => setTimeout(r, 250)) }
  }
  console.log('· Versión publicada: sala, invitación, match y confirmación entre dos usuarios')
  const ana = await abrir('ana')
  const beto = await abrir('beto')
  await ana.link('Necesito un jugador').click()
  await ana.boton('Futsal').click()
  await ana.boton('Buscar jugador').click()
  await ana.ver('Escribí el nombre de la sala')
  await ana.page.getByLabel('Nombre de la sala').fill('sala de ana')
  await ana.boton('Buscar jugador').click()
  await ana.ver('Buscando jugador')
  // Un toque y a la cola, sin formulario.
  await beto.boton('Quiero jugar un amistoso').click()
  await beto.ver('Jugadores buscando partidos')
  // Beto se va a mirar clips. Ana lo elige de su lista y a él la invitación le llega como aviso.
  await beto.page.locator('.tabbar a', { hasText: 'Clips' }).click()
  await ana.page.locator('.card--row', { hasText: 'Beto' }).getByRole('button', { name: 'Invitar' }).click()
  await beto.ver('Ana te invita a su sala')
  await beto.boton('Aceptar').click()
  await beto.ver('Sala de Ana')
  await beto.boton('Entendido').click()
  await ana.boton('Ya entró Beto a la sala').last().click()
  await ana.ver('Tu sala está completa')
  await beto.boton('Ya entré a la sala').click()
  await beto.ver('Partido válido · +10 puntos')
  await ana.ver('Partido válido · +10 puntos')
  // Un error del servidor se muestra tal cual.
  await beto.link('Reportar a Ana').click()
  await beto.boton('Enviar reporte').click()
  await beto.ver('Reporte enviado')
  // Sin las funciones nuevas en la base (falta ejecutar el SQL), la app lo dice claro.
  const esperadas = ['mi_perfil', 'completar_registro', 'estado_app', 'crear_busqueda', 'enviar_mensaje', 'responder_mensaje', 'marcar_entro', 'confirmar_match', 'reportar']
  const faltan = esperadas.filter((f) => !llamadas.has(f))
  if (faltan.length) throw new Error(`La app no llamó a: ${faltan.join(', ')}`)
  console.log('\nVersión publicada: todo bien.')
} catch (e) {
  console.error('\nFALLÓ:', e.message)
  let i = 0
  for (const ctx of browser.contexts()) await ctx.pages()[0]?.screenshot({ path: `falla-produccion-${i++}.png` }).catch(() => {})
  process.exitCode = 1
} finally {
  await browser.close()
  web.kill()
  await servidor.cerrar()
}

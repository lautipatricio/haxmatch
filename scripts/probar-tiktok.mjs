// Prueba la vinculación con TikTok de punta a punta, sin tocar el TikTok real:
// la parte de servidor de la web (worker/tiktok.js) contra la base local y un
// TikTok de mentira que responde como dice su documentación.
// Uso: npm run test:tiktok
import { iniciarEnsayo } from './servidor-ensayo.mjs'

const s = await iniciarEnsayo(8789, { conWeb: true })
const WEB = 'https://haxmatch.ejemplo.dev'
let fallas = 0
const ok = (cond, texto) => { console.log(`${cond ? '  ✓' : '  ✗'} ${texto}`); if (!cond) fallas++ }
const titulo = (t) => console.log(`\n${t}`)

// Usuarios de la app (se dan de alta al pedir su perfil, como en el ensayo).
const app = async (nombre, funcion, args = {}) => {
  const r = await fetch(`http://localhost:8789/rpc/${funcion}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-usuario': nombre }, body: JSON.stringify(args) })
  const d = await r.json()
  if (!r.ok) throw new Error(d.error)
  await s.alDia()
  return d.data
}
for (const n of ['ana', 'beto']) { await app(n, 'mi_perfil'); await app(n, 'completar_registro', { p_nick: n, p_region: ['ARG'] }) }
const clips = (n) => app(n, 'clips')

const pedir = (ruta, opciones = {}) => s.web(new Request(`${WEB}${ruta}`, opciones))
const entrar = (nombre, extra = {}) => pedir('/api/tiktok/entrar', { method: 'POST', headers: { authorization: `Bearer ensayo:${nombre}`, origin: WEB, ...extra } })
/** Hace el recorrido completo como el navegador de un usuario. Devuelve a dónde lo manda la web al final. */
async function vincular(nombre, cuentaTikTok, { cambiarEstado, sinGalleta, rechazar } = {}) {
  const r = await entrar(nombre)
  const { url } = await r.json()
  const galleta = (r.headers.get('set-cookie') ?? '').split(';')[0]
  const ida = new URL(url)
  const vuelta = new URL(ida.searchParams.get('redirect_uri'))
  if (rechazar) vuelta.searchParams.set('error', 'access_denied')
  else vuelta.searchParams.set('code', `codigo-${cuentaTikTok}`)
  vuelta.searchParams.set('scopes', 'user.info.basic,video.list')
  vuelta.searchParams.set('state', cambiarEstado ?? ida.searchParams.get('state'))
  const fin = await s.web(new Request(vuelta, { headers: sinGalleta ? {} : { cookie: galleta } }))
  return { estado: fin.status, destino: fin.headers.get('location'), ida, galleta: r.headers.get('set-cookie') }
}

titulo('Empezar la vinculación')
ok((await (await pedir('/api/tiktok/estado')).json()).configurado === true, 'la web avisa que TikTok está habilitado')
ok((await pedir('/api/tiktok/entrar', { method: 'POST' })).status === 401, 'sin sesión no se puede empezar')
ok((await entrar('nadie')).status === 401, 'ni con una sesión que no existe')
ok((await entrar('ana', { origin: 'https://otro-sitio.example' })).status === 403, 'ni desde otra página')
s.tiktok.publicar('ana_tt', 'Golazo desde mitad de cancha #haxball', 7200)
s.tiktok.publicar('ana_tt', 'Cumple de mi hermana', 3600)
s.tiktok.publicar('ana_tt', 'Atajadas de la semana #HaxMatch #gk', 600)
let v = await vincular('ana', 'ana_tt')
ok(v.ida.origin + v.ida.pathname === 'https://www.tiktok.com/v2/auth/authorize/' && v.ida.searchParams.get('client_key') === 'clave-de-prueba'
  && v.ida.searchParams.get('scope') === 'user.info.basic,video.list' && v.ida.searchParams.get('response_type') === 'code'
  && v.ida.searchParams.get('redirect_uri') === `${WEB}/api/tiktok/volver`, 'manda al usuario a TikTok con los datos que pide su documentación')
ok(!v.ida.search.includes('secreto-de-prueba') && /HttpOnly; Secure; SameSite=Lax/.test(v.galleta), 'la clave secreta nunca viaja al navegador, y el código queda guardado de forma segura')

titulo('Volver de TikTok')
ok(v.estado === 302 && v.destino === `${WEB}/clips/mis-videos?tiktok=ok`, 'al volver, lo deja en Mis videos')
let c = await clips('ana')
ok(c.tiktok?.vinculada && c.tiktok.nombre === 'ana_tt', 'la cuenta queda vinculada, con su nombre de TikTok')
ok(c.mios.length === 3 && c.mios.every((r) => r.inicial), 'se importan todos sus videos a la biblioteca')
ok(c.feed.length === 2 && c.feed[0].titulo.startsWith('Atajadas') && c.feed[0].enlace.includes('tiktok.com/@ana_tt/video/'), 'en Clips aparecen solo los que tienen #haxball o #haxmatch, con su enlace')
ok((await clips('beto')).feed.length === 2, 'los demás usuarios los ven')
ok(!JSON.stringify(c).includes('acc-ana_tt') && !JSON.stringify(c).includes('ref-ana_tt'), 'las llaves de TikTok no aparecen en nada de lo que recibe la app')

titulo('Lo que no tiene que funcionar')
ok((await vincular('beto', 'beto_tt', { rechazar: true })).destino.endsWith('tiktok=cancelado'), 'si el usuario dice que no en TikTok, no se vincula nada')
ok((await vincular('beto', 'beto_tt', { sinGalleta: true })).destino.endsWith('tiktok=vencido'), 'un regreso que no viene del mismo navegador que empezó se descarta')
ok((await vincular('beto', 'beto_tt', { cambiarEstado: 'a'.repeat(64) })).destino.endsWith('tiktok=vencido'), 'también si el código de vuelta no es el que salió')
ok((await clips('beto')).tiktok === null, 'y en ningún caso quedó nada guardado')
ok((await vincular('beto', 'ana_tt')).destino.endsWith('tiktok=ocupada') && (await clips('beto')).tiktok === null, 'la misma cuenta de TikTok no se puede vincular a dos usuarios')
for (const ruta of ['/api/tiktok/sincronizar', '/api/tiktok/revocar']) {
  const r = await pedir(ruta, { method: 'POST', headers: { 'content-type': 'application/json', 'x-haxmatch-secreto': 'x'.repeat(43) }, body: '{}' })
  ok(r.status === 401, `${ruta} solo obedece a la base (con la clave compartida)`)
}

titulo('Actualizar los videos')
const nuevo = s.tiktok.publicar('ana_tt', 'Triple pared y adentro #haxmatch', 10)
ok((await app('ana', 'tiktok_actualizar')) === 'pedido', 'el usuario pide actualizar')
c = await clips('ana')
ok(c.mios.length === 4 && c.mios.find((r) => r.tiktok_id === nuevo)?.inicial === false && c.feed[0].tiktok_id === nuevo, 'el video nuevo aparece en su biblioteca y en Clips')
await s.acceso.admin('update public.tiktok_cuentas set pedida_at = null')
s.tiktok.borrar('ana_tt', nuevo)
await app('ana', 'tiktok_actualizar')
ok((await clips('ana')).mios.length === 3, 'si lo borra en TikTok, desaparece de HaxMatch')

titulo('Llaves que vencen')
const antes = (await s.acceso.admin('select access_token from public.tiktok_cuentas'))[0].access_token
await s.acceso.admin(`update public.tiktok_cuentas set pedida_at = null, expira_at = now() + interval '1 minute'`)
s.tiktok.publicar('ana_tt', 'Contra letal #haxball', 5)
await app('ana', 'tiktok_actualizar')
const despues = (await s.acceso.admin('select access_token, error from public.tiktok_cuentas'))[0]
ok(despues.access_token !== antes && despues.error === null && (await clips('ana')).mios.length === 4, 'si la llave está por vencer, se renueva sola, se guarda la nueva y se traen los videos')
await s.acceso.admin('update public.tiktok_cuentas set pedida_at = null')
s.tiktok.vencer('ana_tt')
s.tiktok.publicar('ana_tt', 'Gol olímpico #haxball', 2)
await app('ana', 'tiktok_actualizar')
ok((await clips('ana')).mios.length === 5, 'si la llave dejó de valer antes de tiempo, también se renueva y se reintenta')
await s.acceso.admin('update public.tiktok_cuentas set pedida_at = null')
s.tiktok.quitarPermiso('ana_tt')
await app('ana', 'tiktok_actualizar')
c = await clips('ana')
ok(/Volvé a vincular/.test(c.tiktok.error ?? '') && c.mios.length === 5, 'si el usuario quitó el permiso desde TikTok, la app le pide que vuelva a vincular (sin perder lo que ya estaba)')
ok((await vincular('ana', 'ana_tt')).destino.endsWith('tiktok=ok') && (await clips('ana')).tiktok.error === null, 'y al vincular de nuevo queda todo en orden')

titulo('Cuando TikTok anda mal')
const cuentaDeAna = async () => (await s.acceso.admin(`select access_token, refresh_token, error from public.tiktok_cuentas where nombre = 'ana_tt'`))[0]
const reintentar = () => s.acceso.admin('update public.tiktok_cuentas set pedida_at = null')
const cuantos = (await clips('ana')).mios.length
await reintentar(); await s.acceso.admin(`update public.tiktok_cuentas set expira_at = now() + interval '1 minute' where nombre = 'ana_tt'`)
s.tiktok.averiar('/v2/oauth/token/', 502)
await app('ana', 'tiktok_actualizar')
ok((await cuentaDeAna()).error === null, 'una caída de TikTok al renovar las llaves no marca la cuenta como desvinculada')
await reintentar()
const vieja = (await cuentaDeAna()).refresh_token
s.tiktok.averiar('/v2/video/list/', 429, { error: { code: 'rate_limit_exceeded', message: 'x', log_id: 'x' } })
await app('ana', 'tiktok_actualizar')
let ca = await cuentaDeAna()
ok(ca.refresh_token !== vieja && ca.error === null, 'si se renovaron las llaves y después falló otra cosa, las llaves nuevas igual quedan guardadas')
await reintentar()
await app('ana', 'tiktok_actualizar')
ok((await cuentaDeAna()).error === null && (await clips('ana')).mios.length === cuantos, 'y la actualización siguiente funciona con ellas')
await reintentar()
s.tiktok.averiar('/v2/video/list/', 200, {})
await app('ana', 'tiktok_actualizar')
ok((await clips('ana')).mios.length === cuantos, 'una respuesta rara de TikTok no se toma como "no tiene videos": la biblioteca queda intacta')
await reintentar()
s.tiktok.averiar('/v2/video/list/', 200, '<html>mantenimiento</html>')
await app('ana', 'tiktok_actualizar')
ok((await clips('ana')).mios.length === cuantos && (await cuentaDeAna()).error === null, 'tampoco una página de error')
await reintentar()

titulo('Muchos videos')
for (let i = 0; i < 45; i++) s.tiktok.publicar('beto_tt', i % 2 ? `clip ${i} #haxball` : `otro ${i}`, 100 + i)
await vincular('beto', 'beto_tt')
c = await clips('beto')
ok(c.mios.length === 45 && c.feed.filter((r) => r.nick === 'beto').length === 22, 'trae todas las páginas de videos (TikTok los da de a 20)')

titulo('Desvincular')
const llave = (await s.acceso.admin(`select access_token from public.tiktok_cuentas where nombre = 'ana_tt'`))[0].access_token
await app('ana', 'tiktok_desvincular')
c = await clips('ana')
ok(c.tiktok === null && c.mios.length === 0 && !c.feed.some((r) => r.nick === 'ana'), 'se borran sus llaves y sus videos de HaxMatch')
ok(s.tiktok.atender('https://open.tiktokapis.com/v2/user/info/?fields=open_id', { headers: { Authorization: `Bearer ${llave}` } }).status === 401, 'y TikTok anuló el permiso: esa llave ya no sirve')
// Con la llave de acceso ya vencida (pasó más de un día), el permiso se anula igual.
const renovacion = (await s.acceso.admin(`select refresh_token from public.tiktok_cuentas where nombre = 'beto_tt'`))[0].refresh_token
s.tiktok.vencer('beto_tt')
await app('beto', 'tiktok_desvincular')
const intento = await s.tiktok.atender('https://open.tiktokapis.com/v2/oauth/token/', { body: new URLSearchParams({ client_key: 'clave-de-prueba', client_secret: 'secreto-de-prueba', grant_type: 'refresh_token', refresh_token: renovacion }).toString() })
ok(intento.status === 400 && (await clips('beto')).tiktok === null, 'aunque la llave de acceso ya hubiera vencido, al desvincular el permiso queda anulado en TikTok')

titulo('Sin las claves de TikTok cargadas')
const sinClaves = (await import('../worker/index.js')).default
const r0 = await sinClaves.fetch(new Request(`${WEB}/api/tiktok/estado`), { ASSETS: {} }, {})
ok((await r0.json()).configurado === false, 'la web avisa que TikTok todavía no está habilitado')
ok((await sinClaves.fetch(new Request(`${WEB}/api/tiktok/entrar`, { method: 'POST', headers: { authorization: 'Bearer x' } }), { ASSETS: {} }, {})).status === 503, 'y no deja empezar una vinculación')

console.log(fallas ? `\n${fallas} comprobaciones fallaron.` : '\nTodo bien.')
await s.cerrar()
process.exit(fallas ? 1 : 0)

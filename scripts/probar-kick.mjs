// Prueba la vinculación con Kick y el "en vivo" de punta a punta, sin tocar el Kick
// real: la parte de servidor de la web (worker/kick.js) contra la base local y un
// Kick de mentira que responde como dice su documentación.
// Uso: npm run test:kick
import { iniciarEnsayo } from './servidor-ensayo.mjs'

const s = await iniciarEnsayo(8790, { conWeb: true })
const WEB = 'https://haxmatch.ejemplo.dev'
let fallas = 0
const ok = (cond, texto) => { console.log(`${cond ? '  ✓' : '  ✗'} ${texto}`); if (!cond) fallas++ }
const titulo = (t) => console.log(`\n${t}`)

const app = async (nombre, funcion, args = {}) => {
  const r = await fetch(`http://localhost:8790/rpc/${funcion}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-usuario': nombre }, body: JSON.stringify(args) })
  const d = await r.json()
  if (!r.ok) throw new Error(d.error)
  return d.data
}
const falla = async (texto, fn) => {
  try { await fn(); ok(false, `${texto} (tenía que fallar y no falló)`) } catch (e) { ok(true, `${texto} → "${String(e.message).slice(0, 60)}"`) }
}
for (const n of ['ana', 'beto', 'caro']) { await app(n, 'mi_perfil'); await app(n, 'completar_registro', { p_nick: n, p_region: ['ARG'] }) }
const canales = (n) => app(n, 'kick_canales')
const de = async (n, quien) => (await canales(n)).find((c) => c.user_id === s.usuario(quien).id)

const pedir = (ruta, opciones = {}) => s.web(new Request(`${WEB}${ruta}`, opciones))
const entrar = (nombre, extra = {}) => pedir('/api/kick/entrar', { method: 'POST', headers: { authorization: `Bearer ensayo:${nombre}`, origin: WEB, ...extra } })
/** Hace el recorrido completo como el navegador de un usuario. Devuelve a dónde lo manda la web al final. */
async function vincular(nombre, cuentaKick, { cambiarEstado, sinGalleta, rechazar } = {}) {
  const r = await entrar(nombre)
  const { url } = await r.json()
  const galleta = (r.headers.get('set-cookie') ?? '').split(';')[0]
  const ida = new URL(url)
  const vuelta = new URL(ida.searchParams.get('redirect_uri'))
  if (rechazar) vuelta.searchParams.set('error', 'access_denied')
  else vuelta.searchParams.set('code', s.kick.autorizar(cuentaKick, ida.searchParams.get('code_challenge')))
  vuelta.searchParams.set('state', cambiarEstado ?? ida.searchParams.get('state'))
  const fin = await s.web(new Request(vuelta, { headers: sinGalleta ? {} : { cookie: galleta } }))
  return { destino: fin.headers.get('location'), ida, galleta: r.headers.get('set-cookie') }
}

titulo('Empezar la vinculación')
ok((await (await pedir('/api/kick/estado')).json()).configurado === true, 'la web avisa que Kick está habilitado')
ok((await pedir('/api/kick/entrar', { method: 'POST' })).status === 401, 'sin sesión no se puede empezar')
ok((await entrar('nadie')).status === 401, 'ni con una sesión que no existe')
ok((await entrar('ana', { origin: 'https://otro-sitio.example' })).status === 403, 'ni desde otra página')
s.kick.enVivo('ana_kick', true, 'Amistosos de HaxBall')
let v = await vincular('ana', 'ana_kick')
ok(v.ida.origin + v.ida.pathname === 'https://id.kick.com/oauth/authorize' && v.ida.searchParams.get('client_id') === 'kick-id-de-prueba'
  && v.ida.searchParams.get('scope') === 'user:read' && v.ida.searchParams.get('response_type') === 'code'
  && v.ida.searchParams.get('code_challenge_method') === 'S256' && /^[A-Za-z0-9_-]{43}$/.test(v.ida.searchParams.get('code_challenge'))
  && v.ida.searchParams.get('redirect_uri') === `${WEB}/api/kick/volver`, 'manda al usuario a Kick con lo que pide su documentación (solo el permiso user:read, con PKCE)')
ok(!v.ida.search.includes('kick-secreto-de-prueba') && /HttpOnly; Secure; SameSite=Lax/.test(v.galleta), 'la clave secreta nunca viaja al navegador, y el código queda guardado de forma segura')

titulo('Volver de Kick')
ok(v.destino === `${WEB}/perfil?kick=ok`, 'al volver, lo deja en el Perfil')
let a = await de('beto', 'ana')
ok(a?.usuario === 'ana_kick' && a.slug === 'ana_kick' && a.nick === 'ana', 'la cuenta queda vinculada: los demás ven su usuario y su canal')
ok(a.en_vivo === true && a.titulo === 'Amistosos de HaxBall', 'si estaba en vivo al vincular, ya figura en vivo')
const llaveUsuario = s.kick.pedidos.find((p) => p.ruta === '/public/v1/users')?.bearer
ok(llaveUsuario && s.kick.anuladas.has(llaveUsuario) && s.kick.anuladas.has(`ref-${llaveUsuario}`), 'la llave del usuario se usa una vez y se anula (también la de renovación)')
const guardado = await s.acceso.admin('select * from public.kick_cuentas')
ok(!JSON.stringify(guardado).includes('@correo.test') && !JSON.stringify(guardado).includes(llaveUsuario), 'no se guarda su mail ni ninguna llave')
ok((await s.acceso.admin('select count(*)::int as n from public.kick_estados'))[0].n === 0, 'el código de comprobación se borra al usarlo')

titulo('Lo que no tiene que vincular')
ok((await vincular('beto', 'ana_kick')).destino.endsWith('?kick=ocupada'), 'una cuenta de Kick que ya usa otro jugador no se puede vincular')
ok((await vincular('beto', 'beto_kick', { rechazar: true })).destino.endsWith('?kick=cancelado'), 'si no da el permiso, no se vincula')
ok((await vincular('beto', 'beto_kick', { sinGalleta: true })).destino.endsWith('?kick=vencido'), 'sin el código guardado en su navegador, no se vincula')
ok((await vincular('beto', 'beto_kick', { cambiarEstado: 'f'.repeat(64) })).destino.endsWith('?kick=vencido'), 'con un código cambiado, tampoco')
// Alguien que intercepta el código de Kick no puede usarlo sin el verificador (PKCE).
const r = await entrar('beto')
const ida = new URL((await r.json()).url)
const vuelta = new URL(ida.searchParams.get('redirect_uri'))
vuelta.searchParams.set('code', s.kick.autorizar('beto_kick', 'otro-desafio'))
vuelta.searchParams.set('state', ida.searchParams.get('state'))
ok((await s.web(new Request(vuelta, { headers: { cookie: (r.headers.get('set-cookie') ?? '').split(';')[0] } }))).headers.get('location').endsWith('?kick=error'), 'un código que no corresponde al verificador no sirve')
ok(!(await de('ana', 'beto')), 'beto sigue sin Kick vinculado')
ok((await vincular('beto', 'beto_kick')).destino.endsWith('?kick=ok') && (await de('ana', 'beto'))?.en_vivo === false, 'con todo bien, se vincula (fuera de vivo)')

titulo('Quién está en vivo')
s.kick.enVivo('beto_kick', true, 'Practicando GK')
s.kick.enVivo('ana_kick', false)
await s.revisarKick()
ok((await de('caro', 'beto')).en_vivo === true && (await de('caro', 'beto')).titulo === 'Practicando GK', 'al revisar, el que empezó un directo figura en vivo, con el título')
ok((await de('caro', 'ana')).en_vivo === false && (await de('caro', 'ana')).titulo === null, 'y el que terminó deja de figurar')
const desde = (await de('caro', 'beto')).vivo_desde
await s.revisarKick()
ok((await de('caro', 'beto')).vivo_desde === desde, 'mientras sigue en vivo, la hora de inicio no cambia')
s.kick.caer()
s.kick.enVivo('beto_kick', false)
await s.revisarKick()
ok((await de('caro', 'beto')).en_vivo === true, 'si Kick no contesta, nadie cambia de estado')
s.kick.caer(false)
await s.revisarKick()
ok((await de('caro', 'beto')).en_vivo === false, 'cuando vuelve a contestar, se corrige')
ok((await de('caro', 'ana')).slug === 'ana_kick' && (await canales('caro')).length === 2, 'la lista trae a todos los vinculados')
s.kick.enVivo('beto_kick', true, 'Otro directo')
await s.revisarKick()
await s.acceso.admin(`update public.kick_cuentas set revisada_at = now() - interval '11 minutes'`)
ok((await de('caro', 'beto')).en_vivo === false && (await de('caro', 'beto')).titulo === null, 'si hace rato que Kick no contesta por un canal, deja de figurar en vivo')
await s.revisarKick()
ok((await de('caro', 'beto')).en_vivo === true, 'y vuelve a figurar cuando Kick contesta')
await s.acceso.admin(`update public.profiles set suspendido_hasta = now() + interval '1 day' where id = $1`, [s.usuario('beto').id])
ok(!(await de('caro', 'beto')), 'una cuenta suspendida no aparece')
await s.acceso.admin('update public.profiles set suspendido_hasta = null where id = $1', [s.usuario('beto').id])

titulo('Permisos')
await falla('la app no puede leer las tablas de Kick', () => s.acceso.sql(s.usuario('caro'), 'select * from public.kick_cuentas'))
await falla('ni anotar a alguien en vivo sin la clave', () => app('caro', 'kick_vivos', { p_secreto: 'cualquiera', p_canales: [] }))
await falla('ni vincular una cuenta sin la clave', () => app('caro', 'kick_guardar', { p_secreto: 'x', p_user: s.usuario('caro').id, p_kick_id: 1, p_usuario: 'x', p_slug: 'x', p_en_vivo: true, p_titulo: '' }))
await app('caro', 'bloquear', { p_user: s.usuario('beto').id })
ok(!(await de('caro', 'beto')) && !(await de('beto', 'caro')), 'con un bloqueo de por medio, no se ve su canal')
await app('caro', 'desbloquear', { p_user: s.usuario('beto').id })

titulo('Desvincular')
await app('beto', 'kick_desvincular')
ok(!(await de('ana', 'beto')), 'al desvincular, deja de figurar')
await app('ana', 'borrar_cuenta')
ok((await s.acceso.admin('select count(*)::int as n from public.kick_cuentas'))[0].n === 0, 'al borrar la cuenta, se borra su Kick')

await s.cerrar()
console.log(fallas ? `\n${fallas} comprobaciones fallaron.` : '\nTodo bien.')
process.exit(fallas ? 1 : 0)

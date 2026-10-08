// Prueba la parte de servidor de la web (worker/index.js) sin publicarla:
// que el aviso quede cifrado como lo espera un celular, que la firma sea válida
// y que /api/push/enviar solo obedezca a quien tiene la clave compartida.
// El "celular" de la prueba está hecho con otra librería (la de Node), así el
// cifrado y el descifrado no comparten código.
// Uso: npm run test:push
import { createDecipheriv, createECDH, createPublicKey, hkdfSync, randomBytes, verify } from 'node:crypto'
import worker, { aBase64Url, cifrar, deBase64Url, firmaVapid, nuevasClaves } from '../worker/index.js'

let fallas = 0
const ok = (cond, texto) => { console.log(`${cond ? '  ✓' : '  ✗'} ${texto}`); if (!cond) fallas++ }

/** Un celular de mentira: tiene sus claves y sabe descifrar lo que le llega (RFC 8291). */
function celular(nombre = 'a') {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  const auth = randomBytes(16)
  return {
    suscripcion: { endpoint: `https://fcm.googleapis.com/fcm/send/${nombre}`, p256dh: aBase64Url(ecdh.getPublicKey()), auth: aBase64Url(auth) },
    descifrar(cuerpo) {
      const b = Buffer.from(cuerpo)
      const sal = b.subarray(0, 16)
      const largoClave = b[20]
      const suPublica = b.subarray(21, 21 + largoClave)
      const cifrado = b.subarray(21 + largoClave)
      const compartido = ecdh.computeSecret(suPublica)
      const info = Buffer.concat([Buffer.from('WebPush: info\0'), ecdh.getPublicKey(), suPublica])
      const ikm = Buffer.from(hkdfSync('sha256', compartido, auth, info, 32))
      const clave = Buffer.from(hkdfSync('sha256', ikm, sal, Buffer.from('Content-Encoding: aes128gcm\0'), 16))
      const nonce = Buffer.from(hkdfSync('sha256', ikm, sal, Buffer.from('Content-Encoding: nonce\0'), 12))
      const d = createDecipheriv('aes-128-gcm', clave, nonce)
      d.setAuthTag(cifrado.subarray(cifrado.length - 16))
      const claro = Buffer.concat([d.update(cifrado.subarray(0, cifrado.length - 16)), d.final()])
      if (claro[claro.length - 1] !== 2) throw new Error('Falta la marca de último bloque')
      return { texto: claro.subarray(0, -1).toString('utf8'), bloque: b.readUInt32BE(16) }
    },
  }
}

console.log('\nCifrado')
const tel = celular()
const mensaje = JSON.stringify({ titulo: 'Match listo con Ñandú ⚽', cuerpo: 'Sala "los pibes"', url: '/match/1', tag: 'match' })
const cifrado = await cifrar(tel.suscripcion, mensaje)
const leido = tel.descifrar(cifrado)
ok(leido.texto === mensaje && leido.bloque === 4096, 'el celular descifra el aviso tal cual se escribió (con acentos y emojis)')
ok(!Buffer.from(cifrado).includes(Buffer.from('Match listo')), 'el texto no viaja a la vista')
let ajeno = false
try { celular('otro').descifrar(cifrado) } catch { ajeno = true }
ok(ajeno, 'otro celular no puede leerlo')
const otra = await cifrar(tel.suscripcion, mensaje)
ok(!Buffer.from(cifrado).equals(Buffer.from(otra)), 'dos envíos del mismo aviso no se parecen')

console.log('\nFirma')
const claves = await nuevasClaves()
ok(deBase64Url(claves.publica).length === 65 && deBase64Url(claves.privada).length === 32 && deBase64Url(claves.secreto).length === 32, 'las claves nuevas tienen el tamaño que piden los navegadores')
const cabecera = await firmaVapid(tel.suscripcion.endpoint, 'https://haxmatch.ejemplo.dev', claves.publica, claves.privada)
const [, token, k] = /^vapid t=([^,]+), k=(.+)$/.exec(cabecera) ?? []
const [h, p, firma] = token.split('.')
const punto = deBase64Url(k)
const publica = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: aBase64Url(punto.slice(1, 33)), y: aBase64Url(punto.slice(33)) }, format: 'jwk' })
ok(verify('sha256', Buffer.from(`${h}.${p}`), { key: publica, dsaEncoding: 'ieee-p1363' }, Buffer.from(deBase64Url(firma))), 'la firma se verifica con la clave pública')
const datos = JSON.parse(Buffer.from(deBase64Url(p)).toString())
ok(datos.aud === 'https://fcm.googleapis.com' && datos.sub === 'https://haxmatch.ejemplo.dev' && datos.exp - Date.now() / 1000 < 24 * 3600, 'dice para qué servicio es, quién la manda y vence en menos de un día')

console.log('\n/api/push/enviar')
const env = {
  VAPID_PUBLICA: claves.publica, VAPID_PRIVADA: claves.privada, PUSH_SECRETO: claves.secreto,
  SUPABASE_URL: 'https://proyecto.supabase.co', SUPABASE_KEY: 'sb_publishable_prueba',
  ASSETS: { fetch: async () => new Response('la app') },
}
// Internet de mentira: anota lo que el servidor intenta mandar.
const salientes = []
let respuestaDelServicio = 201
globalThis.fetch = async (url, opciones = {}) => {
  salientes.push({ url: String(url), ...opciones })
  return new Response(null, { status: String(url).includes('supabase') ? 204 : respuestaDelServicio })
}
const pedir = (ruta, opciones) => worker.fetch(new Request(`https://haxmatch.ejemplo.dev${ruta}`, opciones), env, {})
const enviar = (cuerpo, secreto = claves.secreto, e = env) => worker.fetch(new Request('https://haxmatch.ejemplo.dev/api/push/enviar', {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-haxmatch-secreto': secreto }, body: JSON.stringify(cuerpo),
}), e, {})
const aviso = { titulo: 'Beto quiere entrar a tu sala', cuerpo: 'Aceptá o rechazá', url: '/buscando', tag: 'mensaje' }

ok((await enviar({ suscripciones: [tel.suscripcion], aviso }, 'otra-clave')).status === 401 && !salientes.length, 'sin la clave compartida no manda nada')
ok((await enviar({ suscripciones: [tel.suscripcion], aviso }, '')).status === 401, 'ni con la clave vacía')
let r = await enviar({ suscripciones: [tel.suscripcion], aviso })
let cuerpo = await r.json()
ok(r.status === 200 && cuerpo.enviados === 1 && salientes.length === 1 && salientes[0].url === tel.suscripcion.endpoint, 'con la clave, le entrega el aviso al servicio del navegador')
const e = salientes[0].headers
ok(e['Content-Encoding'] === 'aes128gcm' && e.TTL === '900' && e.Topic === 'mensaje' && e.Authorization.startsWith('vapid t='), 'con los encabezados que piden los navegadores')
ok(JSON.stringify(JSON.parse(tel.descifrar(salientes[0].body).texto)) === JSON.stringify(aviso), 'y el celular lee exactamente ese aviso')

salientes.length = 0
r = await enviar({ suscripciones: [{ ...tel.suscripcion, endpoint: 'https://sitio-raro.example/x' }, { ...tel.suscripcion, endpoint: 'http://fcm.googleapis.com/x' }], aviso })
ok((await r.json()).enviados === 0 && !salientes.length, 'no le manda pedidos a sitios que no son servicios de avisos')
r = await enviar({ suscripciones: [tel.suscripcion], aviso: { ...aviso, url: 'https://otro-sitio.example' } })
ok(JSON.parse(tel.descifrar(salientes[0].body).texto).url === '/', 'un aviso no puede abrir una dirección de afuera')

salientes.length = 0
respuestaDelServicio = 410
await enviar({ suscripciones: [tel.suscripcion], aviso })
const baja = salientes.find((s) => s.url.includes('/rest/v1/rpc/baja_suscripcion'))
ok(baja && JSON.parse(baja.body).p_endpoint === tel.suscripcion.endpoint && JSON.parse(baja.body).p_secreto === claves.secreto, 'si el celular ya no acepta avisos, le pide a la base que borre esa suscripción')
respuestaDelServicio = 201

ok((await enviar({ suscripciones: [tel.suscripcion], aviso }, claves.secreto, { ...env, VAPID_PRIVADA: undefined })).status === 503, 'sin las claves cargadas responde que no está configurado')

// En Cloudflare el trabajo puede seguir después de contestar.
salientes.length = 0
const pendientes = []
const conDespues = (cuerpo) => worker.fetch(new Request('https://haxmatch.ejemplo.dev/api/push/enviar', {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-haxmatch-secreto': claves.secreto }, body: JSON.stringify(cuerpo),
}), env, { waitUntil: (p) => pendientes.push(p) })
r = await conDespues({ suscripciones: [tel.suscripcion], aviso })
ok(r.status === 200 && (await r.json()).enviados === 1 && pendientes.length === 1, 'entrega el aviso, cuenta cómo salió y se asegura de terminar aunque la base corte antes')
ok(salientes.length === 1 && JSON.parse(tel.descifrar(salientes[0].body).texto).titulo === aviso.titulo, 'un aviso común sale igual que el de prueba')

console.log('\nOtras direcciones')
ok((await (await pedir('/api/push/clave')).json()).clave === claves.publica, '/api/push/clave entrega la clave pública')
ok((await (await worker.fetch(new Request('https://haxmatch.ejemplo.dev/api/push/clave'), { ASSETS: env.ASSETS }, {})).json()).clave === null, 'y nada si todavía no se configuró')
let pagina = await (await worker.fetch(new Request('https://haxmatch.ejemplo.dev/api/push/configurar'), { ASSETS: env.ASSETS }, {})).text()
ok(pagina.includes('VAPID_PRIVADA') && pagina.replaceAll('&#39;', "'").includes("select public.configurar_push('https://haxmatch.ejemplo.dev/api/push/enviar'"), 'la página de configuración da las tres claves y la línea para Supabase')
pagina = await (await pedir('/api/push/configurar')).text()
ok(pagina.includes('ya están configurados') && !pagina.includes(claves.privada) && !pagina.includes(claves.secreto), 'una vez configurado, esa página ya no muestra ninguna clave')
ok((await pedir('/api/otra-cosa')).status === 404, 'una dirección de /api/ que no existe responde 404')
ok((await (await pedir('/perfil')).text()) === 'la app', 'todo lo demás es la app')

// ---- La parte de la app que muestra el aviso (public/sw.js), con un navegador de mentira ----
console.log('\nCuándo se muestra la notificación')
const { readFileSync } = await import('node:fs')
/** Corre public/sw.js y le hace llegar un aviso. Devuelve los títulos de las notificaciones que mostró. */
async function llegaAviso(aviso, ventanas, agente = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141') {
  const escuchas = {}
  const mostradas = []
  const yo = {
    addEventListener: (tipo, f) => { escuchas[tipo] = f },
    navigator: { userAgent: agente, maxTouchPoints: 0 },
    registration: { showNotification: async (titulo) => { mostradas.push(titulo) } },
    clients: { matchAll: async () => ventanas },
    location: { origin: 'https://haxmatch.ejemplo.dev' },
  }
  new Function('self', 'caches', 'location', readFileSync('public/sw.js', 'utf8'))(yo, {}, yo.location)
  let espera = Promise.resolve()
  escuchas.push({ data: { json: () => aviso }, waitUntil: (p) => { espera = p } })
  await espera
  return mostradas
}
const invitacion = { titulo: 'ana te escribió', cuerpo: '"los pibes" está necesitando un GK. ¿Querés jugar?', url: '/buscando', tag: 'mensaje' }
ok((await llegaAviso(invitacion, [])).join() === 'ana te escribió', 'con la app cerrada, se muestra')
ok((await llegaAviso(invitacion, [{ focused: false, visibilityState: 'hidden' }])).length === 1, 'con la app en otra pestaña o minimizada, se muestra')
ok((await llegaAviso(invitacion, [{ focused: false, visibilityState: 'visible' }])).length === 1, 'en la computadora, con la app a la vista pero usando otra ventana, también se muestra')
ok((await llegaAviso(invitacion, [{ focused: true, visibilityState: 'visible' }])).length === 0, 'si la persona está usando la app, no: el aviso ya aparece adentro')
ok((await llegaAviso({ ...invitacion, tag: 'prueba' }, [{ focused: true, visibilityState: 'visible' }])).length === 1, 'el aviso de prueba se muestra siempre')
ok((await llegaAviso(invitacion, [{ focused: true, visibilityState: 'visible' }], 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).length === 1, 'en iPhone se muestra siempre')

console.log(fallas ? `\n${fallas} comprobaciones fallaron.` : '\nTodo bien.')
process.exit(fallas ? 1 : 0)

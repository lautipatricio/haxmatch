// Ensayo con varios usuarios a la vez: levanta el servidor de ensayo (la misma
// base de datos de Supabase, pero local), abre la app en varios "celulares" y
// recorre los flujos reales de la cola: salas, pedidos, grupos y partidos.
// Uso: npm run ensayo [carpeta de capturas]
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
import { iniciarEnsayo } from './servidor-ensayo.mjs'

const PUERTO_APP = 4174
const URL = `http://localhost:${PUERTO_APP}`
const dir = process.argv[2] ?? 'capturas-ensayo'
mkdirSync(dir, { recursive: true })

// conWeb: además de la base, la parte de servidor de la web, con un TikTok de mentira.
const servidor = await iniciarEnsayo(8787, { conWeb: true })

/**
 * Reproductor de TikTok de mentira. Se porta como el de verdad (comprobado con el
 * real): solo se pone en marcha si la dirección trae autoplay=1, y arranca sin
 * sonido. Tres formas de portarse con el sonido:
 * - "libre": deja activar el sonido siempre (computadora, Android).
 * - "iphone": en cada video frena el primer pedido de sonido (el que la app hace
 *   sola) y acepta los siguientes (los que nacen de un toque del usuario).
 * - "estricto": no deja nunca; solo sirven los controles del propio video.
 */
const reproductor = (modo) => `<!doctype html><body style="margin:0;background:#123;color:#fff;font:16px sans-serif"><p id="e">quieto</p><p id="c"></p><script>
  const decir = (type, value) => parent.postMessage({ type, value, 'x-tiktok-player': true }, '*')
  const modo = ${JSON.stringify(modo)}
  let anda = false, mudo = true, pedidos = 0
  const frenado = () => modo === 'estricto' || (modo === 'iphone' && pedidos < 2)
  const pintar = () => { document.getElementById('e').textContent = (anda ? 'reproduciendo' : 'pausado') + (mudo ? ' sin sonido' : ' con sonido') }
  const q = new URLSearchParams(location.search)
  document.getElementById('c').textContent = q.get('controls') === '1' ? 'con controles' : 'sin controles'
  if (q.get('autoplay') === '1') {
    addEventListener('message', (e) => {
      const d = e.data
      if (!d || d['x-tiktok-player'] !== true) return
      if (d.type === 'play' && (mudo || !frenado())) { anda = true; decir('onStateChange', 1) }
      if (d.type === 'pause') { anda = false; decir('onStateChange', 2) }
      if (d.type === 'mute') { mudo = true; decir('onMute', true) }
      if (d.type === 'unMute') {
        pedidos++
        mudo = false; decir('onMute', false)
        if (frenado() && anda) { anda = false; decir('onStateChange', 2) }
      }
      pintar()
    })
    parent.postMessage('[tea-sdk]ready', '*')
    decir('onPlayerReady'); decir('onMute', true); decir('onStateChange', 3)
    anda = true; decir('onStateChange', 1); pintar()
  }
</script></body>`

/** Imagen mínima, para las miniaturas de mentira. */
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEUlEQVR4nGPQiHLTiHJjgFAAFXYDIRzyJPsAAAAASUVORK5CYII=', 'base64')

const saltar = (destino) => `<!doctype html><script>location.replace(${JSON.stringify(destino)})</script>`

/** Conecta el navegador de un usuario con la web de ensayo y con el TikTok de mentira. */
async function conectar(ctx, nombre) {
  // Lo que la app le pide a su propia web (/api/...).
  await ctx.route(`${URL}/api/**`, async (ruta) => {
    const pedido = ruta.request()
    const r = await servidor.web(new Request(pedido.url(), {
      method: pedido.method(), headers: await pedido.allHeaders(),
      body: ['GET', 'HEAD'].includes(pedido.method()) ? undefined : pedido.postData() ?? undefined,
    }))
    const encabezados = {}
    r.headers.forEach((v, k) => { encabezados[k] = v })
    void servidor.alDia()
    // El navegador de prueba no deja interceptar el destino de una redirección:
    // se la reemplaza por una página que va a ese destino (para el usuario es lo mismo).
    if (r.status >= 300 && r.status < 400) {
      const { location: destino, ...resto } = encabezados
      return ruta.fulfill({ status: 200, headers: { ...resto, 'content-type': 'text/html' }, body: saltar(destino) })
    }
    await ruta.fulfill({ status: r.status, headers: encabezados, body: await r.text() })
  })
  // La página de TikTok donde se da el permiso: acá dice que sí y vuelve.
  await ctx.route('https://www.tiktok.com/v2/auth/authorize/**', async (ruta) => {
    const ida = new globalThis.URL(ruta.request().url())
    const vuelta = new globalThis.URL(ida.searchParams.get('redirect_uri'))
    vuelta.searchParams.set('code', `codigo-${nombre}_tt`)
    vuelta.searchParams.set('scopes', 'user.info.basic,video.list')
    vuelta.searchParams.set('state', ida.searchParams.get('state'))
    await ruta.fulfill({ status: 200, contentType: 'text/html', body: saltar(vuelta.toString()) })
  })
  await ctx.route('https://www.tiktok.com/player/v1/**', (ruta) => ruta.fulfill({ status: 200, contentType: 'text/html', body: reproductor(nombre === 'olga' ? 'estricto' : nombre === 'rita' ? 'iphone' : 'libre') }))
  await ctx.route('https://p16.tiktokcdn.test/**', (ruta) => ruta.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }))
}
const web = spawn('npx', ['vite', 'preview', '--outDir', 'dist-ensayo', '--port', String(PUERTO_APP), '--strictPort'], { stdio: 'ignore' })
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {})
const errores = []
let n = 0

async function esperarWeb() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(URL)).ok) return
    } catch { /* todavía no levantó */ }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('La app no levantó')
}

/** Abre la app como un usuario nuevo, entra y termina el registro. */
async function abrir(nombre) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  await conectar(ctx, nombre)
  const page = await ctx.newPage()
  page.on('console', (m) => { if (m.type() === 'error') errores.push(`${nombre}: ${m.text()}`) })
  page.on('pageerror', (e) => errores.push(`${nombre}: ${e}`))
  const u = {
    nombre,
    page,
    boton: (texto) => page.getByRole('button', { name: texto, exact: true }),
    link: (texto) => page.getByRole('link', { name: texto, exact: true }),
    fila: (texto) => page.locator('.card--row', { hasText: texto }),
    ver: (texto, timeout = 12000) => page.getByText(texto, { exact: false }).first().waitFor({ timeout }),
    noVer: async (texto) => { if (await page.getByText(texto, { exact: false }).count()) throw new Error(`${nombre} no debería ver: ${texto}`) },
    foto: (titulo) => page.screenshot({ path: `${dir}/${String(++n).padStart(2, '0')}-${nombre}-${titulo}.png` }),
    async buscar(modalidad) {
      await u.link('Quiero jugar un amistoso').click()
      if (modalidad && modalidad !== '3v3') {
        await u.boton(modalidad).click()
        await u.boton('3v3').click()
      }
      await u.boton('Buscar amistoso').click()
      await u.boton('No, gracias').click()
      await u.ver('Jugadores buscando partidos')
    },
    async abrirSala(sala, faltan = 1) {
      await u.link('Necesito un jugador').click()
      await page.getByLabel('Nombre de la sala').fill(sala)
      if (faltan !== 1) await u.boton(String(faltan)).click()
      await u.boton('Buscar jugador').click()
      await u.ver('Buscando jugador')
      // Si ya había alguien esperando, el pedido aparece antes que el cartel "¿Te avisamos?".
      await u.boton('No, gracias').click({ timeout: 1500 }).catch(() => {})
    },
    async inicio() {
      await page.goto(URL)
      await u.ver('Quiero jugar un amistoso')
    },
  }
  await page.goto(`${URL}/?u=${nombre}`)
  await u.boton('Entrar con Discord').click()
  await u.ver('Bienvenido')
  await u.boton('Empezar').click()
  await u.ver('Quiero jugar un amistoso')
  return u
}

const paso = (t) => console.log('·', t)
const Nombre = (u) => u.nombre[0].toUpperCase() + u.nombre.slice(1)

try {
  await esperarWeb()

  // -------------------------------------------------------------------------
  paso('Sala de 1: la app acerca a un jugador, el dueño acepta, entra y los dos confirman')
  const ana = await abrir('ana')
  const beto = await abrir('beto')
  await ana.ver('Nadie buscando ahora')
  await ana.abrirSala('sala de ana')
  await beto.ver('1 buscando ahora')
  await beto.buscar()
  await beto.fila('Ana').waitFor()
  await beto.ver('sala "sala de ana"'); await beto.foto('ve-la-sala')
  await ana.ver('¿Aceptás a Beto?'); await ana.ver('La app lo conectó con tu sala'); await ana.foto('pedido')
  await ana.boton('Aceptar').click()
  await beto.ver('Sala de Ana'); await beto.ver('sala de ana'); await beto.foto('match-listo')
  await beto.boton('Entendido').click()
  await ana.ver('Beto va a entrar'); await ana.ver('Sala completa'); await ana.foto('va-a-entrar')
  await ana.boton('Ya entró Beto a la sala').last().click()
  await ana.ver('Tu sala está completa'); await ana.ver('Falta que confirme alguno de los que entraron')
  await beto.boton('Ya entré a la sala').click()
  await beto.ver('Partido válido · +10 puntos')
  await ana.ver('Partido válido · +10 puntos'); await ana.foto('partido-valido')
  // Al volver a abrir la app, todo sigue ahí.
  await beto.page.reload()
  await beto.ver('Partido válido · +10 puntos')
  await ana.inicio()
  await ana.link('Ver perfil').click()
  await ana.ver('amistosos jugados')
  if ((await ana.page.locator('.stat .h').first().innerText()) !== '1') throw new Error('Ana debería tener 1 amistoso jugado')
  await ana.ver('100%'); await ana.foto('perfil')
  if (await ana.page.getByText('Herramientas de prueba').count()) throw new Error('Con servidor no van las herramientas de prueba')

  // -------------------------------------------------------------------------
  paso('Puntos y referidos: los lleva el servidor, no el celular')
  await ana.link('Nivel 0. Ver detalle').click()
  // 10 del partido y 2 del ingreso del día.
  await ana.ver('12 de 50 puntos'); await ana.foto('nivel')
  // Con el celular "vacío" (como si fuera otro), los puntos son los mismos.
  await ana.page.evaluate(() => localStorage.clear())
  await ana.page.goto(`${URL}/?u=ana`)
  await Promise.race([
    ana.boton('Entrar con Discord').waitFor().then(() => ana.boton('Entrar con Discord').click()),
    ana.ver('Quiero jugar un amistoso'),
  ])
  await ana.ver('Quiero jugar un amistoso')
  await ana.page.goto(`${URL}/perfil/nivel`)
  await ana.ver('12 de 50 puntos')
  // Sara entró con el código de Ana: Ana la ve en su lista, y al quinto amistoso de Sara suma 50.
  const sara = await abrir('sara')
  await servidor.acceso.admin('update public.profiles set referido_por = $1 where id = $2', [servidor.usuario('ana').id, servidor.usuario('sara').id])
  await ana.page.goto(`${URL}/perfil/referir`)
  await ana.fila('Sara').waitFor(); await ana.ver('Va 0 de 5 amistosos')
  for (let i = 0; i < 4; i++) await servidor.acceso.admin('select public._dar_amistoso($1, gen_random_uuid())', [servidor.usuario('sara').id])
  await ana.ver('Va 4 de 5 amistosos')
  await servidor.acceso.admin('select public._dar_amistoso($1, gen_random_uuid())', [servidor.usuario('sara').id])
  await ana.ver('Sara completó 5 amistosos'); await ana.ver('Completó 5 amistosos · +50 puntos'); await ana.foto('referidos')
  if ((await ana.page.locator('.stat .h').nth(1).innerText()) !== '50') throw new Error('Ana debería tener 50 puntos ganados por referidos')
  await ana.page.goto(`${URL}/perfil/nivel`)
  await ana.ver('Nivel 1'); await ana.ver('62 de 150 puntos')
  await ana.page.goto(`${URL}/perfil/notificaciones`)
  await ana.ver('Subiste a Nivel 1'); await ana.ver('Sara completó 5 amistosos')
  await sara.page.context().close()
  await ana.inicio()

  // -------------------------------------------------------------------------
  paso('Sala de 2: rechazar, mensaje del jugador a la sala, "Todavía no", "Se salió" y cerrar la sala')
  const caro = await abrir('caro')
  await ana.inicio()
  await beto.inicio()
  await ana.abrirSala('sala dos', 2)
  await beto.buscar()
  await ana.ver('¿Aceptás a Beto?')
  await ana.boton('Rechazar').click()
  await ana.page.waitForTimeout(1500)
  await ana.noVer('¿Aceptás a Beto?')
  // Beto sigue buscando y le escribe él a la sala.
  await beto.fila('Ana').getByRole('button', { name: 'Mensaje' }).click()
  await beto.fila('Ana').getByRole('button', { name: 'Enviado' }).waitFor()
  await ana.ver('¿Aceptás a Beto?'); await ana.ver('Te escribió: ¿Me sumo a tu sala?'); await ana.foto('pedido-escrito')
  await ana.boton('Aceptar').click()
  await beto.ver('Sala de Ana')
  await beto.boton('Entendido').click()
  await ana.ver('Beto va a entrar')
  await ana.boton('Todavía no').click()
  await ana.ver('Aceptado · todavía no entró'); await ana.ver('Falta 1 · ARG')
  await caro.buscar()
  await ana.ver('¿Aceptás a Caro?')
  await ana.boton('Aceptar').click()
  await caro.ver('Sala de Ana'); await caro.ver('Entra con vos')
  await caro.boton('Entendido').click()
  await ana.ver('Caro va a entrar')
  await ana.boton('Todavía no').click()
  await ana.ver('Sala completa'); await ana.foto('sala-completa')
  await ana.boton('Ya entró Beto a la sala').last().click()
  await ana.ver('Adentro')
  await ana.boton('Beto se salió').click()
  await ana.ver('Se liberó el lugar de Beto'); await ana.ver('Falta 1 · ARG')
  await beto.ver('Ya no estás en la sala de Ana'); await beto.ver('Match no encontrado')
  // A Caro, que nunca entró, se la puede sacar con "No vino": la sala vuelve a tener 2 lugares.
  await ana.boton('Caro no vino').click()
  await ana.ver('Se liberó el lugar de Caro'); await ana.ver('Faltan 2 · ARG')
  await caro.ver('Ya no estás en la sala de Ana')
  await caro.inicio()
  await caro.buscar()
  await ana.ver('¿Aceptás a Caro?')
  await ana.boton('Aceptar').click()
  await caro.ver('Sala de Ana')
  await caro.boton('Entendido').click()
  await ana.ver('Caro va a entrar')
  await ana.boton('Todavía no').click()
  await ana.boton('Cerrar sala').click()
  await ana.ver('Quiero jugar un amistoso')
  // A Caro le queda el partido pendiente en el perfil.
  await caro.inicio()
  await caro.ver('Tenés un match con Ana'); await caro.foto('aviso-de-match')
  await caro.link('Ver perfil').click()
  await caro.ver('Por confirmar (1)'); await caro.foto('pendiente')
  await caro.boton('No lo jugué').click()
  await caro.page.waitForTimeout(800)
  await caro.noVer('Por confirmar')

  // -------------------------------------------------------------------------
  paso('Grupo: un jugador invita a otro, buscan juntos y una sala de 2 los recibe a los dos')
  const dani = await abrir('dani')
  const eva = await abrir('eva')
  const fran = await abrir('fran')
  await dani.buscar()
  await eva.buscar()
  await dani.fila('Eva').getByRole('button', { name: 'Mensaje' }).click()
  await eva.ver('Te escribieron'); await eva.ver('¿Jugamos un 3v3?'); await eva.foto('te-escribieron')
  await eva.boton('Aceptar a Dani').click()
  await eva.ver('Te sumaste a la búsqueda de Dani'); await eva.ver('armó el grupo y maneja la búsqueda')
  await eva.boton('Salir del grupo').waitFor(); await eva.foto('sumada')
  // El sumado ve a los demás, pero los mensajes los manda quien armó el grupo.
  const gus = await abrir('gus')
  await gus.buscar()
  await eva.fila('Gus').getByRole('button', { name: 'Mensaje' }).waitFor()
  if (!(await eva.fila('Gus').getByRole('button', { name: 'Mensaje' }).isDisabled())) throw new Error('Un sumado no debería poder mandar mensajes')
  await gus.boton('Cancelar búsqueda').click()
  await dani.ver('Eva se sumó a tu búsqueda'); await dani.ver('Buscan con vos'); await dani.foto('grupo')
  await fran.abrirSala('sala de fran', 2)
  await fran.ver('¿Aceptás a Dani y Eva?'); await fran.ver('son un grupo de 2'); await fran.foto('pedido-grupo')
  await fran.boton('Aceptar').click()
  await dani.ver('Sala de Fran')
  await eva.ver('Sala de Fran'); await eva.ver('Entra con vos')
  await dani.boton('Entendido').click()
  await eva.boton('Entendido').click()
  await fran.boton('Ya entró Dani a la sala').last().click()
  await fran.boton('Ya entró Eva a la sala').last().click()
  await fran.ver('Tu sala está completa')
  await eva.boton('Ya entré a la sala').click()
  await eva.ver('Partido válido · +10 puntos')
  // A Dani le cuenta sin tocar nada: el dueño marcó que entró y ya confirmó uno de cada lado.
  await dani.ver('Partido válido · +10 puntos')
  await fran.ver('Partido válido · +10 puntos')
  // Después de jugado, "Se salió" libera el lugar pero a Eva el partido le queda.
  await fran.boton('Eva se salió').click()
  await fran.ver('Se liberó el lugar de Eva')
  await eva.ver('El partido te queda anotado')
  await eva.inicio()
  await eva.link('Ver perfil').click()
  if ((await eva.page.locator('.stat .h').first().innerText()) !== '1') throw new Error('A Eva el partido jugado le tiene que quedar')
  await fran.boton('Cerrar sala').or(fran.boton('Cancelar búsqueda')).click()
  await fran.ver('Quiero jugar un amistoso')

  // -------------------------------------------------------------------------
  paso('Equipo completo: dos buscando 2v2 arman sala y pasan a buscar rival')
  const gabi = await abrir('gabi')
  const hugo = await abrir('hugo')
  await gabi.buscar('2v2')
  await hugo.buscar('2v2')
  await gabi.fila('Hugo').getByRole('button', { name: 'Mensaje' }).click()
  await hugo.boton('Aceptar a Gabi').click()
  await gabi.ver('Equipo completo'); await gabi.ver('Ya son 2 para un 2v2'); await gabi.foto('equipo-completo')
  await gabi.boton('Ahora no, seguir buscando una sala').click()
  await gabi.ver('Buscan con vos')
  await gabi.page.reload()
  await gabi.ver('Equipo completo')
  await gabi.page.locator('#sala-equipo').fill('equipo gabi')
  await gabi.boton('Crear sala y buscar rival').click()
  await gabi.ver('Buscando jugador'); await gabi.ver('Faltan 2 · ARG'); await gabi.ver('Hugo va a entrar')
  await hugo.ver('Sala de Gabi'); await hugo.ver('equipo gabi')
  await gabi.boton('Todavía no').click()
  await gabi.boton('Cancelar búsqueda').or(gabi.boton('Cerrar sala')).click()
  await gabi.ver('Quiero jugar un amistoso')

  // -------------------------------------------------------------------------
  paso('Quien armó el grupo deja de buscar; después, un sumado se va del grupo')
  const juan = await abrir('juan')
  const kira = await abrir('kira')
  await juan.buscar()
  await kira.buscar()
  await juan.fila('Kira').getByRole('button', { name: 'Mensaje' }).click()
  await kira.boton('Aceptar a Juan').click()
  await kira.ver('Te sumaste a la búsqueda de Juan')
  // El sumado ve a los demás, pero no puede escribirles.
  await juan.ver('Kira se sumó a tu búsqueda')
  await juan.boton('Cancelar búsqueda').click()
  await kira.ver('Juan dejó de buscar'); await kira.foto('lider-se-fue')
  await kira.page.waitForTimeout(800)
  await kira.noVer('Buscan con vos')
  await kira.boton('Cancelar búsqueda').waitFor()
  await juan.buscar()
  await kira.fila('Juan').getByRole('button', { name: 'Mensaje' }).click()
  await juan.boton('Aceptar a Kira').click()
  await kira.ver('Juan se sumó a tu búsqueda')
  await juan.boton('Salir del grupo').click()
  await kira.ver('Juan salió del grupo')
  await kira.page.waitForTimeout(800)
  await kira.noVer('Buscan con vos')

  // -------------------------------------------------------------------------
  paso('Los 15 minutos: aparece el cartel y se puede renovar')
  await servidor.acceso.admin(`update public.busquedas set expira_at = now() - interval '5 seconds' where user_id = $1 and estado = 'activa'`, [servidor.usuario('kira').id])
  await kira.ver('Pasaron 15 minutos', 15000); await kira.foto('quince-minutos')
  await kira.boton('Renovar la búsqueda').click()
  await kira.ver('Búsqueda renovada'); await kira.ver('Vence en 14:')
  // Si no responde, vence sola.
  await servidor.acceso.admin(`update public.busquedas set expira_at = now() - interval '3 minutes' where user_id = $1 and estado = 'activa'`, [servidor.usuario('kira').id])
  await kira.ver('Tu búsqueda venció', 15000); await kira.ver('No estás buscando')

  // -------------------------------------------------------------------------
  paso('Amigos: agregar desde la cola, aceptar, aviso cuando se pone a buscar, agregar por usuario y quitar')
  const lola = await abrir('lola')
  const mora = await abrir('mora')
  await lola.ver('Bienvenido, Lola'); await lola.foto('saludo')
  await lola.buscar()
  await mora.buscar()
  await mora.page.getByRole('button', { name: 'Ver a Lola' }).click()
  await mora.ver('Discord: lola'); await mora.foto('ficha')
  await mora.boton('Agregar a amigos').click()
  await mora.boton('Solicitud enviada').waitFor()
  await mora.boton('Cerrar').click()
  await lola.ver('Mora quiere ser tu amigo')
  await lola.page.getByRole('button', { name: 'Ver a Mora' }).first().click()
  await lola.boton('Aceptar solicitud').click()
  await lola.ver('es tu amigo'); await lola.foto('ficha-amigo')
  await lola.boton('Cerrar').click()
  await mora.ver('Lola aceptó tu solicitud')
  await lola.fila('Mora').getByText('AMIGO').waitFor()
  await mora.fila('Lola').getByText('AMIGO').waitFor()
  // Lola deja de buscar y vuelve: a su amiga le llega el aviso.
  await lola.boton('Cancelar búsqueda').click()
  await lola.ver('Quiero jugar un amistoso')
  await lola.buscar()
  await mora.ver('Tu amigo Lola se puso disponible')
  await mora.page.goto(`${URL}/perfil/amigos`)
  await mora.ver('Disponibles ahora'); await mora.fila('Lola').getByRole('button', { name: 'Mensaje' }).waitFor(); await mora.foto('amigos')
  // Agregar por usuario de Discord, con arroba y mayúsculas.
  const nora = await abrir('nora')
  await nora.page.goto(`${URL}/perfil/amigos`)
  await nora.page.getByLabel('Usuario de Discord').fill('nadie_asi')
  await nora.boton('Agregar').click()
  await nora.ver('Ese usuario todavía no está en HaxMatch')
  await nora.page.getByLabel('Usuario de Discord').fill('@LOLA')
  await nora.boton('Agregar').click()
  await nora.ver('Solicitud enviada a Lola.')
  await nora.fila('Lola').getByText('Solicitud enviada').waitFor()
  await lola.ver('Nora quiere ser tu amigo')
  // Quitar a un amigo.
  await mora.page.getByRole('button', { name: 'Ver a Lola' }).first().click()
  await mora.boton('Quitar de amigos').click()
  await mora.boton('Sí, quitar de amigos').click()
  await mora.ver('Agregá amigos por su usuario de Discord')
  await lola.page.waitForTimeout(1000)
  if (await lola.fila('Mora').getByText('AMIGO').count()) throw new Error('Mora ya no tendría que figurar como amiga de Lola')
  await lola.boton('Cancelar búsqueda').click(); await mora.inicio(); await mora.link('Quiero jugar un amistoso').click(); await mora.boton('Cancelar búsqueda').click()

  // -------------------------------------------------------------------------
  paso('Clips: vincular TikTok, ver y reproducir los clips, reaccionar, video nuevo, ocultar y desvincular')
  const olga = await abrir('olga')
  const pato = await abrir('pato')
  const golazo = servidor.tiktok.publicar('olga_tt', 'Golazo de media cancha #haxball #golazo', 3600)
  servidor.tiktok.publicar('olga_tt', 'Asado del domingo', 1800)
  await olga.link('Ver clips').click()
  await olga.ver('Clip de muestra'); await olga.foto('clips-de-muestra')
  await olga.link('Vincular TikTok').click()
  await olga.ver('Vinculá tu cuenta de TikTok'); await olga.foto('vincular')
  await olga.boton('Vincular TikTok').click()
  // Va a "TikTok", da el permiso y vuelve sola.
  await olga.ver('TikTok vinculado. Importamos tus videos')
  await olga.ver('TikTok vinculado: olga_tt')
  await olga.ver('Golazo de media cancha'); await olga.ver('Sin #haxball ni #haxmatch: no aparece en Clips'); await olga.foto('mis-videos')
  if (olga.page.url().includes('tiktok=')) throw new Error('El resultado de TikTok tendría que salir de la dirección')
  // Otro usuario ve el clip y lo reproduce.
  await pato.page.goto(`${URL}/clips`)
  await pato.ver('Golazo de media cancha #haxball #golazo'); await pato.ver('@Olga')
  // El nivel de los demás ya se conoce: lo calcula el servidor.
  await pato.ver('@Olga · Nivel 0')
  await pato.noVer('Asado del domingo'); await pato.noVer('Clip de muestra')
  // Arranca solo y, como este navegador lo permite, con sonido.
  const marco = pato.page.frameLocator('.reel__video iframe')
  await marco.getByText('reproduciendo con sonido').waitFor()
  const src = await pato.page.locator('.reel__video iframe').getAttribute('src')
  if (!src.startsWith(`https://www.tiktok.com/player/v1/${golazo}?`)) throw new Error('El reproductor tiene que ser el de TikTok, con el número del video')
  if (!src.includes('autoplay=1')) throw new Error('El reproductor tiene que arrancar solo')
  await marco.getByText('sin controles').waitFor()
  // El reproductor va más alto que la pantalla, parejo arriba y abajo: así quedan afuera el logo y los números de TikTok.
  const sobra = await pato.page.evaluate(() => { const v = document.querySelector('.reel__video').getBoundingClientRect(); const f = document.querySelector('.reel__video iframe').getBoundingClientRect(); return [Math.round(v.top - f.top), Math.round(f.bottom - v.bottom)] })
  if (sobra[0] < 200 || sobra[0] !== sobra[1]) throw new Error(`El reproductor tiene que sobresalir parejo arriba y abajo (sobresale ${sobra})`)
  await pato.boton('Pausar').click()
  await marco.getByText('pausado con sonido').waitFor()
  await pato.boton('Reproducir').click()
  await marco.getByText('reproduciendo con sonido').waitFor()
  await pato.boton('Silenciar').click()
  await marco.getByText('reproduciendo sin sonido').waitFor()
  await pato.boton('Activar el sonido').click()
  await marco.getByText('reproduciendo con sonido').waitFor(); await pato.foto('clip-real')
  // En un celular que no deja activar el sonido solo: el clip sigue andando sin sonido
  // y ofrece activarlo. Si ni tocando se puede, aparecen los controles del propio video.
  await olga.page.goto(`${URL}/clips`)
  const marcoOlga = olga.page.frameLocator('.reel__video iframe')
  await marcoOlga.getByText('reproduciendo sin sonido').waitFor()
  await olga.ver('Activar sonido'); await olga.foto('clip-sin-sonido')
  await olga.boton('Activar el sonido').click()
  await marcoOlga.getByText('reproduciendo sin sonido').waitFor()
  await olga.page.locator('.reel__toque').waitFor({ state: 'detached' })
  await marcoOlga.getByText('con controles').waitFor()
  if (await olga.page.evaluate(() => document.querySelector('.reel__video iframe').getBoundingClientRect().height !== document.querySelector('.reel__video').getBoundingClientRect().height)) throw new Error('Con los controles de TikTok a la vista, el reproductor va entero')
  await olga.page.goto(`${URL}/clips/mis-videos`)
  await pato.boton('Reaccionar').click()
  await pato.boton('Quitar reacción').waitFor()
  await pato.page.reload()
  await pato.boton('Quitar reacción').waitFor()
  if ((await pato.page.locator('.like').innerText()).trim() !== '1') throw new Error('La reacción tendría que quedar guardada')
  // Olga publica un video nuevo en TikTok y actualiza.
  const triple = servidor.tiktok.publicar('olga_tt', 'Triple pared y adentro #haxmatch', 0)
  await olga.boton('Actualizar mis videos').click()
  await olga.ver('Triple pared y adentro', 15000); await olga.ver('Reel nuevo en Clips · +8 puntos')
  // En un iPhone: cada video arranca sin sonido y alcanza con tocarlo una vez. El cartel
  // grande sale solo la primera vez; lo elegido (con o sin sonido) queda guardado.
  const rita = await abrir('rita')
  await rita.page.goto(`${URL}/clips`)
  const marcoRita = rita.page.frameLocator('.reel__video iframe')
  await marcoRita.getByText('reproduciendo sin sonido').waitFor()
  await rita.page.locator('.reel__sonido--pedir').getByText('Activar sonido').waitFor(); await rita.foto('clip-activar-sonido')
  await rita.boton('Tocar para activar el sonido').click({ position: { x: 60, y: 320 } })
  await marcoRita.getByText('reproduciendo con sonido').waitFor()
  await rita.boton('Silenciar').waitFor(); await rita.boton('Pausar').waitFor()
  await rita.page.waitForTimeout(2000)
  await rita.page.evaluate(() => { const f = document.querySelector('.feed'); f.scrollTop = f.scrollHeight })
  await rita.page.waitForFunction((id) => document.querySelector('.reel__video iframe')?.src.includes(id), golazo)
  await marcoRita.getByText('reproduciendo sin sonido').waitFor()
  await rita.ver('Tocá para el sonido')
  if (await rita.page.locator('.reel__sonido--pedir').count()) throw new Error('El cartel grande de sonido sale solo la primera vez')
  await rita.boton('Tocar para activar el sonido').click({ position: { x: 60, y: 320 } })
  await marcoRita.getByText('reproduciendo con sonido').waitFor(); await rita.foto('clip-pantalla-completa')
  await rita.boton('Silenciar').click()
  await marcoRita.getByText('reproduciendo sin sonido').waitFor()
  await rita.page.reload()
  await marcoRita.getByText('reproduciendo sin sonido').waitFor()
  await rita.boton('Activar el sonido').waitFor()
  await rita.page.waitForTimeout(1200)
  if (await rita.page.getByText('Activar sonido').count() || await rita.page.getByText('Tocá para el sonido').count()) throw new Error('Si el usuario silenció, no se le insiste con el sonido')
  // Oculta el primero: los demás dejan de verlo.
  await olga.page.getByRole('switch', { name: /Golazo de media cancha/ }).click()
  await pato.page.goto(`${URL}/clips`)
  await pato.ver('Triple pared y adentro')
  await pato.noVer('Golazo de media cancha')
  // Deslizar para actualizar: Olga sube otro video y Pato lo encuentra sin que ella haga nada.
  servidor.tiktok.publicar('olga_tt', 'Atajadón sobre la línea #haxball', 0)
  await servidor.acceso.admin(`update public.tiktok_cuentas set sincronizada_at = now() - interval '10 minutes', pedida_at = null`)
  await pato.page.locator('.feed').hover()
  await pato.page.mouse.wheel(0, -400)
  await pato.ver('Buscando clips nuevos')
  await pato.ver('1 clip nuevo', 15000); await pato.ver('Atajadón sobre la línea'); await pato.foto('clip-nuevo-al-deslizar')
  // El clip nuevo queda en pantalla y arranca solo.
  await pato.page.waitForFunction(() => document.querySelector('.feed').scrollTop === 0 && document.querySelector('.reel')?.textContent.includes('Atajadón'))
  await pato.page.frameLocator('.reel__video iframe').getByText('reproduciendo').waitFor()
  await pato.page.locator('.feed-aviso').waitFor({ state: 'detached' })
  // Con el dedo: en el primer clip, deslizar hacia abajo.
  const dedo = (tipo, y) => pato.page.evaluate(([tipo, y]) => {
    const el = document.querySelector('.reel')
    const toque = new Touch({ identifier: 1, target: el, clientX: 180, clientY: y })
    el.dispatchEvent(new TouchEvent(tipo, { bubbles: true, cancelable: true, touches: tipo === 'touchend' ? [] : [toque], changedTouches: [toque] }))
  }, [tipo, y])
  await dedo('touchstart', 300); await dedo('touchmove', 340)
  await pato.ver('Deslizá para actualizar')
  await dedo('touchmove', 520)
  await pato.ver('Soltá para actualizar')
  await dedo('touchend', 520)
  await pato.ver('No hay clips nuevos', 15000)
  // En el perfil: cuántos clips tiene, con su miniatura, y al tocar uno se abre ese clip.
  await olga.page.goto(`${URL}/perfil`)
  await olga.ver('Tus clips (2)'); await olga.ver('Ver los 4 videos de tu TikTok')
  await olga.page.waitForFunction(() => { const fotos = [...document.querySelectorAll('.clip-mini img.portada')]; return fotos.length === 2 && fotos.every((f) => f.complete && f.naturalWidth > 0) })
  await olga.foto('perfil-mis-clips')
  await olga.link('Ver el clip: Triple pared y adentro #haxmatch').click()
  await olga.page.waitForFunction((id) => location.pathname === '/clips' && !location.search && document.querySelector('.feed')?.scrollTop > 0 && document.querySelector('.reel__video iframe')?.src.includes(id), triple)
  await olga.page.goto(`${URL}/clips/mis-videos`)
  // Desvincula: se va todo.
  await olga.boton('Desvincular TikTok').click()
  await olga.boton('Sí, desvincular').click()
  await olga.ver('Vinculá tu cuenta de TikTok')
  await pato.page.goto(`${URL}/clips`)
  await pato.ver('Clip de muestra')
  // Términos y privacidad se leen sin entrar.
  const visita = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
  await visita.goto(`${URL}/privacidad`)
  await visita.getByText('Política de privacidad de HaxMatch').waitFor()
  await visita.getByRole('link', { name: 'lpatriciogauna@outlook.com' }).first().waitFor()
  await visita.getByRole('link', { name: 'Términos y condiciones' }).click()
  await visita.getByText('Términos y condiciones de uso de HaxMatch').waitFor()
  // Desde la pantalla de ingreso también se llega.
  await visita.goto(URL)
  await visita.getByRole('link', { name: 'Política de privacidad' }).click()
  await visita.getByRole('heading', { name: 'Qué datos guardamos' }).waitFor()
  await visita.screenshot({ path: `${dir}/${String(++n).padStart(2, '0')}-visita-terminos.png` })

  // -------------------------------------------------------------------------
  paso('Reportar a un jugador y cerrar sesión con una búsqueda abierta')
  await beto.inicio()
  await beto.link('Ver perfil').click()
  await ana.inicio()
  await ana.abrirSala('sala tres')
  await kira.inicio()
  await kira.buscar()
  await ana.boton('Aceptar').click()
  await kira.ver('Sala de Ana')
  await kira.boton('Entendido').click()
  await kira.link('Reportar a Ana').click()
  await kira.boton('Enviar reporte').click()
  await kira.ver('Reporte enviado')
  const reportes = await servidor.acceso.admin('select motivo from public.reportes')
  if (reportes.length !== 1 || reportes[0].motivo !== 'No apareció') throw new Error('El reporte no quedó guardado en el servidor')
  await juan.inicio()
  await juan.buscar()
  await juan.page.goto(URL)
  await juan.boton('Cerrar sesión').click()
  await juan.boton('Sí, cerrar sesión').click()
  await juan.ver('Entrar con Discord')
  // La cancelación viaja mientras la pantalla ya cambió: se le da un momento.
  let deJuan
  for (let i = 0; i < 20; i++) {
    deJuan = (await servidor.acceso.admin(`select estado from public.busquedas where user_id = $1 order by creada_at desc limit 1`, [servidor.usuario('juan').id]))[0]?.estado
    if (deJuan === 'cancelada') break
    await new Promise((r) => setTimeout(r, 250))
  }
  if (deJuan !== 'cancelada') throw new Error(`Al cerrar sesión la búsqueda tiene que cancelarse (quedó ${deJuan})`)

  const graves = errores.filter((e) => !/favicon|sw\.js|Failed to load resource/.test(e))
  if (graves.length) throw new Error(`Errores en la consola:\n${graves.join('\n')}`)
  console.log('\nEnsayo completo: todo bien.')
} catch (e) {
  console.error('\nFALLÓ EL ENSAYO:', e.message)
  for (const ctx of browser.contexts()) {
    const page = ctx.pages()[0]
    if (page) await page.screenshot({ path: `${dir}/falla-${browser.contexts().indexOf(ctx)}.png` }).catch(() => {})
  }
  process.exitCode = 1
} finally {
  await browser.close()
  web.kill()
  await servidor.cerrar()
}

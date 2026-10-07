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

const servidor = await iniciarEnsayo(8787)
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

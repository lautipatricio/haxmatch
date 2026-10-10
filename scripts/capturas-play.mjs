// Imágenes para la ficha de Google Play, sacadas de la app en modo demostración:
// seis capturas de celular (1236 x 2196) y la imagen de portada (1024 x 500).
// Uso: npm run probar   (en otra terminal)   y después   node scripts/capturas-play.mjs [carpeta]
import { mkdirSync, readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const URL = process.env.APP_URL ?? 'http://localhost:4173'
const dir = process.argv[2] ?? 'play'
mkdirSync(dir, { recursive: true })
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {})

/** Abre la app como un jugador recién registrado. */
async function abrir(nick) {
  // Google Play pide que el lado largo no pase del doble del corto: 412 x 732 es 9:16.
  const ctx = await browser.newContext({ viewport: { width: 412, height: 732 }, deviceScaleFactor: 3 })
  const page = await ctx.newPage()
  const boton = (texto) => page.getByRole('button', { name: texto, exact: true })
  const ver = (texto) => page.getByText(texto, { exact: false }).first().waitFor({ timeout: 15000 })
  let n = 0
  return {
    page, boton, ver, ctx,
    arriba: () => page.locator('.scroll').evaluate((el) => el.scrollTo(0, 0)),
    foto: async (nombre) => {
      await page.waitForTimeout(500)
      await page.screenshot({ path: `${dir}/${nombre}.png` })
      n++
    },
    entrar: async () => {
      await page.goto(URL)
      await boton('Entrar con Discord').click()
      await ver('Bienvenido')
      await page.getByLabel('Tu nick (opcional)').fill(nick)
      await boton('Empezar').click()
      await ver('¿Qué querés')
    },
  }
}

// Como jugador: inicio, la cola, el perfil de otro, la invitación y el match.
const j = await abrir('Lauti')
await j.entrar()
await j.page.waitForTimeout(1500)
await j.foto('1-inicio')
await j.page.getByRole('link', { name: 'Jugar HaxBall' }).click()
await j.boton('Quiero jugar un amistoso').click()
await j.page.locator('.banner a').first().click()
await j.ver('Jugadores buscando partidos')
await j.page.waitForTimeout(8000)
await j.foto('2-buscando')
await j.page.getByRole('button', { name: 'Ver a Pibe9' }).click()
await j.page.getByRole('dialog', { name: 'Perfil de Pibe9' }).waitFor()
await j.foto('5-perfil-de-jugador')
await j.boton('Cerrar').click()
await j.boton('Simular que una sala te invita').click()
await j.ver('Te invitan a jugar')
await j.arriba()
await j.foto('3-te-invitan')
await j.boton('Sí, quiero jugar').click()
await j.ver('No te olvides')
await j.boton('Entendido').click()
await j.ver('Ya entré a la sala')
await j.foto('4-match-listo')
await j.ctx.close()

// Como dueño de una sala: la lista para elegir a quién invitar.
const s = await abrir('Lauti')
await s.entrar()
await s.page.getByRole('link', { name: 'Jugar HaxBall' }).click()
await s.page.getByRole('link', { name: 'Necesito un jugador', exact: true }).click()
await s.boton('Big').click()
await s.page.getByLabel('Nombre de la sala').fill('amistoso 3v3')
await s.boton('2').click()
await s.boton('Buscar jugador').click()
await s.ver('Elegí a quién invitar')
await s.page.waitForTimeout(6000)
await s.foto('6-mi-sala')
await s.ctx.close()

// Imagen de portada: 1024 x 500, sin transparencia.
const fuente = (archivo) => `data:font/woff2;base64,${readFileSync(`node_modules/@fontsource/${archivo}`).toString('base64')}`
const portada = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 })
await portada.setContent(`<!doctype html><html><head><style>
  @font-face { font-family: 'Titulo'; src: url(${fuente('manrope/files/manrope-latin-300-normal.woff2')}) format('woff2'); font-weight: 300; }
  @font-face { font-family: 'Texto'; src: url(${fuente('manrope/files/manrope-latin-500-normal.woff2')}) format('woff2'); font-weight: 500; }
  * { box-sizing: border-box; margin: 0; }
  body { width: 1024px; height: 500px; background: #090D14; color: #EAF2FF; overflow: hidden; position: relative; font-family: 'Texto', sans-serif; }
  /* Media cancha, saliendo por la derecha. */
  svg { position: absolute; right: -150px; top: -40px; width: 640px; height: 580px; }
  .texto { position: absolute; left: 72px; top: 0; bottom: 0; display: flex; flex-direction: column; justify-content: center; gap: 18px; }
  .marca { font: 300 92px/1 'Titulo', sans-serif; letter-spacing: .12em; text-transform: uppercase; }
  .marca span { color: #3B82F6; }
  .lema { font-size: 34px; line-height: 1.2; color: #8A9AB5; max-width: 520px; }
</style></head><body>
  <svg viewBox="0 0 640 580" fill="none" stroke="#293241" stroke-width="6">
    <rect x="60" y="60" width="700" height="460" rx="36"/>
    <path d="M410 60v460"/>
    <circle cx="410" cy="290" r="96"/>
    <circle cx="410" cy="290" r="30" fill="#3B82F6" stroke="none"/>
    <circle cx="250" cy="200" r="22" fill="#EAF2FF" stroke="none"/>
    <circle cx="270" cy="400" r="22" fill="#EAF2FF" stroke="none"/>
    <circle cx="540" cy="230" r="22" fill="#EAF2FF" stroke="none"/>
  </svg>
  <div class="texto">
    <div class="marca">Hax<span>Match</span></div>
    <div class="lema">Amistosos de HaxBall,<br>sin vueltas</div>
  </div>
</body></html>`)
await portada.evaluate(() => document.fonts.ready)
await portada.screenshot({ path: `${dir}/portada-1024x500.png`, omitBackground: false })

await browser.close()
console.log(`Listo: imágenes en ${dir}/`)

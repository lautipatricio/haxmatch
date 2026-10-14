// Capturas de la app (modo demostración) para el sitio público /web/.
// Uso: npm run probar   (en otra terminal)   y después   node scripts/capturas-web.mjs
import { chromium } from 'playwright'

const URL = process.env.APP_URL ?? 'http://localhost:4173'
const dir = process.argv[2] ?? 'public/web'
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {})

async function abrir(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  const boton = (t) => page.getByRole('button', { name: t, exact: true })
  const ver = (t) => page.getByText(t, { exact: false }).first().waitFor({ timeout: 15000 })
  const foto = async (n) => { await page.waitForTimeout(1500); await page.screenshot({ path: `${dir}/${n}.png` }) }
  await page.goto(URL)
  await boton('Entrar con Discord').click()
  await ver('Bienvenido')
  await page.getByLabel('Tu nick (opcional)').fill('Lauti')
  await boton('Empezar').click()
  await ver('¿Qué querés')
  return { page, boton, ver, foto }
}

// Celular
const c = await abrir(390, 844)
await c.foto('inicio')
await c.page.getByRole('link', { name: 'Jugar HaxBall' }).click()
await c.boton('Quiero jugar un amistoso').waitFor(); await c.foto('haxball')
await c.page.locator('.tabbar a[aria-label^="Chat"]').click()
await c.ver('Mensajes del chat').catch(() => {}); await c.foto('chat')
await c.page.locator('.tabbar a[aria-label^="Perfil"]').click()
await c.ver('Conectado como'); await c.foto('perfil')
await c.page.locator('.tabbar a[aria-label^="Jugar"]').click()
await c.boton('Quiero jugar un amistoso').click()
await c.ver('Te avisamos cuando encontremos una coincidencia')
await c.page.locator('.banner a').first().click()
await c.ver('Jugadores buscando partidos'); await c.foto('buscando')
await c.boton('Simular que una sala te invita').click()
await c.ver('Te invitan a jugar'); await c.foto('invitacion')
await c.boton('Sí, quiero jugar').click()
await c.ver('No te olvides'); await c.boton('Entendido').click()
await c.ver('Entra con vos').catch(() => {}); await c.page.locator('.scroll').evaluate((el) => el.scrollTo(0, 0)); await c.foto('match')

// Compu
const p = await abrir(1440, 900)
await p.page.getByRole('link', { name: 'Jugar HaxBall' }).click()
await p.boton('Quiero jugar un amistoso').waitFor(); await p.foto('compu')
await browser.close()

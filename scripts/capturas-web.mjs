// Capturas de la app (modo demostración) para el sitio público /web/.
// Uso: npm run probar   (en otra terminal)   y después   node scripts/capturas-web.mjs
import { chromium } from 'playwright'

const URL = process.env.APP_URL ?? 'http://localhost:4173'
const dir = process.argv[2] ?? 'public/web'
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {})
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
const boton = (t) => page.getByRole('button', { name: t, exact: true })
const ver = (t) => page.getByText(t, { exact: false }).first().waitFor({ timeout: 15000 })
const foto = async (n) => { await page.waitForTimeout(1300); await page.screenshot({ path: `${dir}/${n}.png` }) }

await page.goto(URL)
await boton('Entrar con Discord').click()
await ver('Bienvenido')
await page.getByLabel('Tu nick (opcional)').fill('Lauti')
await boton('Empezar').click()
await ver('¿Qué querés'); await foto('inicio')
await page.getByRole('link', { name: 'Jugar HaxBall' }).click()
await boton('Quiero jugar un amistoso').waitFor(); await foto('haxball')
await page.locator('.tabbar a[aria-label^="Perfil"]').click()
await ver('Conectado como'); await foto('perfil')
await browser.close()

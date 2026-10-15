// Idiomas: quien se registra desde Brasil ve la app en portugués; desde el Perfil se
// puede pasar a inglés o volver a automático. Y en español no cambia nada.
// Uso: npm run probar   (en otra terminal)   y después   node scripts/recorrido-idiomas.mjs
import { chromium } from 'playwright'

const URL = process.env.APP_URL ?? 'http://localhost:4173'
const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {})
const errores = []
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-AR' })
const page = await ctx.newPage()
page.on('pageerror', (e) => errores.push(String(e)))
const ver = (t) => page.getByText(t, { exact: false }).first().waitFor({ timeout: 10000 })

await page.goto(URL)
await ver('Entrar con Discord')
await page.getByRole('button', { name: 'Entrar con Discord' }).click()
await page.locator('select#pais').selectOption('BR')
await page.locator('.foot .btn').click()
// Con país Brasil, la app pasa sola a portugués.
await ver('O que você quer')
await page.getByRole('link', { name: 'Jogar HaxBall' }).click()
await ver('Quero jogar um amistoso'); await ver('jogadores procurando agora')
if ((await page.evaluate(() => document.documentElement.lang)) !== 'pt') errores.push('La página tendría que decir lang="pt"')
// El logo no se traduce.
await page.goto(URL + '/perfil')
await ver('País e idioma'); await ver('Automático (Português)')
await page.locator('select#idioma').selectOption('en')
await ver('Country and language'); await ver('Your accounts')
await page.locator('select#idioma').selectOption('es')
await ver('País e idioma'); await ver('Tus cuentas')
await b.close()
if (errores.length) { console.error(errores); process.exit(1) }
console.log('Idiomas: todo bien.')

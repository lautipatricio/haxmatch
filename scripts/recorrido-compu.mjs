// Recorrido en la compu (1440 y 1100 de ancho) y en el celular: saca capturas de las pantallas
// principales y revisa que la ficha de un jugador se cierre con Escape.
// Uso: npm run probar   (en otra terminal)   y después   node scripts/recorrido-compu.mjs [carpeta]
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
const dir = process.argv[2] ?? 'capturas-compu'
mkdirSync(dir, { recursive: true })
const U = process.env.APP_URL ?? 'http://localhost:4173'
const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {})
const errores = []
async function vuelta(w, h, pref) {
  const page = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })).newPage()
  page.on('pageerror', (e) => errores.push(String(e)))
  const foto = async (n) => { await page.waitForTimeout(1300); await page.screenshot({ path: `${dir}/${pref}-${n}.png` }) }
  await page.goto(U)
  await page.getByRole('button', { name: 'Entrar con Discord', exact: true }).click()
  await page.getByRole('button', { name: 'Empezar', exact: true }).click()
  await foto('1-inicio')
  await page.getByRole('link', { name: 'Jugar HaxBall' }).click(); await foto('2-haxball')
  await page.goto(U + '/perfil'); await foto('3-perfil')
  await page.goto(U + '/chat'); await foto('4-chat')
  await page.goto(U + '/clips'); await foto('5-clips')
  await page.goto(U + '/haxball'); await page.waitForTimeout(600)
  await page.getByRole('button', { name: /^Ver a / }).first().click(); await foto('6-ficha')
  await page.keyboard.press('Escape'); await page.waitForTimeout(400)
  if (await page.getByRole('dialog').count()) errores.push('Escape no cerró la ficha')
  await page.context().close()
}
await vuelta(1440, 900, 'pc')
await vuelta(1100, 800, 'mediana')
await vuelta(390, 844, 'cel')
if (errores.length) { console.error(errores); process.exit(1) }
console.log('Recorrido en la compu: todo bien.')
await b.close()

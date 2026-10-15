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
  const page = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale: 'es-AR' })).newPage()
  page.on('pageerror', (e) => errores.push(String(e)))
  const foto = async (n) => { await page.waitForTimeout(1300); await page.screenshot({ path: `${dir}/${pref}-${n}.png` }) }
  await page.goto(U)
  await page.getByRole('button', { name: 'Entrar con Discord', exact: true }).click()
  await page.getByRole('button', { name: 'Empezar', exact: true }).click()
  await foto('1-inicio')
  // El Inicio va sin menú al costado; el menú aparece al entrar a HaxBall.
  if (await page.locator('.lateral').count()) errores.push('El Inicio no lleva el menú del costado')
  await page.getByRole('link', { name: 'Jugar HaxBall' }).click(); await foto('2-haxball')
  if (w >= 1024 && !(await page.locator('.lateral').count())) errores.push('En HaxBall tiene que estar el menú del costado')
  await page.goto(U + '/perfil'); await foto('3-perfil')
  if (w >= 1024) {
    // Instalar en la compu: sin el aviso del navegador se ven los pasos; con el aviso, el botón.
    if (!(await page.getByText('Instalá HaxMatch en tu computadora').count())) errores.push('Falta la tarjeta para instalar en la compu')
    if (!(await page.getByText('Instalar página como app', { exact: false }).count())) errores.push('Faltan los pasos para instalar desde Chrome')
    await page.evaluate(() => {
      const e = new Event('beforeinstallprompt', { cancelable: true })
      e.prompt = async () => { window.__pidioInstalar = true }
      e.userChoice = Promise.resolve({ outcome: 'accepted' })
      window.dispatchEvent(e)
    })
    await page.getByRole('button', { name: 'Instalar en la compu' }).click()
    await page.getByText('¡Listo, HaxMatch quedó instalada!').waitFor({ timeout: 3000 }).catch(() => errores.push('No apareció el aviso de instalada'))
    if (!(await page.evaluate(() => window.__pidioInstalar))) errores.push('El botón no abrió la ventana de instalar')
    await foto('3b-instalada')
  }
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

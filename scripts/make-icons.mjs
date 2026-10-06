// Genera los íconos PNG de la PWA a partir de public/icon.svg.
// Uso: node scripts/make-icons.mjs
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const svg = readFileSync('public/icon.svg', 'utf8')
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {})
const page = await browser.newPage()
for (const [nombre, lado, margen] of [['icon-192', 192, 0], ['icon-512', 512, 0], ['icon-maskable-512', 512, 0.12]]) {
  await page.setViewportSize({ width: lado, height: lado })
  // El ícono "maskable" deja margen porque el sistema lo recorta en círculo.
  const escala = 1 - margen * 2
  await page.setContent(`<body style="margin:0;background:#0E1512;display:grid;place-items:center;height:100vh">
    <div style="width:${lado * escala}px;height:${lado * escala}px">${svg}</div></body>`)
  await page.screenshot({ path: `public/${nombre}.png` })
}
await browser.close()

// Lista los textos de la app que todavía no tienen traducción (para sumarlos a i18n/trad-extra.txt).
// Uso: node scripts/i18n-faltan.mjs
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const actuales = JSON.parse(execFileSync('node', ['scripts/extraer-textos.mjs'], { encoding: 'utf8', maxBuffer: 1 << 24 }))
const pt = JSON.parse(readFileSync('src/i18n/pt.json', 'utf8'))
const conocidos = new Set([...Object.keys(pt.exactos), ...pt.plantillas.map((p) => p[0])])
const viejos = JSON.parse(readFileSync('i18n/textos.json', 'utf8'))
const revisados = new Set([...viejos.exactos, ...viejos.plantillas])
const faltan = [...actuales.exactos, ...actuales.plantillas].filter((t) => !conocidos.has(t) && !revisados.has(t))
console.log(faltan.length ? faltan.map((t) => `@${t}|`).join('\n') : 'No falta traducir nada.')

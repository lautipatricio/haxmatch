// Arma el diccionario de traducciones (src/i18n/pt.json y en.json) a partir de
// i18n/textos.json (los textos en español) e i18n/trad-*.txt (portugués e inglés).
// Uso: node scripts/i18n-armar.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'

const { exactos, plantillas } = JSON.parse(readFileSync('i18n/textos.json', 'utf8'))
const todos = [...exactos, ...plantillas]
const dic = { pt: { exactos: {}, plantillas: [] }, en: { exactos: {}, plantillas: [] } }
let faltan = 0
const poner = (es, pt, en) => {
  if (pt === '-' || !es) return
  if (pt === '=') { pt = es; en = es }
  if (!pt || !en) { faltan++; return }
  const tipo = /\{\d+\}/.test(es) ? 'plantillas' : 'exactos'
  if (tipo === 'exactos') { dic.pt.exactos[es] = pt; dic.en.exactos[es] = en } else { dic.pt.plantillas.push([es, pt]); dic.en.plantillas.push([es, en]) }
}
for (const f of readdirSync('i18n').filter((x) => /^trad-.*\.txt$/.test(x)).sort()) {
  for (const linea of readFileSync(`i18n/${f}`, 'utf8').split('\n')) {
    if (!linea.trim() || linea.startsWith('#')) continue
    const p = linea.split('|')
    if (linea.startsWith('@')) poner(p[0].slice(1), p[1], p[2])
    else poner(todos[Number(p[0])], p[1], p[2])
  }
}
// Las plantillas más largas primero: así gana la más precisa.
for (const l of ['pt', 'en']) dic[l].plantillas.sort((a, b) => b[0].replace(/\{\d+\}/g, '').length - a[0].replace(/\{\d+\}/g, '').length)
// Uno por idioma: la app baja solo el que necesita.
for (const l of ['pt', 'en']) writeFileSync(`src/i18n/${l}.json`, JSON.stringify(dic[l]))
console.log(`Diccionario: ${Object.keys(dic.pt.exactos).length} textos y ${dic.pt.plantillas.length} plantillas.${faltan ? ` Sin traducir: ${faltan}.` : ''}`)

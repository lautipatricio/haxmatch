// Saca los textos en español de la app (pantallas y mensajes de la base) para traducirlos.
// Uso: node scripts/extraer-textos.mjs > textos.json
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const archivos = []
const recorrer = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) recorrer(p); else if (/\.tsx?$/.test(f) && !/\.test\./.test(f)) archivos.push(p) } }
recorrer('src')
const exactos = new Set()
const plantillas = new Set()
const pareceTexto = (t) => {
  const v = t.trim()
  if (v.length < 2 || !/[a-záéíóúñ]/i.test(v)) return false
  if (/^(https?:|\/|\.|#|data:|mailto:)/.test(v)) return false
  if (/^[a-z0-9_-]+$/.test(v) && !/[áéíóúñ]/.test(v)) return false // clases, claves
  if (/^[A-Z0-9_]+$/.test(v)) return false // códigos (GK, ARG)
  if (/[{}<>=;]|=>|\(\)/.test(v)) return false
  if (/^[a-z]+([A-Z][a-z]+)+$/.test(v)) return false // camelCase
  if (/^(btn|card|row|pill|m |strong|h |field|pad|lista|grow|cut|screen)/.test(v)) return false
  return /\s/.test(v) || /^[A-ZÁÉÍÓÚ¿¡]/.test(v) || /[áéíóúñ¿¡]/.test(v)
}
for (const f of archivos) {
  const src = ts.createSourceFile(f, readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const visitar = (n) => {
    const p = n.parent
    const enImport = p && (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p))
    const esClave = p && (ts.isPropertyAssignment(p) && p.name === n) || (p && ts.isLiteralTypeNode(p))
    const enAtributoClase = p && ts.isJsxAttribute(p) && ['className', 'id', 'htmlFor', 'role', 'type', 'name', 'to', 'href', 'src', 'inputMode', 'autoComplete', 'enterKeyHint', 'lang', 'key', 'rel', 'target', 'allow', 'referrerPolicy', 'value'].includes(p.name.getText())
    if (ts.isJsxText(n)) {
      const t = n.getText().replace(/\s+/g, ' ').trim()
      if (t && /[A-Za-zÁÉÍÓÚáéíóúñ¿¡]/.test(t)) exactos.add(t)
    } else if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && !enImport && !esClave && !enAtributoClase) {
      if (pareceTexto(n.text)) exactos.add(n.text.trim())
    } else if (ts.isTemplateExpression(n)) {
      let t = n.head.text
      n.templateSpans.forEach((s, i) => { t += `{${i + 1}}` + s.literal.text })
      if (pareceTexto(t.replace(/\{\d+\}/g, 'x'))) plantillas.add(t.trim())
    }
    ts.forEachChild(n, visitar)
  }
  visitar(src)
}
// Mensajes que manda la base (raise exception '...').
for (const f of readdirSync('supabase').filter((x) => x.endsWith('.sql'))) {
  const s = readFileSync(join('supabase', f), 'utf8')
  for (const m of s.matchAll(/raise exception '((?:[^']|'')+)'/g)) { const t = m[1].replace(/''/g, "'"); if (pareceTexto(t) && t !== '%') exactos.add(t) }
}
console.log(JSON.stringify({ exactos: [...exactos].sort(), plantillas: [...plantillas].sort() }, null, 1))

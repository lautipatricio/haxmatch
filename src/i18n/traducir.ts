// Traductor de la app: la app está escrita en español y, si el idioma es portugués o
// inglés, cambia los textos que se ven en pantalla usando el diccionario (pt.json, en.json).
// Mira la página entera y lo que va cambiando: textos, y los atributos que se leen o se
// escuchan (aria-label, placeholder, title, alt). Lo que escribe la gente (mensajes del
// chat, nombres de salas, títulos de clips) va marcado con translate="no" y no se toca.
import type { Idioma } from './idioma'
import { ponerIdiomaActual } from './actual'

interface Diccionario { exactos: Record<string, string>; plantillas: Array<[string, string]> }
interface Plantilla { re: RegExp; destino: string; conPunto: boolean }

const ATRIBUTOS = ['aria-label', 'placeholder', 'title', 'alt']
let idioma: Idioma = 'es'
let exactos: Record<string, string> = {}
let plantillas: Plantilla[] = []
const cache = new Map<string, string>()
/** Texto original (en español) de cada nodo de texto y de cada atributo que se tradujo. */
const textos = new WeakMap<Node, { es: string; tr: string }>()
const atributos = new WeakMap<Element, Map<string, { es: string; tr: string }>>()
let observador: MutationObserver | null = null

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function cargar(d: Diccionario) {
  exactos = d.exactos
  plantillas = d.plantillas.map(([es, tr]) => ({
    re: new RegExp(`^${es.split(/(\{\d+\})/).map((p) => (/^\{\d+\}$/.test(p) ? '(.+?)' : escapar(p))).join('')}$`, 's'),
    destino: tr,
    conPunto: es.includes(' · '),
  }))
  cache.clear()
}

/** Traduce un texto entero (sin espacios de los costados). */
function traducirFrase(t: string, profundidad = 0): string {
  if (!t || idioma === 'es') return t
  const hecho = cache.get(t)
  if (hecho !== undefined) return hecho
  let r: string | undefined = exactos[t]
  if (r === undefined && profundidad < 3) {
    const probar = (lista: Plantilla[]) => {
      for (const p of lista) {
        const m = p.re.exec(t)
        if (m) return p.destino.replace(/\{(\d+)\}/g, (_, n) => traducirFrase(m[Number(n)] ?? '', profundidad + 1))
      }
      return undefined
    }
    const conPunto = t.includes(' · ')
    // Con " · " primero las plantillas que lo tienen; si no, cada parte por separado
    // (Nivel 4 · Argentina · hace 2 min), y recién después las demás.
    if (conPunto) r = probar(plantillas.filter((p) => p.conPunto))
    if (r === undefined && conPunto) {
      const partes = t.split(' · ')
      const tr = partes.map((p) => traducirFrase(p, profundidad + 1))
      if (tr.some((x, i) => x !== partes[i])) r = tr.join(' · ')
    }
    if (r === undefined) r = probar(conPunto ? plantillas.filter((p) => !p.conPunto) : plantillas)
  }
  r ??= t
  if (cache.size > 5000) cache.clear()
  cache.set(t, r)
  return r
}

/** Traduce respetando los espacios de los costados ("  Hola, " → "  Olá, "). */
export function traducir(texto: string): string {
  if (idioma === 'es' || !texto || !/[A-Za-zÁÉÍÓÚáéíóúñ¿¡]/.test(texto)) return texto
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(texto)!
  const tr = traducirFrase(m[2].replace(/\s+/g, ' '))
  return tr === m[2].replace(/\s+/g, ' ') ? texto : m[1] + tr + m[3]
}

const saltear = (n: Node | null): boolean => {
  const el = n?.nodeType === 1 ? (n as Element) : n?.parentElement
  return !el || !!el.closest('[translate="no"], script, style, textarea, code, pre')
}

function textoNodo(n: Text) {
  if (saltear(n)) return
  const valor = n.nodeValue ?? ''
  const previo = textos.get(n)
  if (previo && valor === previo.tr) return
  const es = valor
  const tr = traducir(es)
  textos.set(n, { es, tr })
  if (tr !== valor) n.nodeValue = tr
}

function atributosDe(el: Element) {
  if (saltear(el)) return
  for (const a of ATRIBUTOS) {
    const valor = el.getAttribute(a)
    if (valor === null) continue
    let mapa = atributos.get(el)
    const previo = mapa?.get(a)
    if (previo && valor === previo.tr) continue
    const tr = traducir(valor)
    if (!mapa) { mapa = new Map(); atributos.set(el, mapa) }
    mapa.set(a, { es: valor, tr })
    if (tr !== valor) el.setAttribute(a, tr)
  }
}

function recorrer(raiz: Node) {
  if (raiz.nodeType === 3) return textoNodo(raiz as Text)
  if (raiz.nodeType !== 1 && raiz.nodeType !== 11) return
  if (raiz.nodeType === 1) atributosDe(raiz as Element)
  const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n.nodeType === 3) textoNodo(n as Text)
    else atributosDe(n as Element)
  }
}

/** Vuelve todo al español (al cambiar de idioma). */
function restaurar(raiz: Node) {
  const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n.nodeType === 3) {
      const t = textos.get(n)
      if (t && n.nodeValue === t.tr) n.nodeValue = t.es
      textos.delete(n)
    } else {
      const mapa = atributos.get(n as Element)
      mapa?.forEach((v, a) => { if ((n as Element).getAttribute(a) === v.tr) (n as Element).setAttribute(a, v.es) })
      atributos.delete(n as Element)
    }
  }
}

let pedido = 0
/** Pone la app en ese idioma. En español no hace nada (la app ya está escrita así). */
export async function ponerIdioma(nuevo: Idioma): Promise<void> {
  if (nuevo === idioma && (nuevo === 'es' || observador)) return
  const mio = ++pedido
  document.documentElement.lang = nuevo
  ponerIdiomaActual(nuevo)
  observador?.disconnect()
  observador = null
  if (idioma !== 'es') restaurar(document.body)
  idioma = nuevo
  if (nuevo === 'es') return
  const d = (nuevo === 'pt' ? await import('./pt.json') : await import('./en.json')).default as unknown as Diccionario
  if (mio !== pedido) return
  cargar(d)
  recorrer(document.body)
  observador = new MutationObserver((cambios) => {
    for (const c of cambios) {
      if (c.type === 'characterData') textoNodo(c.target as Text)
      else if (c.type === 'attributes') atributosDe(c.target as Element)
      else c.addedNodes.forEach(recorrer)
    }
  })
  observador.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATRIBUTOS })
}

/** Solo para las pruebas: elige idioma y diccionario sin tocar la página. */
export function prepararParaPrueba(i: Idioma, d: Diccionario) {
  idioma = i
  cargar(d)
}

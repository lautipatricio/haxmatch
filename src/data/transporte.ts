// Cómo habla la app con el servidor: llamar a una función y enterarse de que
// algo cambió. Lo implementan Supabase y el servidor de ensayo, así el resto
// de la app no sabe con cuál de los dos está hablando.
import { ENSAYO, ENSAYO_URL, supabase } from './supabase'

export interface Respuesta<T> {
  data?: T
  error?: string
}

const SIN_CONEXION = 'No pudimos conectar con el servidor. Revisá tu internet e intentá de nuevo.'
export const SIN_BASE = 'Falta configurar la base de datos de HaxMatch.'
const ALGO_SALIO_MAL = 'Algo salió mal. Probá de nuevo.'
/** Tiempo máximo de espera de un pedido. Sin esto, uno colgado dejaría a la app esperando para siempre. */
const LIMITE_MS = 15000

async function conLimite<T>(pedir: (corte: AbortSignal) => PromiseLike<T>): Promise<T> {
  const control = new AbortController()
  const reloj = setTimeout(() => control.abort(), LIMITE_MS)
  try {
    return await pedir(control.signal)
  } finally {
    clearTimeout(reloj)
  }
}

/** Texto para mostrar cuando falla una función del servidor. */
function problemaDeFuncion(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return SIN_CONEXION
  if (error.code === 'PGRST202' || error.code === '42883') return SIN_BASE
  if (/fetch|network|load failed|abort/i.test(error.message ?? '')) return SIN_CONEXION
  // P0001 es un aviso escrito por nuestras funciones ("Esa sala ya no está buscando").
  // Cualquier otro código es un error interno: no se le muestra crudo al usuario.
  if (error.code && error.code !== 'P0001') return ALGO_SALIO_MAL
  return error.message || ALGO_SALIO_MAL
}

export function problema(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return SIN_CONEXION
  // La función todavía no existe en la base: falta ejecutar el SQL.
  if (error.code === 'PGRST202' || error.code === '42883') return SIN_BASE
  if (/fetch|network|load failed/i.test(error.message ?? '')) return SIN_CONEXION
  return error.message || SIN_CONEXION
}

// ---- Servidor de ensayo: el usuario sale de la dirección (?u=ana) ----

const CLAVE_USUARIO = 'haxmatch-ensayo-usuario'

function leerUsuarioDeEnsayo(): string {
  try {
    const u = new URLSearchParams(window.location.search).get('u')
    if (u) sessionStorage.setItem(CLAVE_USUARIO, u)
    return sessionStorage.getItem(CLAVE_USUARIO) ?? 'ana'
  } catch {
    return 'ana'
  }
}

// Se lee al abrir la app, antes de que la navegación cambie la dirección.
const USUARIO_DE_ENSAYO = ENSAYO ? leerUsuarioDeEnsayo() : ''

export function usuarioDeEnsayo(): string {
  return USUARIO_DE_ENSAYO
}

async function rpcEnsayo<T>(nombre: string, args: Record<string, unknown>): Promise<Respuesta<T>> {
  try {
    const r = await conLimite((signal) => fetch(`${ENSAYO_URL}/rpc/${nombre}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-usuario': usuarioDeEnsayo() },
      body: JSON.stringify(args),
      signal,
    }))
    const cuerpo = await r.json() as { data?: T; error?: string }
    return r.ok ? { data: cuerpo.data } : { error: cuerpo.error ?? SIN_CONEXION }
  } catch {
    return { error: SIN_CONEXION }
  }
}

// ---- Interfaz común ----

/** Llama a una función del servidor con argumentos por nombre. */
export async function rpc<T>(nombre: string, args: Record<string, unknown> = {}): Promise<Respuesta<T>> {
  if (ENSAYO) return rpcEnsayo<T>(nombre, args)
  if (!supabase) return { error: SIN_CONEXION }
  const cliente = supabase
  try {
    const { data, error } = await conLimite((corte) => cliente.rpc(nombre, args).abortSignal(corte))
    return error ? { error: problemaDeFuncion(error) } : { data: data as T }
  } catch {
    return { error: SIN_CONEXION }
  }
}

/** Avisa cada vez que algo cambió en el servidor. Devuelve cómo dejar de escuchar. */
export function alCambiar(aviso: () => void): () => void {
  if (ENSAYO) {
    const fuente = new EventSource(`${ENSAYO_URL}/cambios`)
    fuente.onmessage = aviso
    return () => fuente.close()
  }
  if (!supabase) return () => {}
  const cliente = supabase
  const canal = cliente
    .channel('cola')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cambios' }, aviso)
    .subscribe()
  return () => { void cliente.removeChannel(canal) }
}

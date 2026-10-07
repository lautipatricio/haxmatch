import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { REAL } from '../config'
import { YO, buscarMia, nombreDe, useStore, usuarioDe, type Toast } from '../data/store'
import type { Usuario } from '../domain/types'

// ---------- Tiempo ----------

/** Hora actual de la app (respeta "avanzar un día" de la demo), actualizada cada segundo. */
export function useAhora(): number {
  const ahora = useStore((s) => s.ahora)
  const [, set] = useState(0)
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
  return ahora()
}

export function mmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const p = (n: number) => String(n).padStart(2, '0')
  return s >= 3600 ? `${Math.floor(s / 3600)}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}` : `${p(Math.floor(s / 60))}:${p(s % 60)}`
}

export function hace(ms: number): string {
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  return d === 1 ? 'ayer' : `hace ${d} días`
}

// ---------- Íconos (trazo, como en los mockups) ----------

type IconName = 'inicio' | 'clips' | 'perfil' | 'campana' | 'atras' | 'check' | 'play' | 'x' | 'corazon' | 'copiar' | 'reloj' | 'camara' | 'sonido' | 'mudo'

const PATHS: Record<IconName, ReactNode> = {
  inicio: <path d="M3 11l9-8 9 8v10H3z" />,
  clips: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M10 9l5 3-5 3z" /></>,
  perfil: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-5 4-7 8-7s8 2 8 7" /></>,
  campana: <path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7zM10 20h4" />,
  atras: <path d="M15 5l-7 7 7 7" />,
  check: <path d="M5 12l5 5 9-10" />,
  play: <path d="M8 5l11 7-11 7z" fill="currentColor" stroke="none" />,
  sonido: <><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /></>,
  mudo: <><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M17 9.5l5 5M22 9.5l-5 5" /></>,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  corazon: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  copiar: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></>,
  reloj: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  camara: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
}

export function Icon({ name, size = 22, stroke = 2, fill }: { name: IconName; size?: number; stroke?: number; fill?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  )
}

// ---------- Piezas ----------

export function Avatar({ user, nombre, size, foto }: { user?: Usuario; nombre?: string; size?: 'sm' | 'lg'; foto?: string | null }) {
  const n = user?.username ?? nombre ?? '?'
  const imagen = foto ?? user?.foto
  return (
    <div className={`av${size ? ` av--${size}` : ''}`} style={user ? { background: user.color } : undefined} aria-hidden="true">
      {imagen ? <img src={imagen} alt="" /> : n.replace(/[^a-zA-Z0-9]/g, '').slice(0, 1) || '?'}
    </div>
  )
}

/**
 * Foto y nombre de otro jugador. Al tocarlo se abre su ficha, para agregarlo
 * como amigo o reportarlo.
 */
export function Persona({ user, children }: { user: Usuario; children: ReactNode }) {
  const abrir = useStore((s) => s.abrirFicha)
  return (
    <button type="button" className="persona grow" aria-label={`Ver a ${user.username}`} onClick={() => abrir(user.id)}>
      <Avatar user={user} size="sm" />
      <span className="grow">{children}</span>
    </button>
  )
}

/** Ficha de un jugador: quién es y qué puedo hacer con él. Se abre desde cualquier lista. */
export function FichaJugador() {
  const s = useStore()
  const nav = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [quitar, setQuitar] = useState(false)
  const id = s.ficha
  useEffect(() => { setError(null); setQuitar(false) }, [id])
  if (!id) return null
  const u = usuarioDe(s, id)
  const amigo = s.amigos.includes(id)
  const enviada = s.solicitudesEnviadas.includes(id)
  const recibida = s.solicitudes.includes(id)
  const cerrar = s.cerrarFicha
  const agregar = async () => setError(await s.pedirAmistad(id))
  return (
    <div className="scrim" style={{ zIndex: 40 }} onClick={(e) => { if (e.target === e.currentTarget) cerrar() }}>
      <div className="sheet" role="dialog" aria-label={`Jugador ${u.username}`}>
        <div className="row">
          <Avatar user={u} />
          <div className="grow">
            <div className="h cut" style={{ textTransform: 'none' }}>{u.username}</div>
            <div className="m cut">
              {u.discord ? `Discord: ${u.discord}` : 'Jugador de HaxMatch'}
              {amigo && ' · es tu amigo'}
            </div>
          </div>
        </div>
        {error && <div className="err" role="alert">{error}</div>}
        {amigo ? (
          quitar ? (
            <>
              <div>¿Dejar de ser amigos? Ya no te vamos a avisar cuando se ponga a buscar.</div>
              <button className="btn btn--danger" onClick={() => { s.quitarAmigo(id); cerrar() }}>Sí, quitar de amigos</button>
            </>
          ) : (
            <button className="btn btn--sec" onClick={() => setQuitar(true)}>Quitar de amigos</button>
          )
        ) : recibida ? (
          <>
            <div>{u.username} quiere ser tu amigo.</div>
            <button className="btn" onClick={() => s.responderSolicitud(id, true)}>Aceptar solicitud</button>
            <button className="btn btn--sec" onClick={() => s.responderSolicitud(id, false)}>Rechazar</button>
          </>
        ) : enviada ? (
          <>
            <button className="btn btn--sec" disabled>Solicitud enviada</button>
            <button className="btn btn--ghost" onClick={() => s.quitarAmigo(id)}>Retirar la solicitud</button>
          </>
        ) : (
          <>
            <button className="btn" onClick={() => void agregar()}>Agregar a amigos</button>
            <div className="m">{REAL ? 'Cuando acepte, te avisamos cada vez que se ponga a buscar partido.' : 'Cuando acepte, lo vas a ver primero en la cola.'}</div>
          </>
        )}
        <button className="btn btn--ghost" onClick={() => { cerrar(); nav(`/reportar/${id}`) }}>Reportar o bloquear</button>
        <button className="btn btn--sec" onClick={cerrar}>Cerrar</button>
      </div>
    </div>
  )
}

export function Head({ title, back, children }: { title: string; back?: string | true; children?: ReactNode }) {
  const nav = useNavigate()
  return (
    <header className="head">
      {back && (
        <button className="back" aria-label="Volver" onClick={() => (back === true ? nav(-1) : nav(back))}>
          <Icon name="atras" />
        </button>
      )}
      <h1 className="h title">{title}</h1>
      {children}
    </header>
  )
}

export function Chips<T extends string | number>({ label, options, value, onChange, format }: {
  label: string
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  format?: (v: T) => string
}) {
  return (
    <>
      <h2 className="h sub">{label}</h2>
      <div className="chips" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o} type="button" className="chip" aria-pressed={o === value} onClick={() => onChange(o)}>
            {format ? format(o) : o}
          </button>
        ))}
      </div>
    </>
  )
}

/**
 * Chips donde se pueden marcar varias opciones. Si hay una opción "todas"
 * (Cualquiera), es excluyente: marcarla limpia el resto y marcar otra la saca.
 * Siempre queda al menos una marcada.
 */
export function ChipsMulti<T extends string>({ label, options, value, onChange, todas }: {
  label: string
  options: readonly T[]
  value: readonly T[]
  onChange: (v: T[]) => void
  todas?: T
}) {
  const alternar = (o: T) => {
    if (o === todas) return onChange([o])
    const marcadas = new Set(value.filter((v) => v !== todas))
    if (marcadas.has(o)) marcadas.delete(o)
    else marcadas.add(o)
    const concretas = options.filter((x) => x !== todas)
    // Sin ninguna, o con todas las concretas, equivale a "todas".
    if (todas !== undefined && (marcadas.size === 0 || marcadas.size === concretas.length)) return onChange([todas])
    if (marcadas.size === 0) return
    onChange(concretas.filter((x) => marcadas.has(x)))
  }
  return (
    <>
      <h2 className="h sub">{label}</h2>
      <div className="chips" role="group" aria-label={`${label}. Podés elegir varias`}>
        {options.map((o) => (
          <button key={o} type="button" className="chip" aria-pressed={value.includes(o)} onClick={() => alternar(o)}>{o}</button>
        ))}
      </div>
    </>
  )
}

export function TabBar({ on }: { on: 'inicio' | 'clips' | 'perfil' }) {
  const sinLeer = useStore((s) => s.notifs.some((n) => !n.leida))
  return (
    <nav className="tabbar" aria-label="Secciones">
      <Link to="/" className={on === 'inicio' ? 'on' : ''} aria-current={on === 'inicio' ? 'page' : undefined}>
        <Icon name="inicio" />Inicio
      </Link>
      <Link to="/clips" className={on === 'clips' ? 'on' : ''} aria-current={on === 'clips' ? 'page' : undefined}>
        <Icon name="clips" />Clips
      </Link>
      <Link to="/perfil" className={on === 'perfil' ? 'on' : ''} aria-current={on === 'perfil' ? 'page' : undefined}>
        <Icon name="perfil" />Perfil
        {sinLeer && <span className="dot" aria-label="Hay notificaciones sin leer" />}
      </Link>
    </nav>
  )
}

export function Sheet({ title, children, clear }: { title: string; children: ReactNode; clear?: boolean }) {
  return (
    <div className={`scrim${clear ? ' scrim--clear' : ''}`}>
      <div className="sheet" role="dialog" aria-label={title}>
        <div className="h">{title}</div>
        {children}
      </div>
    </div>
  )
}

/** Aviso de búsqueda activa. Aparece solo si hay una búsqueda. */
export function BannerBusqueda({ detalle }: { detalle?: string }) {
  const mia = useStore(buscarMia)
  const cancelar = useStore((s) => s.cancelarBusqueda)
  const ahora = useAhora()
  if (!mia) return null
  const texto = mia.modo === 'sala' ? 'Ya estás buscando jugador' : 'Ya estás buscando partido'
  // Sala llena: ya no se busca, solo falta marcar quién entró.
  if (mia.modo === 'sala' && mia.completaAt) {
    return (
      <div className="banner" role="status">
        <Link to="/buscando" className="grow">
          <div className="strong">Tu sala está completa</div>
          <div style={{ fontSize: 13 }}>Marcá quién ya entró para armar el match</div>
        </Link>
        <Link className="btn" to="/buscando">Ver</Link>
      </div>
    )
  }
  return (
    <div className="banner" role="status">
      <Link to="/buscando" className="grow">
        <div className="strong num">{texto} · {mmss(ahora - mia.creadaAt)}</div>
        {detalle && <div style={{ fontSize: 13 }}>{detalle}</div>}
      </Link>
      <button className="btn" onClick={cancelar}>Cancelar</button>
    </div>
  )
}

/** Aviso de un match recién armado en la sala de otro, para volver a encontrarlo desde el Inicio. */
export function BannerMatch() {
  const s = useStore()
  const ahora = useAhora()
  const DOS_HORAS = 2 * 60 * 60 * 1000
  const m = s.matches.find((x) => x.creadoPor !== YO && !x.descartado && ahora - x.createdAt < DOS_HORAS &&
    x.participantes.some((p) => p.userId === YO && p.confirmadoAt === null))
  if (!m) return null
  return (
    <div className="banner" role="status">
      <Link to={`/match/${m.id}`} className="grow">
        <div className="strong">Tenés un match con {nombreDe(s, m.creadoPor)}</div>
        <div style={{ fontSize: 13 }}>Entrá a la sala y avisá cuando estés adentro</div>
      </Link>
      <Link className="btn" to={`/match/${m.id}`}>Abrir</Link>
    </div>
  )
}

export function Empty({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="h">{title}</div>
      <div className="m" style={{ maxWidth: 280 }}>{text}</div>
      {children}
    </div>
  )
}

function ToastItem({ t }: { t: Toast }) {
  const cerrar = useStore((s) => s.cerrarToast)
  const responder = useStore((s) => s.responderMensaje)
  const nav = useNavigate()
  useEffect(() => {
    const timer = setTimeout(() => cerrar(t.id), t.mensajeId ? 20000 : 5000)
    return () => clearTimeout(timer)
  }, [t.id, t.mensajeId, cerrar])
  return (
    <div className="toast" role="status">
      <div className="grow">
        <div className="strong">{t.texto}</div>
        {t.detalle && <div className="m">{t.detalle}</div>}
      </div>
      {t.mensajeId ? (
        <div className="acts">
          <button className="btn" onClick={() => responder(t.mensajeId!, true)}>Aceptar</button>
          <button className="btn btn--sec btn--icon" aria-label="Rechazar" onClick={() => responder(t.mensajeId!, false)}><Icon name="x" size={18} /></button>
        </div>
      ) : (
        <div className="acts">
          {t.to && <button className="btn" onClick={() => { cerrar(t.id); nav(t.to!) }}>{t.toLabel ?? 'Ver'}</button>}
          <button className="x" aria-label="Cerrar aviso" onClick={() => cerrar(t.id)}><Icon name="x" size={18} /></button>
        </div>
      )}
    </div>
  )
}

export function Toasts() {
  const todos = useStore((s) => s.toasts)
  const buscando = useStore((s) => !!buscarMia(s))
  const { pathname } = useLocation()
  // En la pantalla de búsqueda, lo que me escriben ya se ve ahí (cartel o lista "Te escribieron").
  const toasts = pathname === '/buscando' && buscando ? todos.filter((t) => !t.mensajeId) : todos
  if (toasts.length === 0) return null
  return <div className="toasts">{toasts.map((t) => <ToastItem key={t.id} t={t} />)}</div>
}

/**
 * Cerrar sesión, con confirmación. El botón es angosto y va centrado para que
 * un toque de más sobre la barra inferior no lo active sin querer.
 */
export function CerrarSesion() {
  const cerrar = useStore((s) => s.cerrarSesion)
  const nav = useNavigate()
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button className="btn btn--ghost" style={{ alignSelf: 'center' }} onClick={() => setAbierto(true)}>Cerrar sesión</button>
      {abierto && (
        <Sheet title="¿Cerrar sesión?">
          <div>Vas a tener que volver a entrar con Discord. Si estás buscando, la búsqueda se cancela.</div>
          <button className="btn btn--danger" onClick={() => { cerrar(); nav('/ingresar') }}>Sí, cerrar sesión</button>
          <button className="btn btn--sec" onClick={() => setAbierto(false)}>Cancelar</button>
        </Sheet>
      )}
    </>
  )
}

/** Copia al portapapeles. Devuelve si se pudo. */
export async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    return false
  }
}

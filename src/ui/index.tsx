import { useEffect, useId, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { REAL } from '../config'
import { YO, buscarMia, miRacha, misPuntos, nombreDe, useStore, usuarioDe, type Toast } from '../data/store'
import { progresoNivel } from '../domain/rules'
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

type IconName = 'inicio' | 'clips' | 'perfil' | 'campana' | 'atras' | 'flecha' | 'check' | 'play' | 'x' | 'corazon' | 'copiar' | 'reloj' | 'camara' | 'sonido' | 'mudo'

const PATHS: Record<IconName, ReactNode> = {
  inicio: <path d="M4 11.5 12 4l8 7.5V20h-5.5v-5h-5v5H4z" />,
  clips: <><rect x="3.5" y="4.5" width="17" height="15" rx="3" /><path d="m10.5 9.5 4.5 2.5-4.5 2.5z" /></>,
  perfil: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.6-3.6 3.4-5.5 7-5.5s6.4 1.9 7 5.5" /></>,
  campana: <path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 5 2 6.5 2 6.5h-15s2-1.5 2-6.5zM10 19.5h4" />,
  atras: <path d="m15 6-6 6 6 6" />,
  flecha: <path d="m9 6 6 6-6 6" />,
  check: <path d="M5 12l5 5 9-10" />,
  play: <path d="M8 5l11 7-11 7z" fill="currentColor" stroke="none" />,
  sonido: <><path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z" /><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" /></>,
  mudo: <><path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z" /><path d="m16 9.5 5 5M21 9.5l-5 5" /></>,
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

/** Miniatura de un video de TikTok. Vence a las horas: si ya no carga, no se muestra nada. */
export function Portada({ src }: { src?: string }) {
  const [rota, setRota] = useState<string | null>(null)
  if (!src || rota === src) return null
  return <img className="portada" src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setRota(src)} />
}

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
      <Avatar user={user} />
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
            <div className="h cut">{u.username}</div>
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

export function Head({ title, back, chico, children }: { title: string; back?: string | true; chico?: boolean; children?: ReactNode }) {
  const nav = useNavigate()
  return (
    <header className={`head${chico ? ' head--chico' : ''}`}>
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
        <Icon name="inicio" size={24} stroke={1.75} />Inicio
      </Link>
      <Link to="/clips" className={on === 'clips' ? 'on' : ''} aria-current={on === 'clips' ? 'page' : undefined}>
        <Icon name="clips" size={24} stroke={1.75} />Clips
      </Link>
      <Link to="/perfil" className={on === 'perfil' ? 'on' : ''} aria-current={on === 'perfil' ? 'page' : undefined}>
        <Icon name="perfil" size={24} stroke={1.75} />Perfil
        {sinLeer && <span className="dot" aria-label="Hay notificaciones sin leer" />}
      </Link>
    </nav>
  )
}

/** Acceso a las notificaciones, con el punto de "hay sin leer". `desde`: a dónde vuelve la flecha de esa pantalla. */
export function Campana({ desde }: { desde?: string }) {
  const sinLeer = useStore((s) => s.notifs.some((n) => !n.leida))
  return (
    <Link className="btn btn--sec btn--icon" to="/perfil/notificaciones" state={desde ? { desde } : undefined}
      aria-label={sinLeer ? 'Notificaciones, hay sin leer' : 'Notificaciones'}>
      <Icon name="campana" stroke={1.75} />
      {sinLeer && <span className="dot" />}
    </Link>
  )
}

/** Nivel, racha y avance al próximo nivel. En el perfil es un enlace al detalle. */
export function TarjetaNivel({ enlace }: { enlace?: boolean }) {
  const s = useStore()
  const ahora = useAhora()
  const p = progresoNivel(misPuntos(s))
  const racha = miRacha(s, ahora)
  const avance = Math.round(p.avance * 100)
  const idPuntos = useId()
  const dentro = (
    <>
      <span className="nivel__t">
        <span className="h num">Nivel {p.nivel}</span>
        {racha > 0 && <span className="m num">{racha} {racha === 1 ? 'día seguido' : 'días seguidos'}</span>}
      </span>
      <span className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={avance} aria-label="Avance al próximo nivel">
        <span style={{ width: `${avance}%` }} />
      </span>
      <span className="m num" id={idPuntos}>
        {p.hasta === null
          ? `${p.puntos} puntos · llegaste al nivel máximo`
          : `${p.puntos} de ${p.hasta} puntos · te faltan ${p.hasta - p.puntos} para el Nivel ${p.nivel + 1}`}
      </span>
    </>
  )
  return enlace
    ? <Link className="card card--col nivel" to="/perfil/nivel" aria-label={`Nivel ${p.nivel}. Ver detalle`} aria-describedby={idPuntos}>{dentro}</Link>
    : <div className="card card--col nivel">{dentro}</div>
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
          <div className="banner__d">Marcá quién ya entró para armar el match</div>
        </Link>
        <Link className="btn" to="/buscando">Ver</Link>
      </div>
    )
  }
  return (
    <div className="banner" role="status">
      <Link to="/buscando" className="grow">
        <div className="strong num">{texto} · {mmss(ahora - mia.creadaAt)}</div>
        {detalle && <div className="banner__d">{detalle}</div>}
      </Link>
      <button className="btn btn--sec" onClick={cancelar}>Cancelar</button>
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
        <div className="banner__d">Entrá a la sala y avisá cuando estés adentro</div>
      </Link>
      <Link className="btn" to={`/match/${m.id}`}>Abrir</Link>
    </div>
  )
}

export function Empty({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="h">{title}</div>
      <div className="m" style={{ maxWidth: 300 }}>{text}</div>
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

/** Borrar la cuenta para siempre. Pide escribir BORRAR, para que no pase por un toque de más. */
export function BorrarCuenta() {
  const borrar = useStore((s) => s.borrarCuenta)
  const nav = useNavigate()
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const confirmar = async () => {
    setOcupado(true)
    const e = await borrar()
    setOcupado(false)
    if (e) setError(e)
    else nav('/ingresar', { replace: true })
  }
  return (
    <>
      <button className="btn btn--ghost" style={{ alignSelf: 'center', color: 'var(--fg2)' }} onClick={() => { setAbierto(true); setTexto(''); setError(null) }}>
        Borrar mi cuenta
      </button>
      {abierto && (
        <Sheet title="¿Borrar tu cuenta?">
          <div>
            Se borra para siempre tu perfil con todo lo tuyo: foto, puntos y nivel, amigos, partidos, clips y la vinculación con TikTok.
            No se puede deshacer.
          </div>
          <label className="m" htmlFor="confirmar-borrado">Para confirmar, escribí BORRAR</label>
          <input id="confirmar-borrado" className="field" value={texto} autoComplete="off" autoCapitalize="characters"
            onChange={(e) => setTexto(e.target.value)} />
          {error && <div className="err" role="alert">{error}</div>}
          <button className="btn btn--danger" disabled={ocupado || texto.trim().toUpperCase() !== 'BORRAR'} onClick={() => void confirmar()}>
            {ocupado ? 'Borrando…' : 'Borrar mi cuenta para siempre'}
          </button>
          <button className="btn btn--sec" disabled={ocupado} onClick={() => setAbierto(false)}>Cancelar</button>
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

import { useEffect, useId, useState, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PREVIEW } from '../config'
import { cargarFoto, soltarFoto, type FotoElegida } from '../data/foto'
import { YO, buscarMia, rivalesDe, useStore } from '../data/store'
import { DIAS_PENDIENTE, diasParaVencer, esPendiente, nivelDe, totalPuntos } from '../domain/rules'
import { Avatar, CerrarSesion, Head, Icon, TabBar, hace, useAhora } from '../ui'
import { Recortador } from '../ui/Recortador'

/** Partidos que el usuario todavía no confirmó. Se muestran como un aviso pendiente. */
function Pendientes() {
  const s = useStore()
  const ahora = useAhora()
  const abierta = buscarMia(s)?.matchId
  const pendientes = s.matches.filter((m) => m.id !== abierta && esPendiente(m, YO, ahora))
  if (pendientes.length === 0) return null
  return (
    <section className="card card--col card--accent" aria-label="Partidos por confirmar">
      <div className="row">
        <span style={{ color: 'var(--accent)', display: 'grid' }}><Icon name="reloj" /></span>
        <div className="h grow" style={{ fontSize: 22, color: 'var(--accent)' }}>Por confirmar ({pendientes.length})</div>
      </div>
      <div className="m">¿Jugaste estos partidos? Si los confirmás, cuentan. Vencen a los {DIAS_PENDIENTE} días.</div>
      {pendientes.map((m) => {
        const dias = diasParaVencer(m, ahora)
        const otroConfirmo = m.participantes.some((p) => p.userId !== YO && p.confirmadoAt !== null)
        return (
          <div key={m.id} style={{ borderTop: '1px solid var(--line)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <div className="strong">{m.formato && m.formato !== 'Cualquiera' ? m.formato : 'Amistoso'} con {rivalesDe(s, m)}</div>
              <div className="m">
                {hace(ahora - m.createdAt)}{m.nombreSala && ` · Sala "${m.nombreSala}"`} · vence en {dias} {dias === 1 ? 'día' : 'días'}
              </div>
              {otroConfirmo && <div className="m">{rivalesDe(s, m)} ya confirmó.</div>}
            </div>
            <div className="row">
              <button className="btn grow" onClick={() => s.confirmarMatch(m.id)}>Sí, jugué</button>
              <button className="btn btn--sec grow" onClick={() => s.descartarMatch(m.id)}>No lo jugué</button>
            </div>
          </div>
        )
      })}
    </section>
  )
}

/** Guía de instalación. En iPhone las notificaciones solo funcionan con la app en la pantalla de inicio. */
function Instalar() {
  const [evento, setEvento] = useState<Event & { prompt?: () => void } | null>(null)
  const instalada = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
  const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  useEffect(() => {
    const guardar = (e: Event) => { e.preventDefault(); setEvento(e) }
    window.addEventListener('beforeinstallprompt', guardar)
    return () => window.removeEventListener('beforeinstallprompt', guardar)
  }, [])
  if (PREVIEW || instalada) return null
  return (
    <div className="card card--col">
      <div className="strong">Instalá HaxMatch en tu celular</div>
      {esIOS ? (
        <ol className="steps m">
          <li>Abrí esta página en Safari.</li>
          <li>Tocá Compartir.</li>
          <li>Elegí "Agregar a inicio".</li>
        </ol>
      ) : (
        <div className="m">Se abre como una app y te deja recibir avisos de tus amigos.</div>
      )}
      {evento?.prompt && <button className="btn" onClick={() => evento.prompt?.()}>Instalar</button>}
    </div>
  )
}

/** Avatar propio. Al tocarlo se abre la galería del celular; después se encuadra la foto elegida. */
function FotoDePerfil({ onElegida, onError }: { onElegida: (f: FotoElegida) => void; onError: (texto: string | null) => void }) {
  const perfil = useStore((s) => s.perfil)
  const id = useId()
  const elegir = async (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0]
    // Se limpia para poder volver a elegir la misma foto.
    e.target.value = ''
    if (!archivo) return
    try {
      onElegida(await cargarFoto(archivo))
      onError(null)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'No pudimos leer esa imagen. Probá con otra.')
    }
  }
  return (
    <label className="foto" htmlFor={id}>
      {/* Sin "capture": el celular ofrece la galería en lugar de abrir la cámara. */}
      <input id={id} type="file" accept="image/*" onChange={elegir}
        aria-label={perfil?.foto ? 'Cambiar foto de perfil' : 'Elegir foto de perfil de la galería'} />
      <Avatar nombre={perfil?.nick} foto={perfil?.foto} size="lg" />
      <span className="foto__ins"><Icon name="camara" size={14} /></span>
    </label>
  )
}

export function Perfil() {
  const s = useStore()
  const ahora = useAhora()
  const nav = useNavigate()
  const nivel = nivelDe(totalPuntos(s.eventos, YO))
  const sinLeer = s.notifs.some((n) => !n.leida)
  const [errorFoto, setErrorFoto] = useState<string | null>(null)
  /** Foto recién elegida de la galería, a la espera de que la encuadre. */
  const [porAjustar, setPorAjustar] = useState<FotoElegida | null>(null)
  const [guardandoFoto, setGuardandoFoto] = useState(false)
  const terminarAjuste = async (foto?: string) => {
    if (porAjustar) soltarFoto(porAjustar)
    setPorAjustar(null)
    if (!foto) return
    setGuardandoFoto(true)
    setErrorFoto(await s.cambiarFoto(foto))
    setGuardandoFoto(false)
  }
  const quitarFoto = async () => {
    setGuardandoFoto(true)
    setErrorFoto(await s.cambiarFoto(null))
    setGuardandoFoto(false)
  }

  const mios = s.matches.filter((m) => m.participantes.some((p) => p.userId === YO))
  const jugados = mios.filter((m) => m.contadoAt !== null)
  const perdidos = mios.filter((m) => m.contadoAt === null && (m.descartado || !esPendiente(m, YO, ahora)) &&
    !m.participantes.find((p) => p.userId === YO)?.confirmadoAt)
  const anotados = jugados.length + perdidos.length
  const asistencia = anotados === 0 ? '—' : `${Math.round((jugados.length / anotados) * 100)}%`

  const veces = new Map<string, number>()
  for (const m of jugados) for (const p of m.participantes) if (p.userId !== YO) veces.set(p.userId, (veces.get(p.userId) ?? 0) + 1)
  const masJugado = [...veces.entries()].sort((a, b) => b[1] - a[1])[0]

  const fecha = new Date(ahora).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="screen">
      <Head title="Perfil">
        <Link className="btn btn--sec btn--icon" to="/perfil/notificaciones" aria-label={sinLeer ? 'Notificaciones, hay sin leer' : 'Notificaciones'}
          style={{ position: 'relative' }}>
          <Icon name="campana" size={20} />
          {sinLeer && <span className="dot" />}
        </Link>
      </Head>
      <div className="scroll">
        <div className="pad">
          <div className="card" style={{ gap: 14 }}>
            <FotoDePerfil onElegida={setPorAjustar} onError={setErrorFoto} />
            <div className="grow">
              <div className="h cut" style={{ fontSize: 24, textTransform: 'none' }}>{s.perfil?.nick}</div>
              <div className="m">Perfil público · {s.perfil?.region.join(', ')}</div>
            </div>
            <Link className="badge" to="/perfil/nivel" aria-label={`Nivel ${nivel}. Ver detalle`}>Nivel {nivel}</Link>
          </div>
          <div className="row">
            <div className="m grow">
              {guardandoFoto ? 'Guardando la foto…' : s.perfil?.foto ? 'Tocá tu foto para cambiarla.' : 'Tocá el círculo para elegir una foto de tu galería.'}
            </div>
            {s.perfil?.foto && (
              <button className="btn btn--ghost" style={{ flex: 'none' }} disabled={guardandoFoto} onClick={() => void quitarFoto()}>Quitar foto</button>
            )}
          </div>
          {errorFoto && <div className="err" role="alert">{errorFoto}</div>}

          <Pendientes />

          <h2 className="h sub sub--accent">Tus cuentas</h2>
          <div className="card card--row">
            <Avatar nombre="D" />
            <div className="grow"><div className="strong">Discord</div><div className="m cut">Conectado como {s.perfil?.username}</div></div>
            <span style={{ color: 'var(--accent)' }}><Icon name="check" /></span>
          </div>
          <div className="card card--row">
            <Avatar nombre="T" />
            <div className="grow"><div className="strong">TikTok</div><div className="m">{s.tiktok ? 'Conectado' : 'Sin vincular'}</div></div>
            <Link className={`btn${s.tiktok ? ' btn--sec' : ''}`} to="/clips/mis-videos">{s.tiktok ? 'Mis videos' : 'Vincular'}</Link>
          </div>
          {['YouTube', 'Kick'].map((n) => (
            <div key={n} className="card card--row">
              <Avatar nombre={n} />
              <div className="grow"><div className="strong">{n}</div><div className="m">Sin vincular</div></div>
              <span className="pill">Pronto</span>
            </div>
          ))}

          <div className="row">
            <Link className="btn btn--outline grow" to="/perfil/amigos">Amigos</Link>
            <Link className="btn btn--outline grow" to="/perfil/referir">Referir</Link>
          </div>

          <div className="row" style={{ alignItems: 'stretch' }}>
            <div className="card stat"><div className="h num">{jugados.length}</div><div className="m">amistosos jugados</div></div>
            <div className="card stat"><div className="h num">{asistencia}</div><div className="m">asistencia a partidos anotados</div></div>
          </div>

          <h2 className="h sub">Historial (público)</h2>
          <div className="card card--row">
            <Avatar user={masJugado ? s.usuarios[masJugado[0]] : undefined} size="sm" />
            <div className="grow">
              <div className="strong">Con quién más jugaste</div>
              <div className="m">
                {masJugado ? `${s.usuarios[masJugado[0]].username} · ${masJugado[1]} ${masJugado[1] === 1 ? 'amistoso' : 'amistosos'}` : 'Todavía no jugaste amistosos'}
              </div>
            </div>
          </div>
          <div className="card card--row">
            <Avatar size="sm" />
            <div className="grow">
              <div className="strong">Equipo al que más enfrentaste</div>
              <div className="m">Todavía sin datos</div>
            </div>
          </div>

          <Instalar />

          <div className="demo">
            <div className="h">Herramientas de prueba</div>
            <div className="m">Hoy en la demo: {fecha}. Avanzá un día para probar la racha y los topes diarios.</div>
            <button className="btn btn--sec" onClick={s.avanzarDia}>Avanzar un día</button>
            <button className="btn btn--sec" onClick={() => { s.reiniciar(); nav('/ingresar') }}>Reiniciar datos de prueba</button>
          </div>
          <CerrarSesion />
        </div>
      </div>
      <TabBar on="perfil" />
      {porAjustar && <Recortador foto={porAjustar} onGuardar={(f) => void terminarAjuste(f)} onCancelar={() => void terminarAjuste()} />}
    </div>
  )
}

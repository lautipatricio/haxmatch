import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { REAL } from '../config'
import {
  YO, buscarMia, cuantosSon, encajaJusto, enSala, jugadoresBuscando, miSala, nivelTexto, salasBuscando, useStore, usuarioDe,
} from '../data/store'
import { jugadoresPorEquipo } from '../domain/rules'
import { FALTAN, type Busqueda } from '../domain/types'
import { activarAvisos, tieneArreglo } from '../data/push'
import { Chips, Empty, Head, Persona, Sheet, TabBar, mmss, useAhora } from '../ui'

const lista = (v: readonly string[] | null) => (v ?? []).join(', ')
const faltan = (n: number | undefined) => `falta${n === 1 ? '' : 'n'} ${n ?? 1}`
const enumerar = (n: string[]) => (n.length <= 1 ? n[0] ?? '' : `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`)
const MIN = 60 * 1000

export function resumenBusqueda(b: Busqueda): string {
  if (b.modo === 'sala') return `${faltan(b.faltan)} · ${lista(b.cancha)} · sala "${b.nombreSala}"`
  const grupo = cuantosSon(b) > 1 ? `Grupo de ${cuantosSon(b)} · ` : ''
  return `${grupo}${lista(b.formato)} · ${lista(b.cancha)}`
}

/**
 * Fila de un jugador, un grupo o una sala, con el botón para mandarle un mensaje.
 * `soloVer`: sin el botón (en el Inicio, cuando todavía no estoy buscando).
 */
export function FilaDisponible({ b, detalle, soloVer }: { b: Busqueda; detalle?: string; soloVer?: boolean }) {
  const s = useStore()
  const ahora = useAhora()
  const u = usuarioDe(s, b.userId)
  const mia = buscarMia(s)
  // Lo que le mandé en esta búsqueda. Un "no" de una búsqueda anterior no cuenta.
  const desde = mia?.creadaAt ?? ahora - 10 * MIN
  const enviado = s.mensajes.find((m) => m.de === YO && m.a === b.userId && (m.estado === 'pendiente' || m.at >= desde))
  const somos = cuantosSon(mia)
  const son = cuantosSon(b)
  // No entran: mi grupo no cabe en esa sala, o ese grupo no cabe en la mía.
  const noEntran = b.modo === 'sala'
    ? somos > (b.faltan ?? 0)
    : mia?.modo === 'sala' && son > (mia.faltan ?? 0)
  const motivo = b.modo === 'sala' ? `Le ${faltan(b.faltan)} y ustedes son ${somos}` : `Son ${son} y te ${faltan(mia?.faltan)}`
  // Sumado al grupo de otro: los mensajes los manda quien lo armó.
  const sumado = !!mia?.liderId
  return (
    <div className="card card--row">
      <Persona user={u}>
        <span className="strong cut">
          {u.username}{son > 1 && ` +${son - 1}`}
          {s.amigos.includes(u.id) && <span className="tag tag--linea">AMIGO</span>}
          {/* Solo se marca cuando hay un grupo de por medio: con un jugador suelto no dice nada. */}
          {encajaJusto(s, b) && Math.max(somos, son) > 1 && <span className="tag">JUSTO</span>}
        </span>
        <span className="m cut">{noEntran ? motivo : detalle ?? `${nivelTexto(u)}${resumenBusqueda(b)}`}</span>
      </Persona>
      {soloVer ? null : enviado?.estado === 'pendiente' ? (
        <button className="btn btn--sec" disabled>Enviado</button>
      ) : enviado?.estado === 'rechazado' ? (
        <button className="btn btn--sec" disabled>No puede</button>
      ) : (
        <button className="btn btn--sec" disabled={noEntran || sumado} onClick={() => s.enviarMensaje(b.userId)}>Mensaje</button>
      )}
    </div>
  )
}

function Vacio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="vacio">
      <div className="strong">{titulo}</div>
      <div className="m">{texto}</div>
    </div>
  )
}

/** El grupo ya es un equipo completo: quien lo armó crea la sala y pasan a buscar rival. */
function CartelEquipoCompleto({ mia, onDespues }: { mia: Busqueda; onDespues: () => void }) {
  const convertir = useStore((s) => s.convertirEnSala)
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const n = jugadoresPorEquipo(mia.formato) ?? 1
  const somos = cuantosSon(mia)
  // En 1v1 ya están los dos: no falta nadie. En el resto falta el equipo rival.
  const rival = n === 1 ? 0 : n
  const crear = async () => {
    setOcupado(true)
    const e = await convertir({ nombreSala: nombre, faltan: rival, entreNosotros: rival === 0 })
    setOcupado(false)
    setError(e)
  }
  return (
    <Sheet title="Equipo completo">
      <div>
        Ya son {somos} para un {n}v{n}. Creá la sala en HaxBall y escribí el nombre.{' '}
        {rival > 0 ? `Van a figurar como sala a la que le faltan ${rival}.` : 'El otro jugador entra a tu sala.'}
      </div>
      <label className="m" htmlFor="sala-equipo">Nombre de la sala</label>
      <input id="sala-equipo" className="field" value={nombre} maxLength={40} autoComplete="off" placeholder="Como figura en HaxBall"
        onChange={(e) => { setNombre(e.target.value); setError(null) }} />
      {error && <div className="err" role="alert">{error}</div>}
      <button className="btn" disabled={ocupado} onClick={() => void crear()}>
        {rival > 0 ? 'Crear sala y buscar rival' : 'Crear sala'}
      </button>
      <button className="btn btn--ghost" onClick={onDespues}>Ahora no, seguir buscando una sala</button>
    </Sheet>
  )
}

/** Pasaron los 15 minutos: renovar, jugar entre los del grupo o armar una sala. */
function CartelQuinceMinutos({ mia }: { mia: Busqueda }) {
  const s = useStore()
  const nav = useNavigate()
  const somos = cuantosSon(mia)
  const n = jugadoresPorEquipo(mia.formato)
  const [paso, setPaso] = useState<'opciones' | 'entre' | 'sala'>('opciones')
  const [nombre, setNombre] = useState('')
  const [cuantos, setCuantos] = useState<number>(Math.min(7, Math.max(1, n ? n * 2 - somos : 1)))
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const entre = somos === 2 ? 'Jugar un 1v1 entre nosotros' : somos === 3 ? 'Jugar un 1v1v1 entre nosotros' : 'Jugar entre nosotros'
  const crear = async () => {
    setOcupado(true)
    const e = await s.convertirEnSala({ nombreSala: nombre, faltan: cuantos, entreNosotros: paso === 'entre' })
    setOcupado(false)
    setError(e)
  }

  if (paso === 'opciones') {
    return (
      <Sheet title="Pasaron 15 minutos">
        <div>{somos > 1 ? `Siguen siendo ${somos} y no apareció una sala.` : 'Todavía no apareció un partido.'} ¿Cómo seguimos?</div>
        <button className="btn" onClick={s.renovarBusqueda}>Renovar la búsqueda</button>
        {somos > 1 && <button className="btn btn--sec" onClick={() => setPaso('entre')}>{entre}</button>}
        <button className="btn btn--sec" onClick={() => setPaso('sala')}>
          {somos > 1 ? 'Crear una sala entre nosotros y seguir buscando' : 'Crear una sala y buscar jugadores'}
        </button>
        <button className="btn btn--ghost" onClick={() => { s.cancelarBusqueda(); nav('/') }}>Dejar de buscar</button>
      </Sheet>
    )
  }
  return (
    <Sheet title={paso === 'entre' ? entre : 'Crear una sala'}>
      <div>
        Creá la sala en HaxBall y escribí el nombre.{' '}
        {paso === 'entre' ? 'Los del grupo entran a tu sala y no se busca a nadie más.' : 'Los del grupo entran a tu sala y la app sigue buscando al resto.'}
      </div>
      <label className="m" htmlFor="sala-quince">Nombre de la sala</label>
      <input id="sala-quince" className="field" value={nombre} maxLength={40} autoComplete="off" placeholder="Como figura en HaxBall"
        onChange={(e) => { setNombre(e.target.value); setError(null) }} />
      {paso === 'sala' && <Chips label="Cuántos faltan" options={FALTAN} value={cuantos} onChange={setCuantos} />}
      {error && <div className="err" role="alert">{error}</div>}
      <button className="btn" disabled={ocupado} onClick={() => void crear()}>Crear sala</button>
      <button className="btn btn--sec" onClick={() => setPaso('opciones')}>Volver</button>
    </Sheet>
  )
}

/** Jugadores que ya tienen lugar en mi sala: primero "Ya entró", después "Se salió". */
function EnMiSala({ onEntro }: { onEntro: (uid: string) => void }) {
  const s = useStore()
  const otros = enSala(miSala(s))
  if (otros.length === 0) return null
  return (
    <>
      <h2 className="h sub">En tu sala</h2>
      {otros.map((p) => {
        const u = usuarioDe(s, p.userId)
        const adentro = !!p.entroAt
        if (adentro) {
          return (
            <div key={p.userId} className="card card--row">
              <Persona user={u}>
                <span className="strong cut">{u.username}</span>
                <span className="m cut">{p.confirmadoAt ? 'Adentro · confirmó' : 'Adentro'}</span>
              </Persona>
              <button className="btn btn--sec" aria-label={`${u.username} se salió`} onClick={() => s.marcarSalio(p.userId)}>Se salió</button>
            </div>
          )
        }
        // Todavía no entró: o confirma que entró, o libera el lugar si no va a venir.
        return (
          <div key={p.userId} className="card card--col card--accent" style={{ gap: 12 }}>
            <div className="row">
              <Persona user={u}>
                <span className="strong cut">{u.username}</span>
                <span className="m cut">Aceptado · todavía no entró</span>
              </Persona>
            </div>
            <div className="row">
              <button className="btn grow" aria-label={`Ya entró ${u.username} a la sala`} onClick={() => onEntro(p.userId)}>Ya entró</button>
              <button className="btn btn--sec grow" aria-label={`${u.username} no vino`} onClick={() => s.marcarSalio(p.userId)}>No vino</button>
            </div>
          </div>
        )
      })}
      <div className="chips" style={{ alignItems: 'center' }}>
        <span className="m">Reportar a</span>
        {otros.map((p) => (
          <Link key={p.userId} className="chip" to={`/reportar/${p.userId}`}>
            {usuarioDe(s, p.userId).username}
          </Link>
        ))}
      </div>
    </>
  )
}

export function Buscando() {
  const s = useStore()
  const mia = buscarMia(s)
  const ahora = useAhora()
  const nav = useNavigate()
  const [espera, setEspera] = useState(true)
  /** Jugadores aceptados cuyo cartel "Ya entró" se pospuso con "Todavía no". */
  const [pospuestos, setPospuestos] = useState<string[]>([])
  /** El cartel de "Equipo completo" se puede dejar para después, para seguir mirando la cola. */
  const [equipoDespues, setEquipoDespues] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setEspera(false), 600)
    return () => clearTimeout(t)
  }, [])
  const cargando = espera || !s.colaLista
  // "Sí, avisarme": además de los avisos dentro de la app, activa las notificaciones de este celular.
  const avisarme = async () => {
    const problema = await activarAvisos()
    if (tieneArreglo(problema)) useStore.setState((st) => ({ toasts: [...st.toasts, { id: `avisos-${Date.now()}`, texto: 'Avisos del celular sin activar', detalle: problema ?? '', to: '/perfil', toLabel: 'Ver' }].slice(-2) }))
  }
  // Si alguien pospuesto deja la sala y después vuelve, su cartel aparece de nuevo.
  const enMiSala = enSala(miSala(s)).map((p) => p.userId).join(',')
  useEffect(() => {
    setPospuestos((p) => (p.every((u) => enMiSala.split(',').includes(u)) ? p : p.filter((u) => enMiSala.split(',').includes(u))))
  }, [enMiSala])

  if (!mia) {
    return (
      <div className="screen">
        {s.colaLista ? (
          <Empty title="No estás buscando" text="Tu búsqueda terminó o venció. Podés empezar otra cuando quieras.">
            <Link className="btn" to="/">Volver al inicio</Link>
          </Empty>
        ) : s.errorCola ? (
          <Empty title="Sin conexión con el servidor" text={s.errorCola}>
            <button className="btn" onClick={() => void s.refrescar()}>Reintentar</button>
          </Empty>
        ) : (
          <div className="pad" style={{ paddingTop: 'calc(24px + var(--safe-top))' }} role="status" aria-label="Cargando">
            <div className="skeleton" /><div className="skeleton" />
          </div>
        )}
        <TabBar on="inicio" />
      </div>
    )
  }

  const sala = mia.modo === 'sala'
  const jugadores = jugadoresBuscando(s)
  const salas = salasBuscando(s)
  const grupo = mia.grupo ?? []
  /** Me sumé a la búsqueda de otro: la maneja quien armó el grupo. */
  const lider = mia.liderId ? usuarioDe(s, mia.liderId) : null
  const completa = sala && (mia.faltan ?? 0) === 0
  const match = miSala(s)
  const conGente = enSala(match).length > 0
  const datos = sala
    ? `${completa ? 'Completa' : faltan(mia.faltan).replace('f', 'F')} · ${lista(mia.region)} · Cancha: ${lista(mia.cancha)}`
    : `${lista(mia.formato)} · ${lista(mia.region)} · Cancha: ${lista(mia.cancha)}`
  const esqueleto = <><div className="skeleton" /><div className="skeleton" /></>
  const vencida = mia.expiraAt !== null && mia.expiraAt <= ahora
  /** Cuánto dura la búsqueda (si vence) y qué parte ya pasó. Vencida, la barra va llena. */
  const duracion = mia.expiraAt !== null ? Math.round((mia.expiraAt - mia.creadaAt) / 1000) * 1000 : 0
  const plazo = duracion > 0 ? duracion : null
  const avance = vencida || !plazo ? 1 : Math.min(1, Math.max(0, (ahora - mia.creadaAt) / plazo))

  // Lo que me llegó y todavía no respondí. En mi sala se muestra como cartel; si busco partido, como lista.
  const recibidos = s.mensajes.filter((m) => m.a === YO && m.estado === 'pendiente')
  const pedido = sala ? recibidos[0] : undefined
  const quienes = pedido ? [pedido.de, ...(pedido.con ?? [])] : []
  const porEntrar = enSala(match).find((p) => !p.entroAt && !pospuestos.includes(p.userId))
  const nombre = (uid: string) => usuarioDe(s, uid).username

  let cartel: JSX.Element | null = null
  if (pedido) {
    const varios = quienes.length > 1
    const conNivel = quienes.filter((u) => usuarioDe(s, u).nivel !== null)
    cartel = (
      <Sheet title={`¿Aceptás a ${enumerar(quienes.map(nombre))}?`}>
        <div>
          {pedido.auto
            ? `La app ${varios ? `los conectó con tu sala: son un grupo de ${quienes.length}` : 'lo conectó con tu sala'}.`
            : `Te ${varios ? 'escribieron' : 'escribió'}: ${pedido.texto}`}
          {' '}Si {varios ? 'los' : 'lo'} aceptás, {varios ? `ocupan ${quienes.length} lugares` : 'ocupa un lugar'} y la sala sigue buscando al resto.
        </div>
        {conNivel.length > 0 && <div className="m">{conNivel.map((u) => `${nombre(u)} · Nivel ${usuarioDe(s, u).nivel}`).join(' · ')}</div>}
        <button className="btn" onClick={() => s.responderMensaje(pedido.id, true)}>Aceptar</button>
        <button className="btn btn--sec" onClick={() => s.responderMensaje(pedido.id, false)}>Rechazar</button>
      </Sheet>
    )
  } else if (porEntrar) {
    const n = nombre(porEntrar.userId)
    cartel = (
      <Sheet title={`${n} va a entrar`}>
        <div>Tocá “Ya entró {n} a la sala” cuando el jugador se encuentre dentro. Sin eso, el partido no cuenta como válido.</div>
        <div className="m">Si después se va, tocá “Se salió” y se libera su lugar.</div>
        <button className="btn" onClick={() => s.marcarEntro(porEntrar.userId)}>Ya entró {n} a la sala</button>
        <button className="btn btn--sec" onClick={() => setPospuestos((p) => [...p, porEntrar.userId])}>Todavía no</button>
        <button className="btn btn--ghost" onClick={() => s.marcarSalio(porEntrar.userId)}>No va a venir: liberar su lugar</button>
      </Sheet>
    )
  } else if (mia.equipoListo && !equipoDespues) {
    cartel = <CartelEquipoCompleto mia={mia} onDespues={() => setEquipoDespues(true)} />
  } else if (mia.ofertaHasta) {
    cartel = <CartelQuinceMinutos mia={mia} />
  } else if (mia.avisar === null) {
    cartel = (
      <Sheet title="¿Te avisamos?" clear>
        <div>
          {sala
            ? 'Te avisamos cuando alguien se postule a tu sala. Mientras tanto, mirá clips.'
            : 'Te avisamos cuando se arme un partido para vos. Mientras tanto, mirá clips.'}
        </div>
        <button className="btn" onClick={() => { void avisarme(); s.responderAviso(true); nav('/clips') }}>Sí, avisarme y ver clips</button>
        <button className="btn btn--sec" onClick={() => s.responderAviso(false)}>No, gracias</button>
      </Sheet>
    )
  }

  return (
    <div className="screen">
      <div className="screen">
      <Head chico back="/" title={completa ? 'Sala completa' : sala ? 'Buscando jugador' : 'Buscando partido'} />
      <div className="scroll">
        <div className="pad" style={{ paddingTop: 0 }}>
          <div className="reloj">
            <div className="reloj__fila">
              <div className="h num reloj__t" role="timer">{mmss((mia.completaAt ?? ahora) - mia.creadaAt)}</div>
              {plazo !== null && !completa && <div className="m num">de {mmss(plazo)}</div>}
            </div>
            {/* Con vencimiento, la barra muestra cuánto pasó; sin vencimiento, que se sigue buscando. */}
            <div className={`espera${completa || mia.expiraAt !== null ? '' : ' espera--libre'}`} aria-hidden="true">
              <div style={completa || mia.expiraAt === null ? undefined : { transform: `translateX(${Math.round((avance - 1) * 1000) / 10}%)` }} />
            </div>
            <div className="reloj__d">
              <div className="m">{datos}{sala && ` · Sala "${mia.nombreSala}"`}</div>
              <div className="m num">
                {completa ? 'Ya no se busca a nadie. Cuando entren todos, queda armado el match.'
                  : lider && vencida ? `Pasaron los 15 minutos. ${lider.username} decide cómo siguen.`
                  : mia.expiraAt ? `Vence en ${mmss(mia.expiraAt - ahora)}` : sala ? 'Sigue buscando hasta completarse' : 'Activa hasta conseguir partido'}
              </div>
            </div>
          </div>

          {!sala && recibidos.length > 0 && (
            <>
              <h2 className="h sub sub--accent">Te escribieron</h2>
              {recibidos.map((m) => {
                const u = usuarioDe(s, m.de)
                const con = m.con ?? []
                return (
                  <div key={m.id} className="card card--row card--accent">
                    <Persona user={u}>
                      <span className="strong cut">{u.username}{con.length > 0 && ` +${con.length}`}</span>
                      <span className="m cut">{m.texto}</span>
                    </Persona>
                    <div className="acts">
                      <button className="btn" aria-label={`Aceptar a ${u.username}`} onClick={() => s.responderMensaje(m.id, true)}>Aceptar</button>
                      <button className="btn btn--sec" aria-label={`Rechazar a ${u.username}`} onClick={() => s.responderMensaje(m.id, false)}>No</button>
                    </div>
                  </div>
                )
              })}
              <div className="m">Si aceptás a un jugador, te sumás a su búsqueda. Si aceptás una sala, entrás a jugar.</div>
            </>
          )}

          {sala && <EnMiSala onEntro={s.marcarEntro} />}

          {grupo.length > 0 && (
            <>
              <h2 className="h sub">Buscan con vos</h2>
              {grupo.map((uid) => {
                const u = usuarioDe(s, uid)
                return (
                  <div key={uid} className="card card--row card--accent">
                    <Persona user={u}>
                      <span className="strong cut">
                        {u.username}
                        {s.amigos.includes(uid) && <span className="tag tag--linea">AMIGO</span>}
                      </span>
                      <span className="m cut">
                        {nivelTexto(u)}{uid === mia.liderId ? 'armó el grupo y maneja la búsqueda' : 'mismo reloj y misma búsqueda'}
                      </span>
                    </Persona>
                  </div>
                )
              })}
              {lider && (
                <div className="m">
                  Te sumaste a la búsqueda de {lider.username}. Los mensajes a otros jugadores y a las salas los manda {lider.username}.
                </div>
              )}
            </>
          )}

          {!completa && (
            <>
              <h2 className="h sub">Jugadores buscando partidos</h2>
              {cargando ? esqueleto : jugadores.length === 0 ? (
                <Vacio titulo="Nadie más buscando ahora" texto="Cuando alguien se ponga a buscar aparece acá." />
              ) : (
                jugadores.map((b) => <FilaDisponible key={b.id} b={b} />)
              )}
              {!lider && (
                <div className="m">
                  {sala
                    ? 'La app te acerca sola a los que encajan, primero un grupo que sea justo los que te faltan. También podés escribirles vos.'
                    : 'Si un jugador acepta tu mensaje, se suma a tu búsqueda y siguen buscando juntos.'}
                </div>
              )}
            </>
          )}

          {!sala && (
            <>
              <h2 className="h sub">Salas buscando jugadores</h2>
              {cargando ? esqueleto : salas.length === 0 ? (
                <Vacio titulo="No hay salas buscando ahora" texto="Cuando una sala necesite jugadores aparece acá." />
              ) : (
                salas.map((b) => <FilaDisponible key={b.id} b={b} />)
              )}
              <div className="m">
                La app te conecta sola con una sala donde {grupo.length ? 'entren todos' : 'entres'}.
                {!lider && ' Si le escribís a una y te acepta, se genera el match aunque no sea lo que buscabas.'}
              </div>
            </>
          )}

          <button className="btn btn--quieto btn--block" style={{ marginTop: 8 }}
            onClick={() => { s.cancelarBusqueda(); nav('/') }}>
            {conGente ? 'Cerrar sala' : lider ? 'Salir del grupo' : 'Cancelar búsqueda'}
          </button>

          {!completa && !REAL && (
            <div className="demo">
              <div className="h">Herramientas de prueba</div>
              <button className="btn btn--sec" onClick={s.emparejarAhora}>
                {sala ? 'Simular que la app encuentra jugadores' : 'Simular que la app encuentra una sala'}
              </button>
              {!sala && mia.expiraAt !== null && !mia.ofertaHasta && (
                <button className="btn btn--sec" onClick={s.simularQuinceMinutos}>Simular que pasaron 15 minutos</button>
              )}
            </div>
          )}
          {cartel && <div style={{ height: 250 }} aria-hidden="true" />}
        </div>
      </div>
      {cartel}
      </div>
      <TabBar on="inicio" />
    </div>
  )
}

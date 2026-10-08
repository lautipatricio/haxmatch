import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { REAL } from '../config'
import {
  YO, buscarMia, cuantosSon, encajaJusto, enSala, jugadoresBuscando, miSala, nivelTexto, salasBuscando, useStore, usuarioDe,
} from '../data/store'
import { FALTAN, type Busqueda } from '../domain/types'
import { TEXTO_AVISOS, activarAvisos, estadoAvisos, type EstadoAvisos } from '../data/push'
import { Chips, Conectado, Empty, Head, Persona, Sheet, TabBar, mmss, useAhora } from '../ui'

const lista = (v: readonly string[] | null) => (v ?? []).join(', ')
/** Lo que alguien eligió de verdad: "Cualquiera" y "Polifuncional" no dicen nada. */
const concretas = (v: readonly string[] | null | undefined) => (v ?? []).filter((x) => x !== 'Cualquiera' && x !== 'Polifuncional')
const faltan = (n: number | undefined) => `falta${n === 1 ? '' : 'n'} ${n ?? 1}`
const enumerar = (n: string[]) => (n.length <= 1 ? n[0] ?? '' : `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`)
const MIN = 60 * 1000

/** Un renglón que resume una búsqueda. De una sala: qué le falta y dónde. De un jugador: con cuántos va y su región. */
export function resumenBusqueda(b: Busqueda): string {
  if (b.modo === 'sala') {
    return [`sala "${b.nombreSala}"`, faltan(b.faltan), concretas(b.posicion).join('/'), concretas(b.cancha).join(', ')].filter(Boolean).join(' · ')
  }
  return [cuantosSon(b) > 1 ? `Grupo de ${cuantosSon(b)}` : '', concretas(b.formato).join(', '), lista(b.region)].filter(Boolean).join(' · ')
}

/**
 * Fila de un jugador, un grupo o una sala, con el botón para mandarle un mensaje.
 * Si tengo una sala, el botón es "Invitar": al jugador le llega la invitación y, si acepta, entra.
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
  /** Tengo una sala y esto es un jugador: lo que mando es una invitación. */
  const invito = mia?.modo === 'sala' && b.modo === 'jugador'
  // "No puede": solo si dijo que no, y por los 2 minutos en que el servidor no deja insistirle.
  // Si el pedido se cayó solo (la sala se llenó y después se liberó un lugar), se puede volver a invitar ya.
  // Con un servidor que todavía no manda ese dato, queda como antes: vale por toda la búsqueda.
  const dijoQueNo = enviado?.estado === 'rechazado' && enviado.dijoNo !== false &&
    (enviado.rechazoAt == null || ahora - enviado.rechazoAt < 2 * MIN)
  return (
    <div className="card card--row">
      <Persona user={u}>
        <span className="strong cut">
          {u.username}<Conectado id={u.id} />{son > 1 && ` +${son - 1}`}
          {s.amigos.includes(u.id) && <span className="tag tag--linea">AMIGO</span>}
          {/* Solo se marca cuando hay un grupo de por medio: con un jugador suelto no dice nada. */}
          {encajaJusto(s, b) && Math.max(somos, son) > 1 && <span className="tag">JUSTO</span>}
        </span>
        <span className="m cut">{noEntran ? motivo : detalle ?? `${nivelTexto(u)}${resumenBusqueda(b)}`}</span>
      </Persona>
      {soloVer ? null : enviado?.estado === 'pendiente' ? (
        <button className="btn btn--sec" disabled>{invito ? 'Invitado' : 'Enviado'}</button>
      ) : dijoQueNo ? (
        <button className="btn btn--sec" disabled>No puede</button>
      ) : (
        <button className="btn btn--sec" disabled={noEntran || sumado} onClick={() => s.enviarMensaje(b.userId)}>{invito ? 'Invitar' : 'Mensaje'}</button>
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

/**
 * Seguir de otra forma. Sale solo a los 15 minutos (renovar, jugar entre los del grupo
 * o armar una sala), y también lo abre quien armó un grupo para crear su sala cuando quiera.
 */
function CartelSeguir({ mia, porTiempo, onCerrar }: { mia: Busqueda; porTiempo: boolean; onCerrar: () => void }) {
  const s = useStore()
  const nav = useNavigate()
  const somos = cuantosSon(mia)
  const [paso, setPaso] = useState<'opciones' | 'entre' | 'sala'>('opciones')
  const [nombre, setNombre] = useState('')
  const [cuantos, setCuantos] = useState<number>(1)
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
      <Sheet title={porTiempo ? 'Pasaron 15 minutos' : 'Armar una sala'}>
        <div>
          {porTiempo
            ? `${somos > 1 ? `Siguen siendo ${somos} y no apareció una sala.` : 'Todavía no apareció un partido.'} ¿Cómo seguimos?`
            : `Son ${somos}. Uno crea la sala en HaxBall y los demás entran.`}
        </div>
        {porTiempo && <button className="btn" onClick={s.renovarBusqueda}>Renovar la búsqueda</button>}
        {somos > 1 && <button className={`btn${porTiempo ? ' btn--sec' : ''}`} onClick={() => setPaso('entre')}>{entre}</button>}
        <button className="btn btn--sec" onClick={() => setPaso('sala')}>
          {somos > 1 ? 'Crear una sala entre nosotros y seguir buscando' : 'Crear una sala y buscar jugadores'}
        </button>
        {porTiempo
          ? <button className="btn btn--ghost" onClick={() => { s.cancelarBusqueda(); nav('/') }}>Dejar de buscar</button>
          : <button className="btn btn--ghost" onClick={onCerrar}>Ahora no</button>}
      </Sheet>
    )
  }
  return (
    <Sheet title={paso === 'entre' ? entre : 'Crear una sala'}>
      <div>
        Creá la sala en HaxBall y escribí el nombre.{' '}
        {paso === 'entre' ? 'Los del grupo entran a tu sala y no se busca a nadie más.' : 'Los del grupo entran a tu sala y después invitás al resto desde la lista.'}
      </div>
      <label className="m" htmlFor="sala-nueva">Nombre de la sala</label>
      <input id="sala-nueva" className="field" value={nombre} maxLength={40} autoComplete="off" placeholder="Como figura en HaxBall"
        onChange={(e) => { setNombre(e.target.value); setError(null) }} />
      {paso === 'sala' && <Chips label="Cuántos faltan" options={FALTAN} value={cuantos} onChange={setCuantos} />}
      {error && <div className="err" role="alert">{error}</div>}
      <button className="btn" disabled={ocupado} onClick={() => void crear()}>Crear sala</button>
      <button className="btn btn--sec" onClick={() => setPaso('opciones')}>Volver</button>
    </Sheet>
  )
}

/** Si este celular todavía no recibe avisos, se ofrece activarlos: así una invitación llega aunque la app esté cerrada. */
function OfrecerAvisos({ sala }: { sala: boolean }) {
  const [estado, setEstado] = useState<EstadoAvisos | null>(null)
  const [problema, setProblema] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  useEffect(() => {
    let vivo = true
    void estadoAvisos().then((e) => { if (vivo) setEstado(e) })
    return () => { vivo = false }
  }, [])
  // iPhone sin la app instalada: no hay botón que valga, pero sí cómo arreglarlo.
  const faltaInstalar = estado === 'falta-instalar'
  if (estado !== 'apagados' && !faltaInstalar && !problema) return null
  const activar = async () => {
    setOcupado(true)
    setProblema(await activarAvisos())
    setEstado(await estadoAvisos())
    setOcupado(false)
  }
  return (
    <div className="card card--col">
      <div className="row">
        <div className="grow">
          <div className="strong">Enterate aunque cierres la app</div>
          <div className="m">{sala ? 'Te avisamos cuando te respondan o alguien quiera entrar a tu sala.' : 'Te avisamos cuando una sala te invite a jugar.'}</div>
        </div>
        {estado === 'apagados' && (
          <button className="btn btn--sec" style={{ flex: 'none' }} disabled={ocupado} onClick={() => void activar()}>Activar avisos</button>
        )}
      </div>
      {faltaInstalar && <div className="m">{TEXTO_AVISOS['falta-instalar']}</div>}
      {problema && <div className="err" role="alert">{problema}</div>}
    </div>
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
  /** Quien armó un grupo abrió el cartel para crear su sala. */
  const [armar, setArmar] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setEspera(false), 600)
    return () => clearTimeout(t)
  }, [])
  const cargando = espera || !s.colaLista
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
  const canchas = concretas(mia.cancha)
  const datos = (sala
    ? [completa ? 'Completa' : faltan(mia.faltan).replace('f', 'F'), concretas(mia.posicion).join('/'), lista(mia.region), canchas.length ? `Cancha: ${canchas.join(', ')}` : '']
    : [concretas(mia.formato).join(', '), `Región: ${lista(mia.region)}`]
  ).filter(Boolean).join(' · ')
  const esqueleto = <><div className="skeleton" /><div className="skeleton" /></>
  const vencida = mia.expiraAt !== null && mia.expiraAt <= ahora
  /** Cuánto dura la búsqueda (si vence) y qué parte ya pasó. Vencida, la barra va llena. */
  const duracion = mia.expiraAt !== null ? Math.round((mia.expiraAt - mia.creadaAt) / 1000) * 1000 : 0
  const plazo = duracion > 0 ? duracion : null
  const avance = vencida || !plazo ? 1 : Math.min(1, Math.max(0, (ahora - mia.creadaAt) / plazo))

  // Lo que me llegó y todavía no respondí. En mi sala, y cuando una sala me invita, se muestra
  // como cartel; lo que me escribe otro jugador que busca partido, como lista.
  const pendientes = s.mensajes.filter((m) => m.a === YO && m.estado === 'pendiente')
  const salaDe = (uid: string) => s.busquedas.find((b) => b.userId === uid && b.estado === 'activa' && b.modo === 'sala')
  const pedido = sala ? pendientes[0] : undefined
  const invitacion = sala ? undefined : pendientes.find((m) => salaDe(m.de))
  const recibidos = pendientes.filter((m) => !salaDe(m.de))
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
  } else if (invitacion) {
    const dueno = usuarioDe(s, invitacion.de)
    cartel = (
      <Sheet title="Te invitan a jugar">
        <div>{invitacion.texto}</div>
        <div className="m">
          Sala de {dueno.username}{dueno.nivel !== null && ` · Nivel ${dueno.nivel}`}.{' '}
          {grupo.length ? `Si aceptás, entran los ${grupo.length + 1} del grupo.` : 'Si aceptás, entrás directo.'}
        </div>
        <button className="btn" onClick={() => s.responderMensaje(invitacion.id, true)}>Sí, quiero jugar</button>
        <button className="btn btn--sec" onClick={() => s.responderMensaje(invitacion.id, false)}>Ahora no</button>
      </Sheet>
    )
  } else if (!sala && mia.ofertaHasta) {
    cartel = <CartelSeguir mia={mia} porTiempo onCerrar={() => setArmar(false)} />
  } else if (!sala && armar && !lider && grupo.length > 0) {
    cartel = <CartelSeguir mia={mia} porTiempo={false} onCerrar={() => setArmar(false)} />
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
              <div className="m">Si aceptás, te sumás a su búsqueda y siguen buscando juntos.</div>
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
              {lider ? (
                <div className="m">
                  Te sumaste a la búsqueda de {lider.username}. Los mensajes a otros jugadores y las invitaciones de las salas los maneja {lider.username}.
                </div>
              ) : !sala && (
                // Quien armó el grupo puede crear la sala cuando quiera, sin esperar los 15 minutos.
                <button className="btn btn--sec" onClick={() => setArmar(true)}>Armar una sala con el grupo</button>
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
                Cuando una sala te invita, te avisamos y elegís si {grupo.length ? 'entran' : 'entrás'}.
                {!lider && ' También podés escribirle vos a una sala: si te acepta, entrás.'}
              </div>
            </>
          )}

          {!completa && (
            <>
              <h2 className="h sub">Jugadores buscando partidos</h2>
              {cargando ? esqueleto : jugadores.length === 0 ? (
                <Vacio titulo="Nadie más buscando ahora" texto={sala ? 'Cuando alguien se ponga a buscar aparece acá, para que lo invites.' : 'Cuando alguien se ponga a buscar aparece acá.'} />
              ) : (
                jugadores.map((b) => <FilaDisponible key={b.id} b={b} />)
              )}
              {!lider && (
                <div className="m">
                  {sala
                    ? 'Elegí a quién invitar. Le llega el aviso con los datos de tu sala y, si acepta, ocupa un lugar.'
                    : 'Si un jugador acepta tu mensaje, se suma a tu búsqueda y siguen buscando juntos.'}
                </div>
              )}
            </>
          )}

          {!completa && <OfrecerAvisos sala={sala} />}

          <button className="btn btn--quieto btn--block" style={{ marginTop: 8 }}
            onClick={() => { s.cancelarBusqueda(); nav('/') }}>
            {conGente ? 'Cerrar sala' : lider ? 'Salir del grupo' : 'Cancelar búsqueda'}
          </button>

          {!sala && !REAL && (
            <div className="demo">
              <div className="h">Herramientas de prueba</div>
              {!lider && <button className="btn btn--sec" onClick={s.simularInvitacion}>Simular que una sala te invita</button>}
              {mia.expiraAt !== null && !mia.ofertaHasta && (
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

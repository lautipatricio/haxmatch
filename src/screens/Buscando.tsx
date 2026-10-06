import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  YO, buscarMia, cuantosSon, encajaJusto, jugadoresBuscando, miSala, salasBuscando, useStore,
} from '../data/store'
import { jugadoresPorEquipo } from '../domain/rules'
import { FALTAN, type Busqueda } from '../domain/types'
import { Avatar, Chips, Empty, Sheet, TabBar, mmss, useAhora } from '../ui'

const lista = (v: readonly string[] | null) => (v ?? []).join(', ')
const faltan = (n: number | undefined) => `falta${n === 1 ? '' : 'n'} ${n ?? 1}`
const enumerar = (n: string[]) => (n.length <= 1 ? n[0] ?? '' : `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`)

export function resumenBusqueda(b: Busqueda): string {
  if (b.modo === 'sala') return `${faltan(b.faltan)} · ${lista(b.cancha)} · sala "${b.nombreSala}"`
  const grupo = cuantosSon(b) > 1 ? `Grupo de ${cuantosSon(b)} · ` : ''
  return `${grupo}${lista(b.formato)} · ${lista(b.cancha)}`
}

/** Fila de un jugador, un grupo o una sala, con el botón para mandarle un mensaje. */
export function FilaDisponible({ b, detalle }: { b: Busqueda; detalle?: string }) {
  const s = useStore()
  const u = s.usuarios[b.userId]
  const mia = buscarMia(s)
  const enviado = s.mensajes.find((m) => m.de === YO && m.a === b.userId)
  const somos = cuantosSon(mia)
  const son = cuantosSon(b)
  // No entran: mi grupo no cabe en esa sala, o ese grupo no cabe en la mía.
  const noEntran = b.modo === 'sala'
    ? somos > (b.faltan ?? 0)
    : mia?.modo === 'sala' && son > (mia.faltan ?? 0)
  const motivo = b.modo === 'sala' ? `Le ${faltan(b.faltan)} y ustedes son ${somos}` : `Son ${son} y te ${faltan(mia?.faltan)}`
  return (
    <div className="card card--row">
      <Avatar user={u} size="sm" />
      <div className="grow">
        <div className="strong cut">
          {u.username}{son > 1 && ` +${son - 1}`}
          {s.amigos.includes(u.id) && <span className="tag">AMIGO</span>}
          {/* Solo se marca cuando hay un grupo de por medio: con un jugador suelto no dice nada. */}
          {encajaJusto(s, b) && Math.max(somos, son) > 1 && <span className="tag">JUSTO</span>}
        </div>
        <div className="m cut">{noEntran ? motivo : detalle ?? `Nivel ${u.nivel} · ${resumenBusqueda(b)}`}</div>
      </div>
      {enviado?.estado === 'pendiente' ? (
        <button className="btn btn--sec" disabled>Enviado</button>
      ) : enviado?.estado === 'rechazado' ? (
        <button className="btn btn--sec" disabled>No puede</button>
      ) : (
        <button className="btn btn--sec" disabled={noEntran} onClick={() => s.enviarMensaje(b.userId)}>Mensaje</button>
      )}
    </div>
  )
}

function Vacio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="card card--col center" style={{ padding: 20 }}>
      <div className="strong">{titulo}</div>
      <div className="m">{texto}</div>
    </div>
  )
}

/** El grupo ya es un equipo completo: quien lo armó crea la sala y pasan a buscar rival. */
function CartelEquipoCompleto({ mia }: { mia: Busqueda }) {
  const convertir = useStore((s) => s.convertirEnSala)
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState<string | null>(null)
  const n = jugadoresPorEquipo(mia.formato) ?? 1
  const somos = cuantosSon(mia)
  // En 1v1 ya están los dos: no falta nadie. En el resto falta el equipo rival.
  const rival = n === 1 ? 0 : n
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
      <button className="btn" onClick={() => setError(convertir({ nombreSala: nombre, faltan: rival, entreNosotros: rival === 0 }))}>
        {rival > 0 ? 'Crear sala y buscar rival' : 'Crear sala'}
      </button>
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
  const entre = somos === 2 ? 'Jugar un 1v1 entre nosotros' : somos === 3 ? 'Jugar un 1v1v1 entre nosotros' : 'Jugar entre nosotros'

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
      <button className="btn" onClick={() => setError(s.convertirEnSala({ nombreSala: nombre, faltan: cuantos, entreNosotros: paso === 'entre' }))}>
        Crear sala
      </button>
      <button className="btn btn--sec" onClick={() => setPaso('opciones')}>Volver</button>
    </Sheet>
  )
}

/** Jugadores que ya tienen lugar en mi sala: primero "Ya entró", después "Se salió". */
function EnMiSala({ onEntro }: { onEntro: (uid: string) => void }) {
  const s = useStore()
  const match = miSala(s)
  const otros = match?.participantes.filter((p) => p.userId !== YO) ?? []
  if (otros.length === 0) return null
  return (
    <>
      <h2 className="h sub">En tu sala</h2>
      {otros.map((p) => {
        const u = s.usuarios[p.userId]
        const adentro = !!p.entroAt
        return (
          <div key={p.userId} className={`card card--row${adentro ? '' : ' card--accent'}`}>
            <Avatar user={u} size="sm" />
            <div className="grow">
              <div className="strong cut">{u.username}</div>
              <div className="m cut">{adentro ? (p.confirmadoAt ? 'Adentro · confirmó' : 'Adentro') : 'Aceptado · todavía no entró'}</div>
            </div>
            {adentro ? (
              <button className="btn btn--sec" aria-label={`${u.username} se salió`} onClick={() => s.marcarSalio(p.userId)}>Se salió</button>
            ) : (
              <button className="btn" aria-label={`Ya entró ${u.username} a la sala`} onClick={() => onEntro(p.userId)}>Ya entró</button>
            )}
          </div>
        )
      })}
      <div className="chips" style={{ alignItems: 'center' }}>
        <span className="m">Reportar a</span>
        {otros.map((p) => (
          <Link key={p.userId} className="chip" to={`/reportar/${p.userId}`} style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }}>
            {s.usuarios[p.userId].username}
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
  const [cargando, setCargando] = useState(true)
  /** Jugadores aceptados cuyo cartel "Ya entró" se pospuso con "Todavía no". */
  const [pospuestos, setPospuestos] = useState<string[]>([])
  useEffect(() => {
    const t = setTimeout(() => setCargando(false), 600)
    return () => clearTimeout(t)
  }, [])

  if (!mia) {
    return (
      <div className="screen">
        <Empty title="No estás buscando" text="Tu búsqueda terminó o venció. Podés empezar otra cuando quieras.">
          <Link className="btn" to="/">Volver al inicio</Link>
        </Empty>
        <TabBar on="inicio" />
      </div>
    )
  }

  const sala = mia.modo === 'sala'
  const jugadores = jugadoresBuscando(s)
  const salas = salasBuscando(s)
  const grupo = mia.grupo ?? []
  const completa = sala && (mia.faltan ?? 0) === 0
  const match = miSala(s)
  const conGente = !!match && match.participantes.some((p) => p.userId !== YO)
  const datos = sala
    ? `${completa ? 'Completa' : faltan(mia.faltan).replace('f', 'F')} · ${lista(mia.region)} · Cancha: ${lista(mia.cancha)}`
    : `${lista(mia.formato)} · ${lista(mia.region)} · Cancha: ${lista(mia.cancha)}`
  const esqueleto = <><div className="skeleton" /><div className="skeleton" /></>

  // Carteles de mi sala: primero aceptar o rechazar, después "Ya entró".
  const pedido = sala ? s.mensajes.find((m) => m.a === YO && m.estado === 'pendiente') : undefined
  const quienes = pedido ? [pedido.de, ...(pedido.con ?? [])] : []
  const porEntrar = match?.participantes.find((p) => p.userId !== YO && !p.entroAt && !pospuestos.includes(p.userId))
  const nombre = (uid: string) => s.usuarios[uid]?.username ?? 'El jugador'

  let cartel: JSX.Element | null = null
  if (pedido) {
    const varios = quienes.length > 1
    cartel = (
      <Sheet title={`¿Aceptás a ${enumerar(quienes.map(nombre))}?`}>
        <div>
          {pedido.auto
            ? `La app ${varios ? `los conectó con tu sala: son un grupo de ${quienes.length}` : 'lo conectó con tu sala'}.`
            : `Te ${varios ? 'escribieron' : 'escribió'}: ${pedido.texto}`}
          {' '}Si {varios ? 'los' : 'lo'} aceptás, {varios ? `ocupan ${quienes.length} lugares` : 'ocupa un lugar'} y la sala sigue buscando al resto.
        </div>
        <div className="m">{quienes.map((u) => `${nombre(u)} · Nivel ${s.usuarios[u]?.nivel ?? 0}`).join(' · ')}</div>
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
      </Sheet>
    )
  } else if (mia.equipoListo) {
    cartel = <CartelEquipoCompleto mia={mia} />
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
        <button className="btn" onClick={() => { s.responderAviso(true); nav('/clips') }}>Sí, avisarme y ver clips</button>
        <button className="btn btn--sec" onClick={() => s.responderAviso(false)}>No, gracias</button>
      </Sheet>
    )
  }

  return (
    <div className="screen">
      <div className="screen">
      <div className="scroll">
        <div className="pad" style={{ paddingTop: 'calc(20px + var(--safe-top))', gap: 8 }}>
          <h1 className="h title">{completa ? 'Sala completa' : sala ? 'Buscando jugador' : 'Buscando partido'}</h1>
          <div className="m">{datos}{sala && ` · Sala "${mia.nombreSala}"`}</div>
          <div className={`ring${completa ? ' ring--quieto' : ''}`}>
            <div className="h num" role="timer">{mmss((mia.completaAt ?? ahora) - mia.creadaAt)}</div>
          </div>
          <div className="m center num">
            {completa ? 'Ya no se busca a nadie. Cuando entren todos, queda armado el match.'
              : mia.expiraAt ? `Vence en ${mmss(mia.expiraAt - ahora)}` : sala ? 'Sigue buscando hasta completarse' : 'Activa hasta conseguir partido'}
          </div>

          {sala && <EnMiSala onEntro={s.marcarEntro} />}

          {grupo.length > 0 && (
            <>
              <h2 className="h sub">Buscan con vos</h2>
              {grupo.map((uid) => (
                <div key={uid} className="card card--row card--accent">
                  <Avatar user={s.usuarios[uid]} size="sm" />
                  <div className="grow">
                    <div className="strong cut">
                      {s.usuarios[uid].username}
                      {s.amigos.includes(uid) && <span className="tag">AMIGO</span>}
                    </div>
                    <div className="m cut">Nivel {s.usuarios[uid].nivel} · mismo reloj y misma búsqueda</div>
                  </div>
                </div>
              ))}
            </>
          )}

          {!completa && (
            <>
              <h2 className="h sub">Jugadores buscando partidos</h2>
              {cargando ? esqueleto : jugadores.length === 0 ? (
                <Vacio titulo="Nadie más buscando ahora" texto="Te avisamos cuando alguien responda." />
              ) : (
                jugadores.map((b) => <FilaDisponible key={b.id} b={b} />)
              )}
              <div className="m">
                {sala
                  ? 'La app te acerca sola a los que encajan, primero un grupo que sea justo los que te faltan. También podés escribirles vos.'
                  : 'Si un jugador acepta tu mensaje, se suma a tu búsqueda y siguen buscando juntos.'}
              </div>
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
                La app te conecta sola con una sala donde {grupo.length ? 'entren todos' : 'entres'}. Si le escribís a una y te acepta, se genera el match aunque no sea lo que buscabas.
              </div>
            </>
          )}

          <button className="btn btn--danger btn--block" style={{ marginTop: 8 }}
            onClick={() => { s.cancelarBusqueda(); nav('/') }}>
            {conGente ? 'Cerrar sala' : 'Cancelar búsqueda'}
          </button>

          {!completa && (
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

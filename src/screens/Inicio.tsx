import { useId, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { REAL } from '../config'
import { YO, buscarMia, nivelTexto, useStore, usuarioDe } from '../data/store'
import { enlaceKick } from '../data/kick'
import { BannerBusqueda, BannerMatch, Campana, Conectado, EtiquetaKick, Icon, Persona, TabBar, hace, useAhora } from '../ui'
import { FilaDisponible, resumenBusqueda } from './Buscando'

/** Lo que va adentro de cada una de las dos entradas: el título es su nombre y el renglón de abajo, su descripción. */
function Modo({ titulo, detalle, idTitulo, idDetalle, flecha = true }: { titulo: string; detalle: string; idTitulo: string; idDetalle: string; flecha?: boolean }) {
  return (
    <>
      <span className="grow">
        <span className="h" id={idTitulo}>{titulo}</span>
        <span className="modo__d" id={idDetalle}>{detalle}</span>
      </span>
      {flecha && <Icon name="flecha" size={24} />}
    </>
  )
}

/** "Quiero jugar un amistoso": un toque y ya está en la cola, sin formulario. */
function BotonJugar({ onError }: { onError: (texto: string | null) => void }) {
  const mia = useStore(buscarMia)
  const entrar = useStore((s) => s.entrarALaCola)
  const nav = useNavigate()
  const [ocupado, setOcupado] = useState(false)
  const ids = { idTitulo: useId(), idDetalle: useId() }
  const titulo = 'Quiero jugar un amistoso'
  if (mia?.modo === 'sala') {
    // Una sola búsqueda activa: con una sala abierta, esta opción queda bloqueada hasta cerrarla.
    return (
      <button className="modo modo--off" aria-disabled="true" aria-labelledby={ids.idTitulo} aria-describedby={ids.idDetalle}>
        <Modo titulo={titulo} detalle="Cancelá tu búsqueda actual para usar esta opción" flecha={false} {...ids} />
      </button>
    )
  }
  const tocar = async () => {
    if (mia) return nav('/buscando')
    setOcupado(true)
    onError(null)
    const error = await entrar()
    setOcupado(false)
    // Si ya tenía una búsqueda (la app todavía no se había enterado), no es un error: va a verla.
    if (error && !/búsqueda activa/i.test(error)) onError(error)
    else nav('/buscando')
  }
  return (
    <button className="modo modo--principal" disabled={ocupado} onClick={() => void tocar()} aria-labelledby={ids.idTitulo} aria-describedby={ids.idDetalle}>
      <Modo titulo={titulo} {...ids}
        detalle={mia ? 'Ya estás buscando. Tocá para ver cómo va.' : ocupado ? 'Entrando a la cola…' : 'Entrás directo a la cola y las salas te invitan'} />
    </button>
  )
}

/** "Necesito un jugador": lleva al formulario de la sala. */
function BotonSala() {
  const mia = useStore(buscarMia)
  const ids = { idTitulo: useId(), idDetalle: useId() }
  const titulo = 'Necesito un jugador'
  if (mia?.modo === 'jugador') {
    return (
      <button className="modo modo--off" aria-disabled="true" aria-labelledby={ids.idTitulo} aria-describedby={ids.idDetalle}>
        <Modo titulo={titulo} detalle="Cancelá tu búsqueda actual para usar esta opción" flecha={false} {...ids} />
      </button>
    )
  }
  return (
    <Link className={`modo${mia ? ' modo--principal' : ''}`} to={mia ? '/buscando' : '/sala'} aria-labelledby={ids.idTitulo} aria-describedby={ids.idDetalle}>
      <Modo titulo={titulo} {...ids}
        detalle={!mia ? 'Tenés sala y elegís a quién invitar' : mia.completaAt ? 'Tu sala está completa. Tocá para ver quién entró.' : 'Tu sala está buscando. Tocá para invitar jugadores.'} />
    </Link>
  )
}

/** Jugadores de HaxMatch transmitiendo en Kick ahora. */
function EnVivo() {
  const s = useStore()
  const vivos = Object.values(s.kick).filter((c) => c.enVivo && c.userId !== YO && !s.bloqueados.includes(c.userId))
  if (vivos.length === 0) return null
  return (
    <section className="lista" aria-label="En vivo en Kick">
      <h2 className="h sub">En vivo en Kick</h2>
      {vivos.map((c) => {
        const u = usuarioDe(s, c.userId)
        return (
          <div key={c.userId} className="card card--row">
            <Persona user={u}>
              <span className="strong cut">{u.username}<Conectado id={u.id} /><EtiquetaKick id={u.id} /></span>
              <span className="m cut">{c.titulo ?? `kick.com/${c.slug}`}</span>
            </Persona>
            <a className="btn btn--sec" href={enlaceKick(c.slug)} target="_blank" rel="noopener noreferrer" aria-label={`Ver el directo de ${u.username} en Kick`}>Ver</a>
          </div>
        )
      })}
    </section>
  )
}

/** Amigos que están buscando ahora. Para escribirles hay que estar buscando también. */
function AmigosBuscando() {
  const s = useStore()
  const ahora = useAhora()
  const disponibles = s.busquedas.filter((b) => b.estado === 'activa' && s.amigos.includes(b.userId))
  if (disponibles.length === 0) return null
  const buscando = !!buscarMia(s)
  return (
    <section className="lista" aria-label="Amigos buscando">
      <h2 className="h sub">Amigos buscando</h2>
      {disponibles.map((b) => (
        <FilaDisponible key={b.id} b={b} soloVer={REAL && !buscando}
          detalle={`${nivelTexto(s.usuarios[b.userId])}${resumenBusqueda(b)} · ${hace(ahora - b.creadaAt)}`} />
      ))}
      {REAL && !buscando && <div className="m">Para escribirles, primero ponete a buscar partido.</div>}
    </section>
  )
}

export function Inicio() {
  const busquedas = useStore((s) => s.busquedas)
  const colaLista = useStore((s) => s.colaLista)
  const errorCola = useStore((s) => s.errorCola)
  const nick = useStore((s) => s.perfil?.nick)
  const suspension = useStore((s) => s.suspension)
  /** Por qué no se pudo entrar a la cola (sin conexión, por ejemplo). */
  const [error, setError] = useState<string | null>(null)
  const activas = busquedas.filter((b) => b.estado === 'activa')

  return (
    <div className="screen">
      <header className="head">
        <div className="marca" aria-hidden="true">HAX<span>MATCH</span></div>
        <Campana desde="/" />
      </header>
      <div className="scroll">
        <div className="pad inicio">
          <div className="avisos"><BannerBusqueda /><BannerMatch /></div>
          <div className="hola">
            <h1 className={`h${(nick?.length ?? 0) > 12 ? ' hola--largo' : ''}`}>Hola, {nick}</h1>
            <div className={`vivo${colaLista && activas.length > 0 ? ' vivo--si' : ''}`}>
              <span>
                {!colaLista
                  ? errorCola ?? 'Buscando jugadores…'
                  : activas.length === 0
                  ? 'Nadie buscando ahora. Sé el primero.'
                  : `${activas.length} buscando ahora`}
              </span>
            </div>
          </div>
          {suspension && (
            <div className="err" role="alert">
              {suspension} Mientras tanto no podés buscar partido, escribirle a otros jugadores ni agregar amigos.
            </div>
          )}
          <div className="modos">
            <BotonJugar onError={setError} />
            <BotonSala />
            {error && !suspension && <div className="err" role="alert">{error}</div>}
          </div>
          <EnVivo />
          <AmigosBuscando />
        </div>
      </div>
      <TabBar on="inicio" />
    </div>
  )
}

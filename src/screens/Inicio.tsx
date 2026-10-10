import { useId, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { REAL } from '../config'
import { YO, buscarMia, nivelTexto, useStore, usuarioDe } from '../data/store'
import { enlaceKick } from '../data/kick'
import type { Busqueda } from '../domain/types'
import { BannerBusqueda, BannerMatch, Campana, Conectado, EtiquetaKick, Head, Icon, Persona, TabBar, hace, useAhora } from '../ui'
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
    let error = await entrar()
    // "Ya tenés una búsqueda activa" justo después de cancelar: el servidor todavía no se había
    // enterado. Se mira el estado y, si de verdad no hay búsqueda, se prueba una vez más.
    if (error && /búsqueda activa/i.test(error)) {
      await useStore.getState().refrescar()
      if (!buscarMia(useStore.getState())) error = await entrar()
    }
    setOcupado(false)
    // Si ya tenía una búsqueda (la app todavía no se había enterado), no es un error: va a verla.
    if (error && !/búsqueda activa/i.test(error)) onError(error)
    else if (error) nav('/buscando')
    // En la cola: mientras espera, mira clips. Arriba queda el aviso de que le avisamos.
    else nav('/clips')
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

/** Cuántos están en línea (contándote) y cuántos jugadores hay registrados. */
function Datos() {
  const enLinea = useStore((s) => s.conectados.filter((u) => u !== YO).length + 1)
  const registrados = useStore((s) => s.registrados)
  return (
    <div className="juegos__datos">
      <span className="latido" aria-hidden="true" />
      <span><b>{enLinea}</b> en línea</span>
      {registrados !== null && registrados > 0 && (
        <><span aria-hidden="true">·</span><span><b>{registrados}</b> jugadores registrados</span></>
      )}
    </div>
  )
}

/** Inicio: "¿Qué querés jugar hoy?". Tu foto en el centro, con los anillos, lleva a HaxBall. */
export function Inicio() {
  const perfil = useStore((s) => s.perfil)
  const suspension = useStore((s) => s.suspension)
  const nick = perfil?.nick ?? ''
  const inicial = nick.replace(/[^a-zA-Z0-9]/g, '').slice(0, 1).toUpperCase() || '?'
  return (
    <div className="screen juegos">
      <header className="head aparece">
        <div className="marca" aria-hidden="true">HAXMATCH</div>
      </header>
      <div className="scroll">
        <div className="pad juegos__pad">
          <div className="avisos"><BannerBusqueda /><BannerMatch /></div>
          <div className="juegos__hola aparece">
            <div className="juegos__saludo">Hola, {nick}</div>
            <Datos />
          </div>
          {suspension && (
            <div className="err" role="alert">
              {suspension} Mientras tanto no podés buscar partido, escribirle a otros jugadores ni agregar amigos.
            </div>
          )}
          <h1 className="juegos__titulo aparece aparece--2">¿Qué querés<br /><span>jugar hoy?</span></h1>
          <Link className="juego" to="/haxball" aria-label="Jugar HaxBall">
            <span className="juego__orbe aparece aparece--3" aria-hidden="true">
              <span className="juego__halo" />
              <svg className="juego__arco" viewBox="0 0 196 196"><circle cx="98" cy="98" r="96" className="juego__pista" /><circle cx="98" cy="98" r="96" className="juego__luz" strokeDasharray="90 513" /></svg>
              <svg className="juego__arco juego__arco--2" viewBox="0 0 168 168"><circle cx="84" cy="84" r="83" className="juego__pista juego__pista--2" /><circle cx="84" cy="84" r="83" className="juego__luz juego__luz--2" strokeDasharray="40 482" /></svg>
              <span className="juego__foto">
                {perfil?.foto ? <img src={perfil.foto} alt="" /> : inicial}
                <span className="juego__punto" />
              </span>
            </span>
            <span className="juego__nombre aparece aparece--3">HaxBall</span>
          </Link>
          <div className="juegos__mas aparece aparece--4">
            <span aria-hidden="true"><Icon name="mas" size={12} stroke={2} /></span>
            Más juegos, próximamente
          </div>
        </div>
      </div>
    </div>
  )
}

/** HaxBall: la cola y las salas en una sola pantalla. Desde acá se suma a la cola o abre su sala. */
export function HaxBall() {
  const s = useStore()
  const ahora = useAhora()
  /** Por qué no se pudo entrar a la cola (sin conexión, por ejemplo). */
  const [error, setError] = useState<string | null>(null)
  const activas = s.busquedas.filter((b) => b.estado === 'activa')
  const otras = activas.filter((b) => b.userId !== YO && !s.bloqueados.includes(b.userId))
  const jugadores = otras.filter((b) => b.modo === 'jugador')
  const salas = otras.filter((b) => b.modo === 'sala' && (b.faltan ?? 0) > 0 && !b.completaAt)
  const buscando = !!buscarMia(s)
  const fila = (b: Busqueda) => (
    <FilaDisponible key={b.id} b={b} soloVer={!buscando}
      detalle={`${nivelTexto(s.usuarios[b.userId])}${resumenBusqueda(b)} · ${hace(ahora - b.creadaAt)}`} />
  )
  return (
    <div className="screen">
      <Head title="HaxBall" back="/"><Campana desde="/haxball" /></Head>
      <div className="scroll">
        <div className="pad haxball">
          <div className="avisos"><BannerBusqueda /><BannerMatch /></div>
          <div className="marcador">
            <div className="marcador__n num">{s.colaLista ? activas.length : '–'}</div>
            <div className="marcador__d">
              <span className={`vivo${s.colaLista && activas.length > 0 ? ' vivo--si' : ''}`}>
                <span>{!s.colaLista ? s.errorCola ?? 'Buscando jugadores…' : 'buscando partido ahora'}</span>
              </span>
              {s.colaLista && activas.length === 0 && <span className="m">Sumate y te avisamos apenas una sala necesite gente.</span>}
            </div>
          </div>
          {s.suspension && (
            <div className="err" role="alert">
              {s.suspension} Mientras tanto no podés buscar partido, escribirle a otros jugadores ni agregar amigos.
            </div>
          )}
          <div className="modos">
            <BotonJugar onError={setError} />
            <BotonSala />
            {error && !s.suspension && <div className="err" role="alert">{error}</div>}
          </div>
          <section className="lista" aria-label="Quieren jugar un amistoso">
            <h2 className="h sub">Quieren jugar un amistoso</h2>
            {jugadores.length === 0
              ? <div className="vacio"><span className="m">Nadie en la cola en este momento.</span></div>
              : jugadores.map(fila)}
          </section>
          <section className="lista" aria-label="Equipos buscando jugadores">
            <h2 className="h sub">Equipos buscando jugadores</h2>
            {salas.length === 0
              ? <div className="vacio"><span className="m">Ningún equipo está buscando jugadores ahora.</span></div>
              : salas.map(fila)}
          </section>
          {otras.length > 0 && !buscando && REAL && <div className="m">Para escribirles, sumate a la cola o abrí tu sala.</div>}
          <EnVivo />
        </div>
      </div>
      <TabBar on="inicio" />
    </div>
  )
}

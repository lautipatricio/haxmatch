import { useId } from 'react'
import { Link } from 'react-router-dom'
import { REAL } from '../config'
import { buscarMia, nivelTexto, useStore } from '../data/store'
import type { Modo } from '../domain/types'
import { BannerBusqueda, BannerMatch, Campana, Icon, TabBar, hace, useAhora } from '../ui'
import { FilaDisponible, resumenBusqueda } from './Buscando'

/** Una de las dos entradas: el título es el nombre del enlace y el renglón de abajo, su descripción. */
function BotonModo({ modo, titulo, detalle, destino }: { modo: Modo; titulo: string; detalle: string; destino: string }) {
  const mia = useStore(buscarMia)
  const idTitulo = useId()
  const idDetalle = useId()
  if (mia && mia.modo !== modo) {
    // Una sola búsqueda activa: el otro modo queda bloqueado hasta cancelarla.
    return (
      <button className="modo modo--off" aria-disabled="true" aria-labelledby={idTitulo} aria-describedby={idDetalle}>
        <span className="grow">
          <span className="h" id={idTitulo}>{titulo}</span>
          <span className="modo__d" id={idDetalle}>Cancelá tu búsqueda actual para usar esta opción</span>
        </span>
      </button>
    )
  }
  // El amarillo va en "jugar un amistoso", salvo que la búsqueda abierta sea la de la sala.
  const principal = mia ? true : modo === 'jugador'
  return (
    <Link className={`modo${principal ? ' modo--principal' : ''}`} to={mia ? '/buscando' : destino} aria-labelledby={idTitulo} aria-describedby={idDetalle}>
      <span className="grow">
        <span className="h" id={idTitulo}>{titulo}</span>
        <span className="modo__d" id={idDetalle}>
          {!mia ? detalle : mia.modo === 'sala' && mia.completaAt ? 'Tu sala está completa. Tocá para ver quién entró.' : 'Ya estás buscando. Tocá para ver cómo va.'}
        </span>
      </span>
      <Icon name="flecha" size={24} />
    </Link>
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
  const activas = busquedas.filter((b) => b.estado === 'activa')
  const cuenta = new Map<string, number>()
  for (const b of activas) for (const f of b.formato ?? []) if (f !== 'Cualquiera') cuenta.set(f, (cuenta.get(f) ?? 0) + 1)
  const masActivo = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]

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
                  : `${activas.length} buscando ahora${masActivo ? ` · ${masActivo} es lo que más sale` : ''}`}
              </span>
            </div>
          </div>
          {suspension && (
            <div className="err" role="alert">
              {suspension} Mientras tanto no podés buscar partido, escribirle a otros jugadores ni agregar amigos.
            </div>
          )}
          <div className="modos">
            <BotonModo modo="jugador" titulo="Quiero jugar un amistoso" detalle="Entrás a la cola y te acercamos una sala" destino="/jugar" />
            <BotonModo modo="sala" titulo="Necesito un jugador" detalle="Ya tenés sala y te falta gente" destino="/sala" />
          </div>
          <AmigosBuscando />
        </div>
      </div>
      <TabBar on="inicio" />
    </div>
  )
}

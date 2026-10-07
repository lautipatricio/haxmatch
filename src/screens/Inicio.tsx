import { Link } from 'react-router-dom'
import { buscarMia, useStore } from '../data/store'
import type { Modo } from '../domain/types'
import { BannerBusqueda, BannerMatch, CerrarSesion } from '../ui'

function BotonModo({ modo, titulo, destino }: { modo: Modo; titulo: string; destino: string }) {
  const mia = useStore(buscarMia)
  if (mia && mia.modo !== modo) {
    // Una sola búsqueda activa: el otro modo queda bloqueado hasta cancelarla.
    return (
      <button className="bigbtn bigbtn--off" aria-disabled="true">
        <span className="h">{titulo}</span>
        <span>Cancelá tu búsqueda actual para usar esta opción</span>
      </button>
    )
  }
  return (
    <Link className="bigbtn" to={mia ? '/buscando' : destino}>
      <span className="h">{titulo}</span>
    </Link>
  )
}

export function Inicio() {
  const busquedas = useStore((s) => s.busquedas)
  const colaLista = useStore((s) => s.colaLista)
  const errorCola = useStore((s) => s.errorCola)
  const activas = busquedas.filter((b) => b.estado === 'activa')
  const cuenta = new Map<string, number>()
  for (const b of activas) for (const f of b.formato ?? []) if (f !== 'Cualquiera') cuenta.set(f, (cuenta.get(f) ?? 0) + 1)
  const masActivo = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]

  return (
    <div className="screen">
      <div style={{ paddingTop: 'calc(16px + var(--safe-top))', display: 'flex', flexDirection: 'column', gap: 8 }}><BannerBusqueda /><BannerMatch /></div>
      <div className="hero">
        <h1 className="h logo">Hax<br /><span>Match</span></h1>
        <div className="m" style={{ marginTop: 14 }}>Amistosos de HaxBall, sin vueltas</div>
        <div className="card" style={{ marginTop: 20, padding: '10px 16px' }}>
          <span style={{ fontSize: 13 }}>
            {!colaLista
              ? errorCola ?? 'Buscando jugadores…'
              : activas.length === 0
              ? 'Nadie buscando ahora. Sé el primero.'
              : `${activas.length} buscando ahora${masActivo ? ` · ${masActivo} es el más activo` : ''}`}
          </span>
        </div>
      </div>
      <div className="foot" style={{ gap: 12, paddingBottom: 'calc(12px + var(--safe-bottom))' }}>
        <BotonModo modo="jugador" titulo="Quiero jugar un amistoso" destino="/jugar" />
        <BotonModo modo="sala" titulo="Necesito un jugador" destino="/sala" />
        <div className="row">
          <Link className="chip grow" to="/clips" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }}>Ver clips</Link>
          <Link className="chip grow" to="/perfil" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }}>Ver perfil</Link>
        </div>
        <CerrarSesion />
      </div>
    </div>
  )
}

import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { YO, useStore } from '../data/store'
import type { Notif } from '../domain/types'
import { Empty, Head, Icon, TabBar, hace, useAhora } from '../ui'

function Accion({ n }: { n: Notif }) {
  const s = useStore()
  if (n.tipo === 'amigo_disponible' || n.tipo === 'amigo_sala') {
    const b = s.busquedas.find((x) => x.id === n.ref && x.estado === 'activa')
    if (!b) return null
    const enviado = s.mensajes.some((m) => m.de === YO && m.a === b.userId && m.estado === 'pendiente')
    return <button className="btn" disabled={enviado} onClick={() => s.enviarMensaje(b.userId)}>{enviado ? 'Enviado' : 'Mensaje'}</button>
  }
  if (n.tipo === 'mensaje') {
    const msg = s.mensajes.find((m) => m.id === n.ref)
    if (msg?.estado !== 'pendiente') return msg ? <span className="pill">{msg.estado === 'aceptado' ? 'Aceptaste' : 'Rechazaste'}</span> : null
    return (
      <div className="acts">
        <button className="btn" onClick={() => s.responderMensaje(msg.id, true)}>Aceptar</button>
        <button className="btn btn--sec btn--icon" aria-label="Rechazar" onClick={() => s.responderMensaje(msg.id, false)}><Icon name="x" size={18} /></button>
      </div>
    )
  }
  if (n.tipo === 'solicitud' && s.solicitudes.includes(n.ref ?? '')) return <Link className="btn" to="/perfil/amigos">Ver</Link>
  if (n.tipo === 'match' && n.ref) return <Link className="btn" to={`/match/${n.ref}`}>Ver</Link>
  return null
}

export function Notificaciones() {
  const notifs = useStore((s) => s.notifs)
  const marcarLeidas = useStore((s) => s.marcarLeidas)
  const ahora = useAhora()
  // Se marcan como leídas al salir, así se alcanza a ver cuáles eran nuevas.
  useEffect(() => marcarLeidas, [marcarLeidas])

  return (
    <div className="screen">
      <Head title="Notificaciones" back="/perfil" />
      {notifs.length === 0 ? (
        <Empty title="Sin notificaciones" text="Te avisamos cuando un amigo se ponga disponible, necesite jugadores o te escriba." />
      ) : (
        <div className="scroll">
          <div className="pad">
            {notifs.map((n) => (
              <div key={n.id} className="card card--row" style={n.leida ? undefined : { boxShadow: 'inset 0 0 0 1px var(--line)' }}>
                <div className="grow">
                  <div className="strong">{n.titulo}</div>
                  <div className="m">{n.detalle} · {hace(ahora - n.at)}</div>
                </div>
                <Accion n={n} />
              </div>
            ))}
            <p className="m center" style={{ margin: 0 }}>Solo recibís avisos sobre tus amigos.</p>
          </div>
        </div>
      )}
      <TabBar on="perfil" />
    </div>
  )
}

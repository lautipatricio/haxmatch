import { useState, type FormEvent } from 'react'
import { REAL } from '../config'
import { nivelTexto, useStore, usuarioDe } from '../data/store'
import { Avatar, Head, Icon, Persona, TabBar, hace, useAhora } from '../ui'
import { FilaDisponible, resumenBusqueda } from './Buscando'

export function Amigos() {
  const s = useStore()
  const ahora = useAhora()
  const [usuario, setUsuario] = useState('')
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const agregar = async (e: FormEvent) => {
    e.preventDefault()
    setOcupado(true)
    const r = await s.enviarSolicitud(usuario)
    setOcupado(false)
    setAviso(r)
    if (r.ok) setUsuario('')
  }

  const disponibles = s.busquedas.filter((b) => b.estado === 'activa' && s.amigos.includes(b.userId))
  const idsDisponibles = new Set(disponibles.map((b) => b.userId))
  const resto = s.amigos.filter((id) => !idsDisponibles.has(id))

  return (
    <div className="screen">
      <Head title="Amigos" back="/perfil" />
      <div className="scroll">
        <div className="pad">
          <form className="row" onSubmit={(e) => void agregar(e)}>
            <input id="buscar-amigo" className="field grow" value={usuario} placeholder="Usuario de Discord" aria-label="Usuario de Discord"
              autoComplete="off" autoCapitalize="none" onChange={(e) => { setUsuario(e.target.value); setAviso(null) }} />
            <button className="btn" type="submit" style={{ minHeight: 48 }} disabled={ocupado}>Agregar</button>
          </form>
          {aviso && <div className={aviso.ok ? 'ok' : 'err'} role="status">{aviso.texto}</div>}
          <div className="m">
            También podés tocar a cualquier jugador en la cola o en una sala para agregarlo.
          </div>

          {s.solicitudes.length > 0 && (
            <>
              <h2 className="h sub sub--accent">Solicitudes ({s.solicitudes.length})</h2>
              {s.solicitudes.map((id) => {
                const u = usuarioDe(s, id)
                return (
                  <div key={id} className="card card--row card--accent">
                    <Persona user={u}>
                      <span className="strong cut">{u.username}</span>
                      <span className="m cut">quiere ser tu amigo</span>
                    </Persona>
                    <div className="acts">
                      <button className="btn" aria-label={`Aceptar a ${u.username}`} onClick={() => s.responderSolicitud(id, true)}>Aceptar</button>
                      <button className="btn btn--sec btn--icon" aria-label={`Rechazar a ${u.username}`}
                        onClick={() => s.responderSolicitud(id, false)}><Icon name="x" size={18} /></button>
                    </div>
                  </div>
                )
              })}
            </>
          )}

          <h2 className="h sub">Disponibles ahora</h2>
          {disponibles.length === 0 ? (
            <div className="m">Ninguno de tus amigos está buscando partido en este momento.</div>
          ) : (
            disponibles.map((b) => (
              <FilaDisponible key={b.id} b={b}
                detalle={`${nivelTexto(s.usuarios[b.userId])}${resumenBusqueda(b)} · ${hace(ahora - b.creadaAt)}`} />
            ))
          )}
          {disponibles.length > 0 && !s.busquedas.some((b) => b.userId === 'yo' && b.estado === 'activa') && REAL && (
            <div className="m">Para escribirles, primero ponete a buscar partido desde el Inicio.</div>
          )}

          <h2 className="h sub">Tus amigos</h2>
          {s.amigos.length === 0 && s.solicitudesEnviadas.length === 0 && (
            <div className="m">Agregá amigos por su usuario de Discord. Te avisamos cuando se ponen a buscar partido.</div>
          )}
          {resto.map((id) => {
            const u = usuarioDe(s, id)
            return (
              <div key={id} className="card card--row">
                <Persona user={u}>
                  <span className="strong cut">{u.username}</span>
                  <span className="m cut">{REAL ? 'No está buscando' : 'Sin conexión'}</span>
                </Persona>
              </div>
            )
          })}
          {s.solicitudesEnviadas.map((id) => {
            const u = usuarioDe(s, id)
            return (
              <div key={id} className="card card--row">
                <Persona user={u}>
                  <span className="strong cut">{u.username}</span>
                  <span className="m cut">Solicitud enviada</span>
                </Persona>
              </div>
            )
          })}

          {s.bloqueados.length > 0 && (
            <>
              <h2 className="h sub">Bloqueados</h2>
              {s.bloqueados.map((id) => {
                const u = usuarioDe(s, id)
                return (
                  <div key={id} className="card card--row">
                    <Avatar user={u} size="sm" />
                    <div className="grow cut"><span className="strong">{u.username}</span></div>
                    <button className="btn btn--sec" onClick={() => s.alternarBloqueo(id)}>Desbloquear</button>
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>
      <TabBar on="perfil" />
    </div>
  )
}

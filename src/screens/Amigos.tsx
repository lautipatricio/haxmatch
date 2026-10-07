import { useState, type FormEvent } from 'react'
import { REAL } from '../config'
import { nivelTexto, useStore } from '../data/store'
import { Avatar, Head, Icon, TabBar, hace, useAhora } from '../ui'
import { FilaDisponible, resumenBusqueda } from './Buscando'

export function Amigos() {
  const s = useStore()
  const ahora = useAhora()
  const [usuario, setUsuario] = useState('')
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)

  const agregar = (e: FormEvent) => {
    e.preventDefault()
    const r = s.enviarSolicitud(usuario)
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
          {REAL ? (
            <div className="card card--col">
              <div className="strong">Los amigos llegan en la próxima actualización</div>
              <div className="m">Vas a poder agregarlos por su usuario de Discord y recibir un aviso cuando se pongan a buscar partido.</div>
            </div>
          ) : (
            <form className="row" onSubmit={agregar}>
              <input id="buscar-amigo" className="field grow" value={usuario} placeholder="Usuario de Discord" aria-label="Usuario de Discord"
                autoComplete="off" autoCapitalize="none" onChange={(e) => { setUsuario(e.target.value); setAviso(null) }} />
              <button className="btn" type="submit" style={{ minHeight: 48 }}>Agregar</button>
            </form>
          )}
          {aviso && <div className={aviso.ok ? 'ok' : 'err'} role="status">{aviso.texto}</div>}

          {s.solicitudes.length > 0 && (
            <>
              <h2 className="h sub">Solicitudes ({s.solicitudes.length})</h2>
              {s.solicitudes.map((id) => (
                <div key={id} className="card card--row">
                  <Avatar user={s.usuarios[id]} size="sm" />
                  <div className="grow">
                    <div className="strong cut">{s.usuarios[id].username}</div>
                    <div className="m">quiere ser tu amigo</div>
                  </div>
                  <div className="acts">
                    <button className="btn" onClick={() => s.responderSolicitud(id, true)}>Aceptar</button>
                    <button className="btn btn--sec btn--icon" aria-label={`Rechazar a ${s.usuarios[id].username}`}
                      onClick={() => s.responderSolicitud(id, false)}><Icon name="x" size={18} /></button>
                  </div>
                </div>
              ))}
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

          <h2 className="h sub">Tus amigos</h2>
          {resto.length === 0 && s.solicitudesEnviadas.length === 0 && (
            <div className="m">{REAL ? 'Todavía no tenés amigos agregados.' : 'Agregá amigos por su usuario de Discord. Solo te avisamos sobre ellos.'}</div>
          )}
          {resto.map((id) => (
            <div key={id} className="card card--row">
              <Avatar user={s.usuarios[id]} size="sm" />
              <div className="grow">
                <div className="strong cut">{s.usuarios[id].username}</div>
                <div className="m">Sin conexión</div>
              </div>
            </div>
          ))}
          {s.solicitudesEnviadas.map((id) => (
            <div key={id} className="card card--row">
              <Avatar user={s.usuarios[id]} size="sm" />
              <div className="grow">
                <div className="strong cut">{s.usuarios[id].username}</div>
                <div className="m">Solicitud enviada</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <TabBar on="perfil" />
    </div>
  )
}

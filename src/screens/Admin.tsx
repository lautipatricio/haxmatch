import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { Navigate } from 'react-router-dom'
import { REAL } from '../config'
import { YO, useStore, type Store } from '../data/store'
import { leerPanel, levantarDesdePanel, suspenderDesdePanel, type Panel, type PersonaPanel } from '../data/servidor'
import { Avatar, Head, TabBar, hace, useAhora } from '../ui'

const DIAS = [1, 3, 7, 30, 0] as const
const textoDias = (d: number) => (d === 0 ? 'Sin fin' : d === 1 ? '1 día' : `${d} días`)
const fecha = (t: number) => (t === Infinity ? 'sin fecha de fin' : new Date(t).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric', year: 'numeric' }))

/** En la demostración el panel muestra los jugadores de muestra. */
function panelDemo(s: Store): Panel {
  const otros = Object.values(s.usuarios).filter((u) => u.id !== YO)
  const ahora = s.ahora()
  const persona = (i: number): PersonaPanel => {
    const u = otros[i % otros.length]
    return { id: u.id, nick: u.username, username: u.username.toLowerCase(), foto: u.foto ?? null, conectado: s.conectados.includes(u.id), creadoAt: ahora - (i + 1) * 5 * 3600 * 1000 }
  }
  return {
    registrados: otros.length + 1, nuevosHoy: 2, nuevos7: 6, activosHoy: 7, activos7: otros.length,
    conectados: s.conectados.length, buscando: s.busquedas.filter((b) => b.estado === 'activa').length,
    amistososHoy: 3, amistosos: 41, mensajesChat: s.chat.length,
    ultimos: otros.map((_, i) => persona(i)),
    reportados: [{
      ...persona(7), reportes: 2, deDistintos: 2, motivos: 'Comportamiento tóxico', ultimo: ahora - 3600 * 1000, suspendidoHasta: null,
      detalle: [
        { cuando: ahora - 3600 * 1000, motivo: 'Comportamiento tóxico', detalle: 'Insultos en el chat' },
        { cuando: ahora - 26 * 3600 * 1000, motivo: 'Comportamiento tóxico', detalle: '' },
      ],
    }],
    suspendidos: [],
  }
}

function Numero({ n, texto }: { n: number; texto: string }) {
  return <div><span className="h num">{n}</span><span className="m">{texto}</span></div>
}

function Nombre({ u }: { u: PersonaPanel }) {
  return (
    <div className="grow" style={{ minWidth: 0 }}>
      <div className="strong cut">{u.nick}{u.conectado && <span className="en-linea" role="img" aria-label="conectado" />}</div>
      <div className="m cut">@{u.username}</div>
    </div>
  )
}

/** Suspender: cuántos días y por qué. */
function Suspender({ u, onListo }: { u: PersonaPanel; onListo: (texto: string) => void }) {
  const [abierto, setAbierto] = useState(false)
  const [dias, setDias] = useState<number>(7)
  const [motivo, setMotivo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!abierto) return <button className="btn btn--sec" onClick={() => setAbierto(true)}>Suspender</button>
  const confirmar = async () => {
    setOcupado(true)
    setError(null)
    const r = REAL ? await suspenderDesdePanel(u.id, dias, motivo) : { texto: `${u.nick} quedó suspendido (${textoDias(dias)}).` }
    setOcupado(false)
    if (r.error) return setError(r.error)
    setAbierto(false)
    onListo(r.texto ?? 'Listo.')
  }
  return (
    <div className="reportado" style={{ width: '100%', borderTop: '1px solid var(--line)', paddingTop: 12 }}>
      <div className="strong">Suspender a {u.nick}</div>
      <div className="chips" role="group" aria-label="Por cuánto tiempo">
        {DIAS.map((d) => (
          <button key={d} type="button" className="chip" aria-pressed={dias === d} onClick={() => setDias(d)}>{textoDias(d)}</button>
        ))}
      </div>
      <input className="field" value={motivo} maxLength={200} placeholder="Motivo (lo va a ver la persona)" aria-label="Motivo" onChange={(e) => setMotivo(e.target.value)} />
      <div className="m">No va a poder buscar partido, escribir en el chat, invitar ni agregar amigos. Si estaba buscando, deja de buscar.</div>
      {error && <div className="err" role="alert">{error}</div>}
      <div className="acciones">
        <button className="btn" disabled={ocupado} onClick={() => void confirmar()}>{ocupado ? 'Suspendiendo…' : `Suspender · ${textoDias(dias)}`}</button>
        <button className="btn btn--ghost" disabled={ocupado} onClick={() => setAbierto(false)}>Cancelar</button>
      </div>
    </div>
  )
}

function Levantar({ u, onListo }: { u: PersonaPanel; onListo: (texto: string) => void }) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tocar = async () => {
    setOcupado(true)
    const r = REAL ? await levantarDesdePanel(u.id) : { texto: 'Listo: la cuenta ya no está suspendida.' }
    setOcupado(false)
    if (r.error) setError(r.error)
    else onListo(r.texto ?? 'Listo.')
  }
  return (
    <>
      <button className="btn btn--sec" disabled={ocupado} onClick={() => void tocar()}>Levantar la suspensión</button>
      {error && <div className="err" role="alert">{error}</div>}
    </>
  )
}

export function Admin() {
  const s = useStore()
  const ahora = useAhora()
  const [panel, setPanel] = useState<Panel | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  const cargar = useCallback(async () => {
    if (!REAL) return setPanel(panelDemo(useStore.getState()))
    setCargando(true)
    const r = await leerPanel()
    setCargando(false)
    if (r.panel) {
      setPanel(r.panel)
      setError(null)
    } else setError(r.error ?? 'No pudimos cargar el panel.')
  }, [])

  useEffect(() => {
    void cargar()
    const cada = setInterval(() => void cargar(), 30_000)
    return () => clearInterval(cada)
  }, [cargar])

  // Con servidor, si administro se sabe un momento después de abrir la app.
  if (!s.ajustesListos) {
    return (
      <div className="screen">
        <Head title="Panel" back="/perfil" />
        <div className="pad"><div className="m center">Cargando…</div></div>
        <TabBar on="perfil" />
      </div>
    )
  }
  if (!s.admin) return <Navigate to="/perfil" replace />

  const listo = (texto: string) => {
    setAviso(texto)
    void cargar()
  }

  return (
    <div className="screen">
      <Head title="Panel" back="/perfil">
        <button className="btn btn--sec" disabled={cargando} onClick={() => void cargar()}>{cargando ? 'Actualizando…' : 'Actualizar'}</button>
      </Head>
      <div className="scroll">
        <div className="pad" style={{ '--gap': '20px' } as CSSProperties}>
          {aviso && <div className="ok" role="status">{aviso}</div>}
          {error && <div className="err" role="alert">{error}</div>}
          {!panel ? (
            !error && <div className="m center">Cargando…</div>
          ) : (
            <>
              <section className="panel-numeros" aria-label="Números">
                <Numero n={panel.registrados} texto="registrados" />
                <Numero n={panel.nuevosHoy} texto={`nuevos hoy · ${panel.nuevos7} en 7 días`} />
                <Numero n={panel.activosHoy} texto={`entraron hoy · ${panel.activos7} en 7 días`} />
                <Numero n={panel.conectados} texto="conectados ahora" />
                <Numero n={panel.buscando} texto="buscando partido ahora" />
                <Numero n={panel.amistososHoy} texto={`amistosos hoy · ${panel.amistosos} en total`} />
                <Numero n={panel.mensajesChat} texto="mensajes en el chat (24 h)" />
              </section>

              <section className="lista" aria-label="Reportes">
                <h2 className="h sub">Reportes de los últimos 30 días</h2>
                {panel.reportados.length === 0 ? (
                  <div className="vacio"><div className="m">Nadie fue reportado.</div></div>
                ) : panel.reportados.map((u) => (
                  <div key={u.id} className="card card--col reportado">
                    <div className="row">
                      <Avatar nombre={u.nick} foto={u.foto} />
                      <Nombre u={u} />
                    </div>
                    <div className="m">
                      {u.reportes} {u.reportes === 1 ? 'reporte' : 'reportes'} de {u.deDistintos} {u.deDistintos === 1 ? 'persona' : 'personas distintas'} · {u.motivos} · último {hace(ahora - u.ultimo)}
                    </div>
                    <ul className="m">
                      {u.detalle.map((d, i) => (
                        <li key={i}>{hace(ahora - d.cuando)}: {d.motivo}{d.detalle ? ` · "${d.detalle}"` : ''}</li>
                      ))}
                    </ul>
                    {u.suspendidoHasta ? (
                      <>
                        <div className="m">Suspendido hasta el {fecha(u.suspendidoHasta)}.</div>
                        <div className="acciones"><Levantar u={u} onListo={listo} /></div>
                      </>
                    ) : (
                      <div className="acciones"><Suspender u={u} onListo={listo} /></div>
                    )}
                  </div>
                ))}
              </section>

              {panel.suspendidos.length > 0 && (
                <section className="lista" aria-label="Suspendidos">
                  <h2 className="h sub">Suspendidos</h2>
                  {panel.suspendidos.map((u) => (
                    <div key={u.id} className="card card--col reportado">
                      <div className="row">
                        <Avatar nombre={u.nick} />
                        <Nombre u={u} />
                      </div>
                      <div className="m">Hasta el {fecha(u.hasta)}{u.motivo ? ` · ${u.motivo}` : ''}</div>
                      <div className="acciones"><Levantar u={u} onListo={listo} /></div>
                    </div>
                  ))}
                </section>
              )}

              <section className="lista" aria-label="Últimos registrados">
                <h2 className="h sub">Últimos registrados</h2>
                {panel.ultimos.map((u) => (
                  <div key={u.id} className="card card--row">
                    <Avatar nombre={u.nick} foto={u.foto} />
                    <Nombre u={u} />
                    <span className="m" style={{ flex: 'none' }}>{u.creadoAt ? hace(ahora - u.creadoAt) : ''}</span>
                  </div>
                ))}
              </section>
              <p className="m">Se actualiza solo cada 30 segundos. Para borrar un mensaje del chat, tocá el tacho que aparece al lado.</p>
            </>
          )}
        </div>
      </div>
      <TabBar on="perfil" />
    </div>
  )
}

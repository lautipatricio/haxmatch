import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { YO, miNivelUsuario, useStore, usuarioDe } from '../data/store'
import type { MensajeChat, Usuario } from '../domain/types'
import { Avatar, Campana, Conectado, Head, Icon, TabBar } from '../ui'

const MAX = 300
/** Mensajes seguidos de la misma persona, con menos de esto entre uno y otro, van juntos bajo un solo nombre. */
const JUNTOS_MS = 5 * 60 * 1000

const hora = (at: number) => new Date(at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })

/** Nombre, nivel y hora arriba del primer mensaje de cada tanda. Tocar el nombre de otro abre su perfil. */
function Autor({ u, at, mio }: { u: Usuario; at: number; mio: boolean }) {
  const abrir = useStore((s) => s.abrirFicha)
  const contenido = (
    <>
      <Avatar user={u} size="sm" />
      <span className="strong cut">{u.username}</span>
      <Conectado id={u.id} />
      {u.nivel !== null && <span className="pill">Nivel {u.nivel}</span>}
      <span className="m chat__hora">{hora(at)}</span>
    </>
  )
  if (mio) return <div className="chat__autor">{contenido}</div>
  return (
    <button type="button" className="chat__autor" aria-label={`Ver a ${u.username}`} onClick={() => abrir(u.id)}>
      {contenido}
    </button>
  )
}

function Mensaje({ m, conAutor, u, puedeBorrar, porBorrar, onBorrar }: {
  m: MensajeChat; conAutor: boolean; u: Usuario; puedeBorrar: boolean; porBorrar: boolean; onBorrar: () => void
}) {
  return (
    <div className={`chat__msg${conAutor ? ' chat__msg--primero' : ''}`}>
      {conAutor && <Autor u={u} at={m.at} mio={m.userId === YO} />}
      <div className="chat__linea">
        <p className="chat__texto">{m.texto}</p>
        {puedeBorrar && (
          porBorrar ? (
            <button className="btn btn--ghost chat__borrar-si" onClick={onBorrar}>Borrar</button>
          ) : (
            <button className="x chat__borrar" aria-label="Borrar mensaje" onClick={onBorrar}><Icon name="basura" size={18} /></button>
          )
        )}
      </div>
    </div>
  )
}

export function Chat() {
  const s = useStore()
  const [texto, setTexto] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  /** Mensaje con el "Borrar" a la vista, esperando el segundo toque. */
  const [porBorrar, setPorBorrar] = useState<string | null>(null)
  /** Quien administra: muestra el tacho también en los mensajes de los demás. */
  const [moderar, setModerar] = useState(false)
  const lista = useRef<HTMLDivElement>(null)
  /** Si estaba mirando lo último: entonces, cuando llega algo nuevo, se baja solo. */
  const abajo = useRef(true)
  const conectarChat = s.conectarChat

  useEffect(() => conectarChat(), [conectarChat])

  // Lo de quien bloqueé no se muestra (con servidor ya no viene, pero el bloqueo recién hecho tarda un momento).
  const mensajes = s.chat.filter((m) => !s.bloqueados.includes(m.userId))
  const ultimo = mensajes[mensajes.length - 1]?.id

  useLayoutEffect(() => {
    const el = lista.current
    if (el && abajo.current) el.scrollTop = el.scrollHeight
  }, [ultimo, s.chatListo])

  useEffect(() => {
    if (!porBorrar) return
    const t = setTimeout(() => setPorBorrar(null), 4000)
    return () => clearTimeout(t)
  }, [porBorrar])

  const autor = (userId: string): Usuario => {
    if (userId !== YO) return usuarioDe(s, userId)
    return { ...usuarioDe(s, YO), id: YO, username: s.perfil?.nick ?? 'Vos', foto: s.perfil?.foto ?? null, nivel: miNivelUsuario(s) }
  }

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (enviando) return
    setEnviando(true)
    setError(null)
    abajo.current = true
    const problema = await s.escribirChat(texto)
    setEnviando(false)
    if (problema) setError(problema)
    else setTexto('')
  }

  const borrar = async (id: string) => {
    if (porBorrar !== id) return setPorBorrar(id)
    setPorBorrar(null)
    const problema = await s.borrarMensajeChat(id)
    if (problema) setError(problema)
  }

  const largo = texto.trim().length
  return (
    <div className="screen">
      <Head title="Chat">
        {s.admin && (
          <button className="btn btn--sec" aria-pressed={moderar} onClick={() => setModerar(!moderar)}>{moderar ? 'Listo' : 'Moderar'}</button>
        )}
        <Campana desde="/chat" />
      </Head>
      <div className="scroll" ref={lista} onScroll={(e) => {
        const el = e.currentTarget
        abajo.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
      }}>
        <div className="pad chat">
          <p className="m chat__nota">Chat de toda la comunidad. Los mensajes duran 24 horas. Tocá un nombre para ver su perfil, reportarlo o bloquearlo.</p>
          {!s.chatListo ? (
            <div className="m center">Cargando mensajes…</div>
          ) : s.errorChat && mensajes.length === 0 ? (
            <div className="err" role="alert">{s.errorChat}</div>
          ) : mensajes.length === 0 ? (
            <div className="vacio">
              <div className="h">Todavía no hay mensajes</div>
              <div className="m">Saludá a la comunidad o avisá que estás buscando partido.</div>
            </div>
          ) : (
            <div className="chat__lista" role="log" aria-label="Mensajes del chat" aria-live="polite">
              {mensajes.map((m, i) => {
                const antes = mensajes[i - 1]
                const conAutor = !antes || antes.userId !== m.userId || m.at - antes.at > JUNTOS_MS
                return (
                  <Mensaje key={m.id} m={m} conAutor={conAutor} u={autor(m.userId)}
                    puedeBorrar={m.userId === YO || (s.admin && moderar)} porBorrar={porBorrar === m.id} onBorrar={() => void borrar(m.id)} />
                )
              })}
            </div>
          )}
        </div>
      </div>
      <form className="chat__escribir" onSubmit={(e) => void enviar(e)}>
        {error && <div className="err" role="alert">{error}</div>}
        {s.suspension ? (
          <div className="m">{s.suspension} Mientras tanto no podés escribir en el chat.</div>
        ) : (
          <div className="row">
            <input id="chat-texto" className="field grow" value={texto} maxLength={MAX} autoComplete="off" enterKeyHint="send"
              placeholder="Escribí un mensaje" aria-label="Mensaje" onChange={(e) => { setTexto(e.target.value); if (error) setError(null) }} />
            <button className="btn btn--icon" type="submit" aria-label="Enviar" disabled={enviando || largo === 0}>
              <Icon name="enviar" size={20} />
            </button>
          </div>
        )}
        {largo > MAX - 50 && <div className="m chat__quedan">Te quedan {MAX - largo} letras</div>}
      </form>
      <TabBar on="chat" />
    </div>
  )
}

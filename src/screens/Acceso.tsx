import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ERROR_DE_INGRESO, REAL, REF_INICIAL } from '../config'
import { useStore } from '../data/store'
import { REGIONES, type Region } from '../domain/types'
import { Avatar, ChipsMulti, Head, Icon } from '../ui'

export function Ingresar() {
  const entrar = useStore((s) => s.entrarConDiscord)
  const nav = useNavigate()
  // Si llegó por un link de referido, arranca con el código ya cargado.
  const [conCodigo, setConCodigo] = useState(REF_INICIAL !== '')
  const [codigo, setCodigo] = useState(REF_INICIAL)
  const [error, setError] = useState<string | null>(ERROR_DE_INGRESO ? 'No se completó el ingreso con Discord. Probá de nuevo.' : null)
  const [ocupado, setOcupado] = useState(false)

  // Con servidor, entrar manda a Discord y la página vuelve sola ya con la sesión.
  // En modo demostración entra en el momento y sigue al registro.
  const ingresar = async (codigoAmigo?: string) => {
    setOcupado(true)
    const problema = await entrar(codigoAmigo)
    setError(problema)
    if (problema) setOcupado(false)
    else if (useStore.getState().perfil) nav('/bienvenida')
  }
  const registrar = (e: FormEvent) => {
    e.preventDefault()
    // El código se valida antes de pasar al registro.
    void ingresar(codigo)
  }

  return (
    <div className="screen">
      <div className="scroll">
        {/* La primera pantalla es la de siempre: el nombre y los dos botones para entrar. */}
        <div className="portada">
          <div className="hero" style={{ gap: 14 }}>
            <h1 className="h logo">Hax<br /><span>Match</span></h1>
            <div className="m">Amistosos de HaxBall, sin vueltas</div>
          </div>
          {conCodigo ? (
            <form className="foot" onSubmit={registrar}>
              <label className="h sub" htmlFor="codigo-amigo">Código de un amigo</label>
              <input id="codigo-amigo" className="field" value={codigo} placeholder={REAL ? 'Ej.: HXA2B3' : 'Ej.: NICO23'} autoCapitalize="characters"
                autoComplete="off" maxLength={12} autoFocus aria-describedby={error ? 'ingreso-error' : undefined}
                onChange={(e) => { setCodigo(e.target.value); setError(null) }} />
              {error && <div id="ingreso-error" className="err" role="alert">{error}</div>}
              <button className="btn btn--lg btn--block" type="submit" disabled={ocupado}>{ocupado ? 'Un momento…' : 'Continuar'}</button>
              <button className="btn btn--sec btn--block" type="button" disabled={ocupado} onClick={() => { setConCodigo(false); setError(null) }}>Volver</button>
            </form>
          ) : (
            <div className="foot">
              {error && <div className="err center" role="alert">{error}</div>}
              <button className="btn btn--lg btn--block" disabled={ocupado} onClick={() => void ingresar()}>
                {ocupado ? 'Abriendo Discord…' : 'Entrar con Discord'}
              </button>
              <button className="btn btn--sec btn--block" style={{ minHeight: 52 }} disabled={ocupado} onClick={() => { setConCodigo(true); setError(null) }}>
                Registrarme con el código de un amigo
              </button>
              <p className="m center" style={{ margin: 0 }}>
                {REAL
                  ? 'Encontrá jugadores de HaxBall, armá amistosos y mirá los clips de la comunidad.'
                  : 'Versión de prueba: el ingreso está simulado y los demás jugadores son inventados.'}
              </p>
              <p className="m center" style={{ margin: 0 }}>
                Al entrar aceptás los <a href="/terminos">Términos</a> y la <a href="/privacidad">Política de privacidad</a>.
              </p>
            </div>
          )}
          <button type="button" className="btn btn--ghost portada__mas"
            onClick={() => document.getElementById('que-es')?.scrollIntoView({ block: 'start', behavior: 'smooth' })}>
            Qué es HaxMatch <Icon name="abajo" size={18} />
          </button>
        </div>

        {/* Debajo, para quien llega sin conocerla: qué es y cómo funciona, sin tener que entrar. */}
        <div className="pad sobre" id="que-es">
          <section>
            <h2 className="h">Para jugar más amistosos</h2>
            <p>
              HaxMatch es una app gratuita para la comunidad de HaxBall. Te junta con otros jugadores para armar amistosos
              en el momento, sin andar preguntando en diez servidores de Discord, y reúne los clips que sube la comunidad.
            </p>
          </section>

          <section>
            <h2 className="h">Cómo funciona</h2>
            <ol className="pasos">
              <li>
                <span className="strong">Entrás con tu cuenta de Discord.</span>
                <span className="m">Elegís tu nick y tu región. No pedimos contraseña ni mail.</span>
              </li>
              <li>
                <span className="strong">Tocás “Quiero jugar un amistoso”.</span>
                <span className="m">Quedás en la cola, a la vista de las salas a las que les falta gente.</span>
              </li>
              <li>
                <span className="strong">O abrís tu sala y elegís a quién invitar.</span>
                <span className="m">Decís qué posición te falta y en qué cancha. Al jugador le llega la invitación y, si acepta, entra.</span>
              </li>
              <li>
                <span className="strong">Juegan en HaxBall y confirman el partido.</span>
                <span className="m">Cada amistoso confirmado suma puntos y te hace subir de nivel.</span>
              </li>
            </ol>
          </section>

          <section>
            <h2 className="h">Clips de la comunidad</h2>
            <p>
              Si vinculás tu cuenta de TikTok, tus videos públicos con <strong>#haxball</strong> o <strong>#haxmatch</strong> aparecen
              en la sección Clips, con tu nombre de TikTok, para que los vea y reaccione el resto de la comunidad.
            </p>
            <ul className="steps m">
              <li>Solo leemos tu nombre de TikTok y la lista de tus videos públicos.</li>
              <li>Los videos se reproducen desde TikTok: no los copiamos ni publicamos nada en tu cuenta.</li>
              <li>Podés ocultar cualquier video, o desvincular tu cuenta cuando quieras: se borra todo lo que trajimos.</li>
            </ul>
          </section>

          <section>
            <h2 className="h">Amigos, niveles y avisos</h2>
            <p>
              Agregá amigos para enterarte cuando se ponen a buscar partido, sumá puntos por jugar y por entrar seguido,
              y recibí un aviso en el celular o en la computadora cuando una sala te invita.
            </p>
          </section>

          <footer className="m">
            <p>HaxMatch es un proyecto independiente de la comunidad. No está afiliado a HaxBall, Discord ni TikTok.</p>
            <p>
              <a href="/terminos">Términos y condiciones</a> · <a href="/privacidad">Política de privacidad</a> ·{' '}
              <a href="mailto:lpatriciogauna@outlook.com">Contacto</a>
            </p>
          </footer>
        </div>
      </div>
    </div>
  )
}

export function Onboarding() {
  const perfil = useStore((s) => s.perfil)
  const usuarios = useStore((s) => s.usuarios)
  const completar = useStore((s) => s.completarOnboarding)
  const nav = useNavigate()
  const [nick, setNick] = useState('')
  const [region, setRegion] = useState<Region[]>(perfil?.region.length ? perfil.region : ['ARG'])
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const invito = perfil?.invitoNick ?? (perfil?.referidoPor ? usuarios[perfil.referidoPor]?.username : null)
  // Lo que se va a usar si no escribe un nick.
  const sugerido = REAL ? perfil?.nick : perfil?.username

  const empezar = async () => {
    setOcupado(true)
    const e = await completar({ nick: nick.trim() || sugerido || '', region })
    setError(e)
    setOcupado(false)
    if (!e) nav('/')
  }

  return (
    <div className="screen">
      <Head title="Bienvenido" />
      <div className="scroll">
        <div className="pad">
          <label className="h sub" htmlFor="nick">Tu nick (opcional)</label>
          <input id="nick" className="field" value={nick} placeholder={sugerido} autoComplete="off" maxLength={20}
            aria-describedby="nick-ayuda" onChange={(e) => { setNick(e.target.value); setError(null) }} />
          <div id="nick-ayuda" className="m">
            Es el nombre que aparece en tu perfil. Si lo dejás vacío, usamos {REAL ? 'tu nombre de Discord' : 'tu usuario de Discord'}.
          </div>
          {error && <div className="err" role="alert">{error}</div>}
          <div className="card">
            <Avatar nombre={nick.trim() || sugerido} />
            <div className="grow">
              <div className="strong">Discord conectado</div>
              <div className="m cut">{perfil?.username}{invito && ` · te invitó ${invito}`}</div>
            </div>
            <span style={{ color: 'var(--accent)' }}><Icon name="check" /></span>
          </div>
          <div>Tu nivel empieza en 0 y sube con tu actividad en la app.</div>
          <ChipsMulti label="Región" options={REGIONES} value={region} onChange={setRegion} />
          <div className="m">Podés marcar más de una región. La posición la elegís cada vez que buscás un amistoso o un jugador.</div>
        </div>
      </div>
      <div className="foot" style={{ paddingBottom: 24 }}>
        <button className="btn btn--lg btn--block" disabled={ocupado} onClick={() => void empezar()}>{ocupado ? 'Guardando…' : 'Empezar'}</button>
      </div>
    </div>
  )
}

import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { REF_INICIAL } from '../config'
import { useStore } from '../data/store'
import { REGIONES, type Region } from '../domain/types'
import { Avatar, ChipsMulti, Head, Icon } from '../ui'

export function Ingresar() {
  const entrar = useStore((s) => s.entrarConDiscord)
  const nav = useNavigate()
  // Si llegó por un link de referido, arranca con el código ya cargado.
  const [conCodigo, setConCodigo] = useState(REF_INICIAL !== '')
  const [codigo, setCodigo] = useState(REF_INICIAL)
  const [error, setError] = useState<string | null>(null)

  const ingresar = () => {
    entrar()
    nav('/bienvenida')
  }
  const registrar = (e: FormEvent) => {
    e.preventDefault()
    // El código se valida antes de pasar al registro.
    const problema = entrar(codigo)
    setError(problema)
    if (!problema) nav('/bienvenida')
  }

  return (
    <div className="screen">
      <div className="hero" style={{ gap: 14 }}>
        <h1 className="h logo">Hax<br /><span>Match</span></h1>
        <div className="m">Amistosos de HaxBall, sin vueltas</div>
      </div>
      {conCodigo ? (
        <form className="foot" style={{ paddingBottom: 40 }} onSubmit={registrar}>
          <label className="h sub" htmlFor="codigo-amigo">Código de un amigo</label>
          <input id="codigo-amigo" className="field" value={codigo} placeholder="Ej.: NICO23" autoCapitalize="characters"
            autoComplete="off" maxLength={12} autoFocus aria-describedby={error ? 'codigo-error' : undefined}
            onChange={(e) => { setCodigo(e.target.value); setError(null) }} />
          {error && <div id="codigo-error" className="err" role="alert">{error}</div>}
          <button className="btn btn--lg btn--block" type="submit">Continuar</button>
          <button className="btn btn--sec btn--block" type="button" onClick={() => { setConCodigo(false); setError(null) }}>Volver</button>
        </form>
      ) : (
        <div className="foot" style={{ paddingBottom: 40 }}>
          <button className="btn btn--lg btn--block" onClick={ingresar}>Entrar con Discord</button>
          <button className="btn btn--sec btn--block" style={{ minHeight: 52 }} onClick={() => setConCodigo(true)}>
            Registrarme con el código de un amigo
          </button>
          <p className="m center" style={{ margin: 0 }}>
            Versión de prueba: el ingreso está simulado y los demás jugadores son inventados.
          </p>
        </div>
      )}
    </div>
  )
}

export function Onboarding() {
  const perfil = useStore((s) => s.perfil)
  const usuarios = useStore((s) => s.usuarios)
  const completar = useStore((s) => s.completarOnboarding)
  const nav = useNavigate()
  const [nick, setNick] = useState('')
  const [region, setRegion] = useState<Region[]>(['ARG'])
  const [error, setError] = useState<string | null>(null)
  const invito = perfil?.referidoPor ? usuarios[perfil.referidoPor]?.username : null

  const empezar = () => {
    const e = completar({ nick, region })
    setError(e)
    if (!e) nav('/')
  }

  return (
    <div className="screen">
      <Head title="Bienvenido" />
      <div className="scroll">
        <div className="pad">
          <label className="h sub" htmlFor="nick">Tu nick (opcional)</label>
          <input id="nick" className="field" value={nick} placeholder={perfil?.username} autoComplete="off" maxLength={20}
            aria-describedby="nick-ayuda" onChange={(e) => { setNick(e.target.value); setError(null) }} />
          <div id="nick-ayuda" className="m">Es el nombre que aparece en tu perfil. Si lo dejás vacío, usamos tu usuario de Discord.</div>
          {error && <div className="err" role="alert">{error}</div>}
          <div className="card">
            <Avatar nombre={nick.trim() || perfil?.username} />
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
        <button className="btn btn--lg btn--block" onClick={empezar}>Empezar</button>
      </div>
    </div>
  )
}
